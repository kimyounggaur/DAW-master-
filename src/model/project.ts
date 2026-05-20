import type { Track } from "./track";
import type { Clip } from "./clip";

export type Pitch = "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B";
export type Scale = "major" | "minor" | "dorian" | "mixolydian" | "phrygian" | "lydian" | "locrian";

export interface Marker {
  id: string;
  beat: number;
  name: string;
  color: string;
}

export interface Scene {
  id: string;
  name: string;
}

export interface ProjectMeta {
  title: string;
  bpm: number;
  timeSig: [number, number];
  key: { tonic: Pitch; scale: Scale };
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  version: 1;
  meta: ProjectMeta;
  tracks: Track[];
  clips: Record<string, Clip>;
  scenes: Scene[];
  arrangement: { lengthBars: number };
  markers: Marker[];
}
