import type { Note, Step } from "./note";

export interface ClipBase {
  id: string;
  trackId: string;
  name: string;
  startBeat: number;
  lengthBeats: number;
  loop: boolean;
}

export interface AudioClip extends ClipBase {
  type: "audio";
  sampleId: string;
  offsetBeats: number;
  gainDb: number;
  fadeInBeats: number;
  fadeOutBeats: number;
  pitchSemitones: number;
}

export interface MidiClip extends ClipBase {
  type: "midi";
  notes: Note[];
}

export interface PatternClip extends ClipBase {
  type: "pattern";
  steps: Step[][];
  stepCount: 16 | 32;
  swing: number;
}

export type Clip = AudioClip | MidiClip | PatternClip;
export type ClipType = Clip["type"];
