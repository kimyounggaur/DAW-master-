import { engine } from "../engine";
import type { AudioDevice, Param } from "./types";

const PARAMS: Param[] = [
  { id: "lowFreq", label: "Low Freq", min: 40, max: 250, default: 80, scale: "log", unit: "Hz" },
  { id: "lowGain", label: "Low", min: -18, max: 18, default: 0, scale: "linear", unit: "dB" },
  { id: "midFreq", label: "Mid Freq", min: 250, max: 5000, default: 1000, scale: "log", unit: "Hz" },
  { id: "midGain", label: "Mid", min: -18, max: 18, default: 0, scale: "linear", unit: "dB" },
  { id: "midQ", label: "Mid Q", min: 0.1, max: 5, default: 1, scale: "linear" },
  { id: "highFreq", label: "High Freq", min: 4000, max: 16000, default: 8000, scale: "log", unit: "Hz" },
  { id: "highGain", label: "High", min: -18, max: 18, default: 0, scale: "linear", unit: "dB" },
];

export function createEq3(ctxOverride?: BaseAudioContext): AudioDevice {
  const ctx = (ctxOverride ?? engine.ctx) as AudioContext;
  if (!ctx) throw new Error("engine not ready");
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0;
  const wet = ctx.createGain();
  wet.gain.value = 1;
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";

  input.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(wet);
  wet.connect(output);
  input.connect(dry);
  dry.connect(output);

  const values: Record<string, number> = {};
  for (const p of PARAMS) values[p.id] = p.default;

  const apply = () => {
    low.frequency.value = values.lowFreq ?? 80;
    low.gain.value = values.lowGain ?? 0;
    mid.frequency.value = values.midFreq ?? 1000;
    mid.Q.value = values.midQ ?? 1;
    mid.gain.value = values.midGain ?? 0;
    high.frequency.value = values.highFreq ?? 8000;
    high.gain.value = values.highGain ?? 0;
  };
  apply();

  return {
    kind: "eq3",
    input,
    output,
    params: PARAMS,
    set: (id, v) => { values[id] = v; apply(); },
    get: (id) => values[id] ?? 0,
    setBypass: (b) => {
      dry.gain.value = b ? 1 : 0;
      wet.gain.value = b ? 0 : 1;
    },
    dispose: () => {
      input.disconnect();
      output.disconnect();
      low.disconnect();
      mid.disconnect();
      high.disconnect();
      wet.disconnect();
      dry.disconnect();
    },
  };
}
