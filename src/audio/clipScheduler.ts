import { engine } from "./engine";
import { addProducer } from "./scheduler";
import { useProjectStore } from "@/state/projectStore";
import { useTransportStore } from "@/state/transportStore";
import { useLauncherStore } from "@/state/launcherStore";
import { getOrCreateInstrument } from "./instruments/hosting";
import { getOrCreateTrackNode } from "./tracks/trackGraph";

type Cleanup = () => void;

interface SchedKey {
  clipId: string;
  beatKey: number;
  source: "timeline" | "launcher";
}

const scheduledKeys = new Set<string>();
const audioSources = new Map<string, AudioBufferSourceNode>();

function k(s: SchedKey): string {
  return `${s.source}:${s.clipId}:${Math.round(s.beatKey * 1000)}`;
}

export function installClipScheduler(): Cleanup {
  const unsub = addProducer((fromBeat, toBeat, beatToCtxTime) => {
    const ctx = engine.ctx;
    if (!ctx) return;
    const project = useProjectStore.getState().project;
    const transport = useTransportStore.getState();
    const loop = transport.loop;

    const launcher = useLauncherStore.getState();
    for (const track of project.tracks) {
      // timeline clips
      for (const clipId of track.timelineClips) {
        const clip = project.clips[clipId];
        if (!clip) continue;
        scheduleClipEvents(track.id, clip, fromBeat, toBeat, beatToCtxTime, "timeline", loop);
      }
      // launcher: apply pending launch if crossing launchAt
      const pending = launcher.pending[track.id];
      if (pending && pending.launchAtBeat >= fromBeat && pending.launchAtBeat < toBeat) {
        launcher.setActive(track.id, pending.clipId);
        launcher.setPending(track.id, null);
      }
      const activeClipId = launcher.active[track.id];
      if (activeClipId) {
        const clip = project.clips[activeClipId];
        if (clip) {
          // loop the launcher clip continuously
          const len = clip.lengthBeats;
          const wrappedClip = {
            ...clip,
            startBeat: Math.floor(fromBeat / len) * len,
            id: clip.id + ":launcher",
          };
          scheduleClipEvents(track.id, wrappedClip as typeof clip, fromBeat, toBeat, beatToCtxTime, "launcher", loop);
        }
      }
    }
  });
  return unsub;
}

function scheduleClipEvents(
  trackId: string,
  clip: import("@/model/clip").Clip,
  fromBeat: number,
  toBeat: number,
  beatToCtxTime: (b: number) => number,
  source: "timeline" | "launcher",
  loop: { enabled: boolean; startBeat: number; endBeat: number },
) {
  const clipStart = clip.startBeat;
  const clipEnd = clip.startBeat + clip.lengthBeats;
  const overlap = !(clipEnd <= fromBeat || clipStart >= toBeat);
  if (!overlap) return;

  const localFrom = Math.max(0, fromBeat - clipStart);
  const localTo = Math.min(clip.lengthBeats, toBeat - clipStart);

  if (clip.type === "pattern") {
    scheduleStepEvents(trackId, clip, localFrom, localTo, beatToCtxTime, source, loop);
  } else if (clip.type === "midi") {
    scheduleMidiEvents(trackId, clip, localFrom, localTo, beatToCtxTime, source);
  } else if (clip.type === "audio") {
    scheduleAudioEvent(trackId, clip, beatToCtxTime, source);
  }
}

function scheduleStepEvents(
  trackId: string,
  clip: import("@/model/clip").PatternClip,
  localFrom: number,
  localTo: number,
  beatToCtxTime: (b: number) => number,
  source: "timeline" | "launcher",
  _loop: { enabled: boolean; startBeat: number; endBeat: number },
) {
  const inst = getOrCreateInstrument(trackId);
  if (!inst || inst.kind !== "drumSampler") return;
  // 16 steps = 4 beats (one bar in 4/4). step duration = 4 / stepCount beats
  const stepDur = 4 / clip.stepCount;
  const startStep = Math.floor(localFrom / stepDur);
  const endStep = Math.ceil(localTo / stepDur);
  const swing = clip.swing;
  for (let step = startStep; step < endStep; step++) {
    const stepStart = step * stepDur;
    if (stepStart < localFrom || stepStart >= localTo) continue;
    const isOffBeat = step % 2 === 1;
    const swungOffset = isOffBeat ? swing * stepDur : 0;
    const absBeat = clip.startBeat + stepStart + swungOffset;
    for (let row = 0; row < clip.steps.length; row++) {
      const stepData = clip.steps[row]?.[step];
      if (!stepData || !stepData.on) continue;
      const microSec = stepData.micro / 1000;
      const when = beatToCtxTime(absBeat) + microSec;
      const key = k({ clipId: clip.id, beatKey: absBeat * 1000 + row, source });
      if (scheduledKeys.has(key)) continue;
      scheduledKeys.add(key);
      inst.impl.trigger(row, stepData.velocity, when);
    }
  }
}

function scheduleMidiEvents(
  trackId: string,
  clip: import("@/model/clip").MidiClip,
  localFrom: number,
  localTo: number,
  beatToCtxTime: (b: number) => number,
  source: "timeline" | "launcher",
) {
  const inst = getOrCreateInstrument(trackId);
  if (!inst || inst.kind !== "simpleSynth") return;
  for (const note of clip.notes) {
    const noteStart = note.startBeat;
    if (noteStart < localFrom || noteStart >= localTo) continue;
    const absStart = clip.startBeat + noteStart;
    const absEnd = clip.startBeat + noteStart + note.lengthBeats;
    const onKey = k({ clipId: clip.id, beatKey: absStart * 1000 + note.pitch, source });
    if (scheduledKeys.has(onKey)) continue;
    scheduledKeys.add(onKey);
    const whenOn = beatToCtxTime(absStart);
    const whenOff = beatToCtxTime(absEnd);
    inst.impl.noteOn(note.pitch, note.velocity, whenOn);
    inst.impl.noteOff(note.pitch, whenOff);
  }
}

function scheduleAudioEvent(
  trackId: string,
  clip: import("@/model/clip").AudioClip,
  beatToCtxTime: (b: number) => number,
  source: "timeline" | "launcher",
) {
  const ctx = engine.ctx;
  if (!ctx) return;
  const node = getOrCreateTrackNode(trackId);
  if (!node) return;
  const key = k({ clipId: clip.id, beatKey: clip.startBeat * 1000, source });
  if (scheduledKeys.has(key)) return;
  // resolve sample buffer
  import("@/storage/opfs").then(({ getDecodedSample }) => {
    void getDecodedSample(clip.sampleId).then((buf) => {
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = Math.pow(10, clip.gainDb / 20);
      src.connect(gain).connect(node.input);
      const when = beatToCtxTime(clip.startBeat);
      src.start(when, clip.offsetBeats);
      audioSources.set(clip.id, src);
      scheduledKeys.add(key);
      src.onended = () => {
        audioSources.delete(clip.id);
        scheduledKeys.delete(key);
      };
    });
  });
}

export function clearAudioPlayback(): void {
  for (const src of audioSources.values()) {
    try { src.stop(); } catch { /* noop */ }
  }
  audioSources.clear();
  scheduledKeys.clear();
}
