import type { AudioDevice } from "./types";
import { createEq3 } from "./eq3";
import { createCompressor } from "./compressor";
import { createDelay } from "./delay";
import { createReverb } from "./reverb";
import { createLimiter } from "./limiter";

const FACTORIES: Record<string, () => AudioDevice> = {
  eq3: createEq3,
  compressor: createCompressor,
  delay: createDelay,
  reverb: createReverb,
  limiter: createLimiter,
};

export const DEVICE_KINDS = Object.keys(FACTORIES);

export const DEVICE_LABELS: Record<string, string> = {
  eq3: "EQ3",
  compressor: "Compressor",
  delay: "Delay",
  reverb: "Reverb",
  limiter: "Limiter",
};

export function createDevice(kind: string): AudioDevice | null {
  const f = FACTORIES[kind];
  if (!f) return null;
  return f();
}
