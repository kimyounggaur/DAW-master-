import type { Project } from "@/model/project";
import type { Track } from "@/model/track";
import type { Clip, PatternClip, MidiClip } from "@/model/clip";
import type { Step } from "@/model/note";
import { newId } from "@/lib/id";

export type TemplateKind = "lofi" | "pop" | "edm" | "kpop" | "empty";

interface TemplateMeta {
  id: TemplateKind;
  name: string;
  description: string;
  bpm: number;
  key: { tonic: import("@/model/project").Pitch; scale: import("@/model/project").Scale };
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "lofi", name: "Lo-fi Beat", description: "90 BPM, A minor, chill 드럼+코드", bpm: 90, key: { tonic: "A", scale: "minor" } },
  { id: "pop", name: "Pop Loop", description: "110 BPM, C major, 8마디 팝 루프", bpm: 110, key: { tonic: "C", scale: "major" } },
  { id: "edm", name: "EDM Drop", description: "128 BPM, F minor, 8마디 드롭", bpm: 128, key: { tonic: "F", scale: "minor" } },
  { id: "kpop", name: "K-Pop Verse", description: "120 BPM, G minor, K-Pop 베이스+드럼", bpm: 120, key: { tonic: "G", scale: "minor" } },
  { id: "empty", name: "Empty", description: "빈 프로젝트", bpm: 120, key: { tonic: "C", scale: "minor" } },
];

function emptySteps(stepCount: 16 | 32 = 16, rows = 8): Step[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: stepCount }, () => ({ on: false, velocity: 0.8, micro: 0 })),
  );
}

function setSteps(steps: Step[][], row: number, positions: number[], velocity = 0.9) {
  const r = steps[row];
  if (!r) return;
  for (const p of positions) {
    const s = r[p];
    if (s) { s.on = true; s.velocity = velocity; }
  }
}

function makeTrack(
  partial: { type: Track["type"]; name: string; color: string; instrument?: string },
): Track {
  return {
    id: newId(),
    type: partial.type,
    name: partial.name,
    color: partial.color,
    height: 64,
    mixer: { volumeDb: 0, pan: 0, muted: false, soloed: false, armed: false, sends: [] },
    devices: [],
    launcherSlots: [null, null, null, null, null, null, null, null],
    timelineClips: [],
    ...(partial.instrument
      ? { instrument: { id: newId(), kind: partial.instrument, bypass: false, params: {} } }
      : {}),
  };
}

function makeMaster(): Track {
  return {
    id: newId(),
    type: "master",
    name: "Master",
    color: "#ef4444",
    height: 48,
    mixer: { volumeDb: 0, pan: 0, muted: false, soloed: false, armed: false, sends: [] },
    devices: [],
    launcherSlots: [null, null, null, null, null, null, null, null],
    timelineClips: [],
  };
}

function makeMetronome(): Track {
  return {
    id: newId(),
    type: "instrument",
    name: "Metronome",
    color: "#6b7280",
    height: 28,
    mixer: { volumeDb: 0, pan: 0, muted: false, soloed: false, armed: false, sends: [] },
    devices: [],
    launcherSlots: [null, null, null, null, null, null, null, null],
    timelineClips: [],
  };
}

function midiClipFromNotes(
  trackId: string,
  name: string,
  startBeat: number,
  lengthBeats: number,
  notes: Array<{ pitch: number; startBeat: number; lengthBeats: number; velocity?: number }>,
): MidiClip {
  return {
    id: newId(),
    trackId,
    name,
    startBeat,
    lengthBeats,
    loop: false,
    type: "midi",
    notes: notes.map((n) => ({
      id: newId(),
      pitch: n.pitch,
      startBeat: n.startBeat,
      lengthBeats: n.lengthBeats,
      velocity: n.velocity ?? 0.8,
    })),
  };
}

function patternClip(
  trackId: string,
  name: string,
  startBeat: number,
  lengthBeats: number,
  steps: Step[][],
): PatternClip {
  return {
    id: newId(),
    trackId,
    name,
    startBeat,
    lengthBeats,
    loop: false,
    type: "pattern",
    steps,
    stepCount: (steps[0]?.length === 32 ? 32 : 16) as 16 | 32,
    swing: 0,
  };
}

export function buildTemplate(kind: TemplateKind): Project {
  const meta = TEMPLATES.find((t) => t.id === kind) ?? TEMPLATES[4]!;
  const metro = makeMetronome();
  const master = makeMaster();
  const tracks: Track[] = [metro];
  const clips: Record<string, Clip> = {};

  function addClip(c: Clip, track: Track) {
    clips[c.id] = c;
    track.timelineClips.push(c.id);
  }

  if (kind === "empty") {
    tracks.push(master);
    return baseProject(meta, tracks, clips);
  }

  // Drums
  const drums = makeTrack({ type: "drum", name: "Drums", color: "#f59e0b", instrument: "drumSampler" });
  const drumSteps = emptySteps(16);
  if (kind === "lofi") {
    setSteps(drumSteps, 0, [0, 8], 0.9); // kick
    setSteps(drumSteps, 1, [4, 12], 0.85); // snare
    setSteps(drumSteps, 2, [0, 2, 4, 6, 8, 10, 12, 14], 0.5); // hh
  } else if (kind === "pop") {
    setSteps(drumSteps, 0, [0, 8], 0.95);
    setSteps(drumSteps, 1, [4, 12], 0.9);
    setSteps(drumSteps, 2, [0, 2, 4, 6, 8, 10, 12, 14], 0.6);
  } else if (kind === "edm") {
    setSteps(drumSteps, 0, [0, 4, 8, 12], 1.0); // 4 on the floor
    setSteps(drumSteps, 1, [4, 12], 0.9);
    setSteps(drumSteps, 3, [2, 6, 10, 14], 0.7); // open hat
  } else if (kind === "kpop") {
    setSteps(drumSteps, 0, [0, 6, 10], 0.95);
    setSteps(drumSteps, 1, [4, 12], 0.9);
    setSteps(drumSteps, 2, [0, 2, 4, 6, 8, 10, 12, 14], 0.5);
    setSteps(drumSteps, 4, [12], 0.7); // clap
  }
  const drumClip = patternClip(drums.id, "Drum Beat", 0, 4, drumSteps);
  drums.launcherSlots[0] = drumClip.id;
  addClip(drumClip, drums);
  // duplicate to fill 8 bars
  const drumClip2 = patternClip(drums.id, "Drum Beat 2", 4, 4, JSON.parse(JSON.stringify(drumSteps)));
  addClip(drumClip2, drums);
  tracks.push(drums);

  // Bass
  const bass = makeTrack({ type: "instrument", name: "Bass", color: "#3b82f6", instrument: "simpleSynth" });
  const tonicMidi = midiBase(meta.key.tonic) - 12; // bass octave
  const bassNotes = (kind === "lofi"
    ? [0, 0, 5, 7]
    : kind === "edm"
      ? [0, 0, 0, 5]
      : kind === "kpop"
        ? [0, 3, 5, 7]
        : [0, 5, 7, 5]).map((step, i) => ({
    pitch: tonicMidi + step,
    startBeat: i,
    lengthBeats: 1,
    velocity: 0.85,
  }));
  const bassClip = midiClipFromNotes(bass.id, "Bass", 0, 4, bassNotes);
  bass.launcherSlots[0] = bassClip.id;
  addClip(bassClip, bass);
  tracks.push(bass);

  // Chords / Lead
  const lead = makeTrack({ type: "instrument", name: "Chords", color: "#a855f7", instrument: "simpleSynth" });
  const chordRoot = midiBase(meta.key.tonic);
  const chordIntervals = meta.key.scale === "major" ? [0, 4, 7] : [0, 3, 7];
  const chordNotes: Array<{ pitch: number; startBeat: number; lengthBeats: number; velocity?: number }> = [];
  const chordSteps = [0, 5, 7, 5]; // i V VII V
  chordSteps.forEach((step, i) => {
    for (const iv of chordIntervals) {
      chordNotes.push({ pitch: chordRoot + step + iv, startBeat: i, lengthBeats: 0.9, velocity: 0.6 });
    }
  });
  const leadClip = midiClipFromNotes(lead.id, "Chords", 0, 4, chordNotes);
  lead.launcherSlots[0] = leadClip.id;
  addClip(leadClip, lead);
  tracks.push(lead);

  tracks.push(master);
  return baseProject(meta, tracks, clips);
}

function baseProject(meta: TemplateMeta, tracks: Track[], clips: Record<string, Clip>): Project {
  const now = Date.now();
  return {
    id: newId(),
    version: 1,
    meta: {
      title: meta.name,
      bpm: meta.bpm,
      timeSig: [4, 4],
      key: meta.key,
      createdAt: now,
      updatedAt: now,
    },
    tracks,
    clips,
    scenes: [
      { id: newId(), name: "Scene 1" },
      { id: newId(), name: "Scene 2" },
      { id: newId(), name: "Scene 3" },
      { id: newId(), name: "Scene 4" },
      { id: newId(), name: "Scene 5" },
      { id: newId(), name: "Scene 6" },
      { id: newId(), name: "Scene 7" },
      { id: newId(), name: "Scene 8" },
    ],
    arrangement: { lengthBars: meta.id === "edm" ? 8 : 16 },
    markers: [],
  };
}

function midiBase(tonic: import("@/model/project").Pitch): number {
  const map: Record<string, number> = {
    C: 60, "C#": 61, D: 62, "D#": 63, E: 64, F: 65, "F#": 66, G: 67, "G#": 68, A: 69, "A#": 70, B: 71,
  };
  return map[tonic] ?? 60;
}
