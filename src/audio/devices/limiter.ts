import { engine } from "../engine";
import type { AudioDevice, Param } from "./types";

const PARAMS: Param[] = [
  { id: "threshold", label: "Threshold", min: -24, max: 0, default: -1, scale: "linear", unit: "dB" },
];

export function createLimiter(ctxOverride?: BaseAudioContext): AudioDevice {
  const ctx = (ctxOverride ?? engine.ctx) as AudioContext;
  if (!ctx) throw new Error("engine not ready");
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0;
  const wet = ctx.createGain();
  wet.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.knee.value = 0;
  comp.ratio.value = 20;
  comp.attack.value = 0.001;
  comp.release.value = 0.05;

  input.connect(comp);
  comp.connect(wet);
  wet.connect(output);
  input.connect(dry);
  dry.connect(output);

  const values: Record<string, number> = {};
  for (const p of PARAMS) values[p.id] = p.default;

  const apply = () => {
    comp.threshold.value = values.threshold ?? -1;
  };
  apply();

  return {
    kind: "limiter",
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
      dry.disconnect();
      wet.disconnect();
    },
  };
}
