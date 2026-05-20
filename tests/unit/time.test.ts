import { describe, it, expect } from "vitest";
import {
  beatsToSamples,
  samplesToBeats,
  barsToBeats,
  beatsToBars,
  beatsToBarPos,
  beatsToSeconds,
  snapBeat,
} from "@/model/time";

describe("time conversion", () => {
  it("beatsToSamples at 120bpm and 48000Hz", () => {
    expect(beatsToSamples(1, 120, 48000)).toBe(24000);
    expect(beatsToSamples(4, 120, 48000)).toBe(96000);
  });

  it("samplesToBeats is inverse of beatsToSamples", () => {
    const samples = beatsToSamples(7.5, 140, 44100);
    expect(samplesToBeats(samples, 140, 44100)).toBeCloseTo(7.5, 8);
  });

  it("barsToBeats with 4/4", () => {
    expect(barsToBeats(4, [4, 4])).toBe(16);
    expect(barsToBeats(2, [3, 4])).toBe(6);
  });

  it("beatsToBars is inverse of barsToBeats", () => {
    expect(beatsToBars(barsToBeats(5, [4, 4]), [4, 4])).toBe(5);
  });

  it("beatsToBarPos", () => {
    expect(beatsToBarPos(0, [4, 4])).toEqual({ bar: 1, beat: 1, sixteenth: 1 });
    expect(beatsToBarPos(5.25, [4, 4])).toEqual({ bar: 2, beat: 2, sixteenth: 2 });
  });

  it("beatsToSeconds at 120bpm", () => {
    expect(beatsToSeconds(4, 120)).toBe(2);
  });

  it("snapBeat", () => {
    expect(snapBeat(0.3, "beat", [4, 4])).toBe(0);
    expect(snapBeat(0.6, "beat", [4, 4])).toBe(1);
    expect(snapBeat(2.3, "bar", [4, 4])).toBe(4);
    expect(snapBeat(0.3, "1/16", [4, 4])).toBe(0.25);
  });
});
