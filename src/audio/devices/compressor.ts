import { engine } from "../engine";
import type { AudioDevice, Param } from "./types";

const PARAMS: Param[] = [
  { id: "threshold", label: "Threshold", min: -60, max: 0, default: -18, scale: "linear", unit: "dB" },
  { id: "ratio", label: "Ratio", min: 1, max: 20, default: 4, scale: "linear" },
  { id: "knee", label: "Knee", min: 0, max: 40, default: 30, scale: "linear", unit: "dB" },
  { id: "attack", label: "Attack", min: 0, max: 1, default: 0.003, scale: "linear", unit: "s" },
  { id: "release", label: "Release", min: 0.01, max: 1, default: 0.25, scale: "linear", unit: "s" },
  { id: "makeup", label: "Makeup", min: 0, max: 24, default: 0, scale: "linear", unit: "dB" },
];

export function createCompressor(ctxOverride?: BaseAudioContext): AudioDevice {
  const ctx = (ctxOverride ?? engine.ctx) as AudioContext;
  if (!ctx) throw new Error("engine not ready");
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0;
  const wet = ctx.createGain();
  wet.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  const makeup = ctx.createGain();

  input.connect(comp);
  comp.connect(makeup);
  makeup.connect(wet);
  wet.connect(output);
  input.connect(dry);
  dry.connect(output);

  const values: Record<string, number> = {};
  for (const p of PARAMS) values[p.id] = p.default;

  const apply = () => {
    comp.threshold.value = values.threshold ?? -18;
    comp.ratio.value = values.ratio ?? 4;
    comp.knee.value = values.knee ?? 30;
    comp.attack.value = values.attack ?? 0.003;
    comp.release.value = values.release ?? 0.25;
    makeup.gain.value = Math.pow(10, (values.makeup ?? 0) / 20);
  };
  apply();

  return {
    kind: "compressor",
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
      comp.disconnect();
      makeup.disconnect();
      dry.disconnect();
      wet.disconnect();
    },
  };
}
