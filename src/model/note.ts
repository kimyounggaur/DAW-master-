export interface Note {
  id: string;
  pitch: number;
  startBeat: number;
  lengthBeats: number;
  velocity: number;
}

export interface Step {
  on: boolean;
  velocity: number;
  micro: number;
}
