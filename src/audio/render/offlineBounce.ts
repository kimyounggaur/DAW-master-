import type { Project } from "@/model/project";
import type { Clip, PatternClip, MidiClip, AudioClip } from "@/model/clip";
import { beatsToSeconds } from "@/model/time";
import { getDecodedSample } from "@/storage/opfs";
import { createDevice } from "@/audio/devices/registry";
import type { AudioDevice } from "@/audio/devices/types";

export interface BounceOptions {
  sampleRate?: number;
  numChannels?: 1 | 2;
  includeMetronome?: boolean;
  onProgress?: (frac: number) => void;
}

interface OfflineTrack {
  input: GainNode;
  pan: StereoPannerNode;
  output: GainNode;
  devices: AudioDevice[];
}

export async function bounceProject(project: Project, opts: BounceOptions = {}): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 48000;
  const numChannels = opts.numChannels ?? 2;
  const beatsPerBar = project.meta.timeSig[0];
  const lengthBeats = project.arrangement.lengthBars * beatsPerBar;
  const durationSec = beatsToSeconds(lengthBeats, project.meta.bpm);
  const frameCount = Math.ceil(durationSec * sampleRate);

  const ctx = new OfflineAudioContext({
    numberOfChannels: numChannels,
    length: frameCount,
    sampleRate,
  });

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const trackNodes = new Map<string, OfflineTrack>();
  for (const t of project.tracks) {
    const input = ctx.createGain();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const output = ctx.createGain();
    gain.gain.value = effectiveLinear(t, project);
    pan.pan.value = t.mixer.pan;
    input.connect(gain).connect(pan);
    // device chain
    const devices: AudioDevice[] = [];
    let cursor: AudioNode = pan;
    for (const d of t.devices) {
      const dev = createDevice(d.kind, ctx);
      if (!dev) continue;
      for (const p of dev.params) {
        const v = d.params[p.id];
        if (typeof v === "number") dev.set(p.id, v);
      }
      dev.setBypass(d.bypass);
      cursor.connect(dev.input);
      cursor = dev.output;
      devices.push(dev);
    }
    cursor.connect(output);
    output.connect(master);
    trackNodes.set(t.id, { input, pan, output, devices });
  }

  // schedule clips
  for (const t of project.tracks) {
    const node = trackNodes.get(t.id);
    if (!node) continue;
    for (const clipId of t.timelineClips) {
      const clip = project.clips[clipId];
      if (!clip) continue;
      await scheduleOfflineClip(ctx, clip, node, project);
    }
  }

  // progress polling
  let progressRaf: number | null = null;
  if (opts.onProgress) {
    const onp = opts.onProgress;
    const tick = () => {
      const frac = Math.min(1, ctx.currentTime / durationSec);
      onp(frac);
      if (frac < 1) progressRaf = requestAnimationFrame(tick);
    };
    progressRaf = requestAnimationFrame(tick);
  }

  const rendered = await ctx.startRendering();
  if (progressRaf !== null) cancelAnimationFrame(progressRaf);
  opts.onProgress?.(1);
  return rendered;
}

function effectiveLinear(t: import("@/model/track").Track, project: Project): number {
  const db = t.mixer.volumeDb;
  const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
  const anySolo = project.tracks.some((x) => x.mixer.soloed && x.type !== "master");
  const muted = t.mixer.muted || (anySolo && !t.mixer.soloed && t.type !== "master");
  return muted ? 0 : linear;
}

// async clip scheduling
async function scheduleOfflineClip(
  ctx: OfflineAudioContext,
  clip: Clip,
  node: OfflineTrack,
  project: Project,
) {
  const bpm = project.meta.bpm;
  const start = beatsToSeconds(clip.startBeat, bpm);

  if (clip.type === "pattern") {
    schedulePatternOffline(ctx, clip as PatternClip, node, bpm, start);
  } else if (clip.type === "midi") {
    scheduleMidiOffline(ctx, clip as MidiClip, node, bpm, start);
  } else if (clip.type === "audio") {
    await scheduleAudioOffline(ctx, clip as AudioClip, node, start);
  }
}

function schedulePatternOffline(
  ctx: OfflineAudioContext,
  clip: PatternClip,
  node: OfflineTrack,
  bpm: number,
  startSec: number,
) {
  const stepDur = 4 / clip.stepCount;
  for (let step = 0; step < clip.stepCount; step++) {
    const stepStart = step * stepDur;
    if (stepStart >= clip.lengthBeats) break;
    const isOff = step % 2 === 1;
    const swungOffset = isOff ? clip.swing * stepDur : 0;
    const when = startSec + beatsToSeconds(stepStart + swungOffset, bpm);
    for (let row = 0; row < clip.steps.length; row++) {
      const cell = clip.steps[row]?.[step];
      if (!cell?.on) continue;
      makeOfflineDrum(ctx, node.input, row, cell.velocity, when + cell.micro / 1000);
    }
  }
}

const DEFAULT_DRUMS = [
  { type: "sine" as OscillatorType, freq: 60, dur: 0.5, pitchEnv: 80 },
  { type: "noise", freq: 200, dur: 0.18 },
  { type: "noise", freq: 8000, dur: 0.04 },
  { type: "noise", freq: 8000, dur: 0.3 },
  { type: "noise", freq: 1500, dur: 0.15 },
  { type: "sine" as OscillatorType, freq: 100, dur: 0.4 },
  { type: "sine" as OscillatorType, freq: 200, dur: 0.35 },
  { type: "triangle" as OscillatorType, freq: 700, dur: 0.1 },
];

function makeOfflineDrum(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  row: number,
  velocity: number,
  when: number,
) {
  const spec = DEFAULT_DRUMS[row];
  if (!spec) return;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(velocity, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);
  gain.connect(dest);

  if (spec.type === "noise") {
    const len = Math.max(1, Math.floor(spec.dur * ctx.sampleRate));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = row === 2 || row === 3 ? "highpass" : "lowpass";
    filt.frequency.value = spec.freq;
    src.connect(filt).connect(gain);
    src.start(when);
  } else {
    const osc = ctx.createOscillator();
    osc.type = spec.type as OscillatorType;
    osc.frequency.setValueAtTime(spec.freq + (spec.pitchEnv ?? 0), when);
    osc.frequency.exponentialRampToValueAtTime(spec.freq, when + 0.06);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + spec.dur + 0.02);
  }
}

function scheduleMidiOffline(
  ctx: OfflineAudioContext,
  clip: MidiClip,
  node: OfflineTrack,
  bpm: number,
  startSec: number,
) {
  for (const note of clip.notes) {
    const when = startSec + beatsToSeconds(note.startBeat, bpm);
    const dur = beatsToSeconds(note.lengthBeats, bpm);
    makeOfflineSynthVoice(ctx, node.input, note.pitch, note.velocity, when, dur);
  }
}

function makeOfflineSynthVoice(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  pitch: number,
  velocity: number,
  when: number,
  duration: number,
) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 4000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(velocity * 0.3, when + 0.01);
  amp.gain.linearRampToValueAtTime(velocity * 0.18, when + 0.1);
  amp.gain.setValueAtTime(velocity * 0.18, when + duration);
  amp.gain.linearRampToValueAtTime(0, when + duration + 0.2);
  osc.connect(filt).connect(amp).connect(dest);
  osc.start(when);
  osc.stop(when + duration + 0.25);
}

async function scheduleAudioOffline(
  ctx: OfflineAudioContext,
  clip: AudioClip,
  node: OfflineTrack,
  startSec: number,
) {
  if (!clip.sampleId) return;
  const buf = await getDecodedSample(clip.sampleId);
  if (!buf) return;
  // resample if mismatched — for MVP, just use original
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = Math.pow(10, clip.gainDb / 20);
  src.connect(gain).connect(node.input);
  src.start(startSec, clip.offsetBeats);
}
