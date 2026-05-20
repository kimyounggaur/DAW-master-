import { engine } from "../engine";
import { useProjectStore } from "@/state/projectStore";
import type { AudioDevice, Param } from "./types";
import { beatsToSeconds } from "@/model/time";

const PARAMS: Param[] = [
  { id: "timeMs", label: "Time", min: 1, max: 2000, default: 250, scale: "linear", unit: "ms" },
  { id: "sync", label: "Sync", min: 0, max: 3, default: 0, scale: "linear" }, // 0=off, 1=1/4, 2=1/8, 3=1/16
  { id: "feedback", label: "Feedback", min: 0, max: 0.95, default: 0.4, scale: "linear" },
  { id: "mix", label: "Mix", min: 0, max: 1, default: 0.3, scale: "linear" },
];

export function createDelay(): AudioDevice {
  const ctx = engine.ctx;
  if (!ctx) throw new Error("engine not ready");
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(2.0);
  const fb = ctx.createGain();

  input.connect(dry);
  input.connect(delay);
  delay.connect(wet);
  delay.connect(fb);
  fb.connect(delay);
  dry.connect(output);
  wet.connect(output);

  const values: Record<string, number> = {};
  for (const p of PARAMS) values[p.id] = p.default;

  const apply = () => {
    const sync = Math.round(values.sync ?? 0);
    let time = (values.timeMs ?? 250) / 1000;
    if (sync > 0) {
      const bpm = useProjectStore.getState().project.meta.bpm;
      const beats = sync === 1 ? 1 : sync === 2 ? 0.5 : 0.25;
      time = beatsToSeconds(beats, bpm);
    }
    delay.delayTime.setTargetAtTime(Math.max(0.001, time), ctx.currentTime, 0.01);
    fb.gain.value = values.feedback ?? 0.4;
    const mix = values.mix ?? 0.3;
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;
  };
  apply();

  const unsubProject = useProjectStore.subscribe(() => apply());

  return {
    kind: "delay",
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
      unsubProject();
      input.disconnect();
      output.disconnect();
      delay.disconnect();
      fb.disconnect();
      dry.disconnect();
      wet.disconnect();
    },
  };
}
