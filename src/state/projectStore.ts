import { create } from "zustand";
import { produce } from "immer";
import type { Project, ProjectMeta } from "@/model/project";
import type { Track, TrackType, TrackMixer } from "@/model/track";
import type { Clip, MidiClip, PatternClip, AudioClip } from "@/model/clip";
import type { Note, Step } from "@/model/note";
import { newId } from "@/lib/id";

const TRACK_COLORS: Record<TrackType, string> = {
  audio: "#3b82f6",
  instrument: "#a855f7",
  drum: "#f59e0b",
  bus: "#10b981",
  master: "#ef4444",
};

function defaultMixer(): TrackMixer {
  return { volumeDb: 0, pan: 0, muted: false, soloed: false, armed: false, sends: [] };
}

function createTrack(type: TrackType, name: string): Track {
  return {
    id: newId(),
    type,
    name,
    color: TRACK_COLORS[type],
    height: 64,
    mixer: defaultMixer(),
    devices: [],
    launcherSlots: [null, null, null, null, null, null, null, null],
    timelineClips: [],
  };
}

function createMaster(): Track {
  return { ...createTrack("master", "Master"), height: 48 };
}

function createMetronomeTrack(): Track {
  const t = createTrack("instrument", "Metronome");
  t.color = "#6b7280";
  t.height = 28;
  return t;
}

function emptyProject(): Project {
  const now = Date.now();
  const meta: ProjectMeta = {
    title: "Untitled",
    bpm: 120,
    timeSig: [4, 4],
    key: { tonic: "C", scale: "minor" },
    createdAt: now,
    updatedAt: now,
  };
  return {
    id: newId(),
    version: 1,
    meta,
    tracks: [createMetronomeTrack(), createMaster()],
    clips: {},
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
    arrangement: { lengthBars: 32 },
    markers: [],
  };
}

export interface ProjectState {
  project: Project;
  createEmptyProject: () => void;
  loadProject: (p: Project) => void;
  addTrack: (type: TrackType, name?: string) => string;
  removeTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  updateTrackMixer: (id: string, patch: Partial<TrackMixer>) => void;
  setBpm: (bpm: number) => void;
  setKey: (tonic: import("@/model/project").Pitch, scale: import("@/model/project").Scale) => void;
  setTitle: (title: string) => void;
  setLengthBars: (bars: number) => void;
  addClip: (
    trackId: string,
    type: Clip["type"],
    startBeat: number,
    lengthBeats: number,
    extra?: Partial<Clip>,
  ) => string;
  moveClip: (clipId: string, newStartBeat: number) => void;
  resizeClip: (clipId: string, newLengthBeats: number) => void;
  deleteClip: (clipId: string) => void;
  splitClip: (clipId: string, atBeat: number) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  setClipNotes: (clipId: string, notes: Note[]) => void;
  setClipSteps: (clipId: string, steps: Step[][]) => void;
  setClipSwing: (clipId: string, swing: number) => void;
  setLauncherSlot: (trackId: string, sceneIndex: number, clipId: string | null) => void;
  upsertDevice: (trackId: string, deviceKind: string) => string;
  removeDevice: (trackId: string, deviceId: string) => void;
  setDeviceParam: (trackId: string, deviceId: string, param: string, value: number) => void;
  setDeviceBypass: (trackId: string, deviceId: string, bypass: boolean) => void;
  setInstrument: (trackId: string, deviceKind: string) => void;
  setInstrumentParam: (trackId: string, param: string, value: number) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  project: emptyProject(),

  createEmptyProject: () => set({ project: emptyProject() }),

  loadProject: (p) => set({ project: p }),

  addTrack: (type, name) => {
    const id = newId();
    set(
      produce((s: ProjectState) => {
        const masterIdx = s.project.tracks.findIndex((t) => t.type === "master");
        const t = createTrack(type, name ?? defaultTrackName(type, s.project.tracks));
        t.id = id;
        if (masterIdx >= 0) s.project.tracks.splice(masterIdx, 0, t);
        else s.project.tracks.push(t);
        s.project.meta.updatedAt = Date.now();
      }),
    );
    return id;
  },

  removeTrack: (id) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === id);
        if (!t || t.type === "master" || t.name === "Metronome") return;
        const idx = s.project.tracks.findIndex((x) => x.id === id);
        if (idx >= 0) s.project.tracks.splice(idx, 1);
        for (const clipId of t.timelineClips) delete s.project.clips[clipId];
        for (const clipId of t.launcherSlots) if (clipId) delete s.project.clips[clipId];
      }),
    ),

  renameTrack: (id, name) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === id);
        if (t) t.name = name;
      }),
    ),

  updateTrackMixer: (id, patch) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === id);
        if (!t) return;
        Object.assign(t.mixer, patch);
      }),
    ),

  setBpm: (bpm) =>
    set(
      produce((s: ProjectState) => {
        s.project.meta.bpm = Math.max(20, Math.min(300, bpm));
      }),
    ),

  setKey: (tonic, scale) =>
    set(
      produce((s: ProjectState) => {
        s.project.meta.key = { tonic, scale };
      }),
    ),

  setTitle: (title) =>
    set(
      produce((s: ProjectState) => {
        s.project.meta.title = title;
      }),
    ),

  setLengthBars: (bars) =>
    set(
      produce((s: ProjectState) => {
        s.project.arrangement.lengthBars = Math.max(4, bars);
      }),
    ),

  addClip: (trackId, type, startBeat, lengthBeats, extra) => {
    const id = newId();
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (!t) return;
        const base = {
          id,
          trackId,
          name: t.name,
          startBeat,
          lengthBeats,
          loop: false,
        };
        let clip: Clip;
        if (type === "midi") {
          clip = { ...base, type: "midi", notes: [], ...(extra ?? {}) } as MidiClip;
        } else if (type === "pattern") {
          const stepCount = (extra as Partial<PatternClip>)?.stepCount ?? 16;
          const rows = 8;
          const steps: Step[][] = Array.from({ length: rows }, () =>
            Array.from({ length: stepCount }, () => ({ on: false, velocity: 0.8, micro: 0 })),
          );
          clip = {
            ...base,
            type: "pattern",
            steps,
            stepCount,
            swing: 0,
            ...(extra ?? {}),
          } as PatternClip;
        } else {
          clip = {
            ...base,
            type: "audio",
            sampleId: "",
            offsetBeats: 0,
            gainDb: 0,
            fadeInBeats: 0,
            fadeOutBeats: 0,
            pitchSemitones: 0,
            ...(extra ?? {}),
          } as AudioClip;
        }
        s.project.clips[id] = clip;
        t.timelineClips.push(id);
      }),
    );
    return id;
  },

  moveClip: (clipId, newStartBeat) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c) c.startBeat = Math.max(0, newStartBeat);
      }),
    ),

  resizeClip: (clipId, newLengthBeats) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c) c.lengthBeats = Math.max(0.25, newLengthBeats);
      }),
    ),

  deleteClip: (clipId) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (!c) return;
        const t = s.project.tracks.find((x) => x.id === c.trackId);
        if (t) {
          t.timelineClips = t.timelineClips.filter((id) => id !== clipId);
          t.launcherSlots = t.launcherSlots.map((id) => (id === clipId ? null : id));
        }
        delete s.project.clips[clipId];
      }),
    ),

  splitClip: (clipId, atBeat) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (!c) return;
        if (atBeat <= c.startBeat || atBeat >= c.startBeat + c.lengthBeats) return;
        const newLen = c.startBeat + c.lengthBeats - atBeat;
        const newId2 = newId();
        const cloned: Clip = JSON.parse(JSON.stringify(c));
        cloned.id = newId2;
        cloned.startBeat = atBeat;
        cloned.lengthBeats = newLen;
        c.lengthBeats = atBeat - c.startBeat;
        s.project.clips[newId2] = cloned;
        const t = s.project.tracks.find((x) => x.id === c.trackId);
        if (t) t.timelineClips.push(newId2);
      }),
    ),

  updateClip: (clipId, patch) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c) Object.assign(c, patch);
      }),
    ),

  setClipNotes: (clipId, notes) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c && c.type === "midi") c.notes = notes;
      }),
    ),

  setClipSteps: (clipId, steps) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c && c.type === "pattern") c.steps = steps;
      }),
    ),

  setClipSwing: (clipId, swing) =>
    set(
      produce((s: ProjectState) => {
        const c = s.project.clips[clipId];
        if (c && c.type === "pattern") c.swing = Math.max(0, Math.min(0.5, swing));
      }),
    ),

  setLauncherSlot: (trackId, sceneIndex, clipId) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (t && sceneIndex >= 0 && sceneIndex < t.launcherSlots.length) {
          t.launcherSlots[sceneIndex] = clipId;
        }
      }),
    ),

  upsertDevice: (trackId, deviceKind) => {
    const id = newId();
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (!t) return;
        t.devices.push({ id, kind: deviceKind, bypass: false, params: {} });
      }),
    );
    return id;
  },

  removeDevice: (trackId, deviceId) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (!t) return;
        t.devices = t.devices.filter((d) => d.id !== deviceId);
      }),
    ),

  setDeviceParam: (trackId, deviceId, param, value) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        const d = t?.devices.find((x) => x.id === deviceId);
        if (d) d.params[param] = value;
      }),
    ),

  setDeviceBypass: (trackId, deviceId, bypass) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        const d = t?.devices.find((x) => x.id === deviceId);
        if (d) d.bypass = bypass;
      }),
    ),

  setInstrument: (trackId, deviceKind) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (!t) return;
        t.instrument = { id: newId(), kind: deviceKind, bypass: false, params: {} };
      }),
    ),

  setInstrumentParam: (trackId, param, value) =>
    set(
      produce((s: ProjectState) => {
        const t = s.project.tracks.find((x) => x.id === trackId);
        if (t?.instrument) t.instrument.params[param] = value;
      }),
    ),
}));

function defaultTrackName(type: TrackType, existing: Track[]): string {
  const baseName: Record<TrackType, string> = {
    audio: "Audio",
    instrument: "Instrument",
    drum: "Drums",
    bus: "Bus",
    master: "Master",
  };
  const count = existing.filter((t) => t.type === type).length + 1;
  return `${baseName[type]} ${count}`;
}

export function getClipById(state: ProjectState, clipId: string): Clip | undefined {
  return state.project.clips[clipId];
}

export function getTrackById(state: ProjectState, trackId: string): Track | undefined {
  return state.project.tracks.find((t) => t.id === trackId);
}

export { emptyProject };
