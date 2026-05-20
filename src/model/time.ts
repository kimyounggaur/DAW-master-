export function beatsToSamples(beats: number, bpm: number, sampleRate: number): number {
  return (beats * 60 * sampleRate) / bpm;
}

export function samplesToBeats(samples: number, bpm: number, sampleRate: number): number {
  return (samples * bpm) / (60 * sampleRate);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

export function barsToBeats(bars: number, timeSig: [number, number]): number {
  return bars * timeSig[0];
}

export function beatsToBars(beats: number, timeSig: [number, number]): number {
  return beats / timeSig[0];
}

export interface BarPos {
  bar: number;
  beat: number;
  sixteenth: number;
}

export function beatsToBarPos(beats: number, timeSig: [number, number]): BarPos {
  const beatsPerBar = timeSig[0];
  const bar = Math.floor(beats / beatsPerBar);
  const beatInBar = Math.floor(beats - bar * beatsPerBar);
  const fraction = beats - bar * beatsPerBar - beatInBar;
  const sixteenth = Math.floor(fraction * 4);
  return { bar: bar + 1, beat: beatInBar + 1, sixteenth: sixteenth + 1 };
}

export function snapBeat(beat: number, snap: "bar" | "beat" | "1/16", timeSig: [number, number]): number {
  const grid =
    snap === "bar" ? timeSig[0] : snap === "beat" ? 1 : 0.25;
  return Math.round(beat / grid) * grid;
}
