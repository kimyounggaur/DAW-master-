import { engine } from "../engine";
import type { AudioDevice, Param } from "./types";

const PARAMS: Param[] = [
  { id: "preset", label: "Preset", min: 0, max: 2, default: 1, scale: "linear" }, // 0=small,1=hall,2=plate
  { id: "size", label: "Size", min: 0.2, max: 3.0, default: 1.0, scale: "linear", unit: "s" },
  { id: "mix", label: "Mix", min: 0, max: 1, default: 0.3, scale: "linear" },
];

function generateIR(ctx: AudioContext, duration: number, decay: number, brightness: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * duration);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const noise = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      const filtered = prev + brightness * (noise - prev);
      prev = filtered;
      data[i] = filtered;
    }
  }
  return ir;
}

export function createReverb(): AudioDevice {
  const ctx = engine.ctx;
  if (!ctx) throw new Error("engine not ready");
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.normalize = true;

  input.connect(dry);
  input.connect(conv);
  conv.connect(wet);
  dry.connect(output);
  wet.connect(output);

  const values: Record<string, number> = {};
  for (const p of PARAMS) values[p.id] = p.default;

  const apply = () => {
    const presetIdx = Math.round(values.preset ?? 1);
    const size = values.size ?? 1.0;
    let dur: number;
    let decay: number;
    let bright: number;
    if (presetIdx === 0) { dur = 0.5 * size; decay = 4; bright = 0.5; }
    else if (presetIdx === 2) { dur = 1.5 * size; decay = 3; bright = 0.7; }
    else { dur = 2.2 * size; decay = 2.5; bright = 0.35; }
    conv.buffer = generateIR(ctx, Math.max(0.1, dur), decay, bright);
    const mix = values.mix ?? 0.3;
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;
  };
  apply();

  return {
    kind: "reverb",
    input,
    output,
    params: PARAMS,
    set: (id, v) => { values[id] = v; apply(); },
    get: (id) => values[id] ?? 0,
    setBypass: (b) => {
      dry.gain.value = b ? 1 : 1 - (values.mix ?? 0.3);
      wet.gain.value = b ? 0 : (values.mix ?? 0.3);
    },
    dispose: () => {
      input.disconnect();
      output.disconnect();
      conv.disconnect();
      dry.disconnect();
      wet.disconnect();
    },
  };
}
