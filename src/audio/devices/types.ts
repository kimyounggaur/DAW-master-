export type ParamScale = "linear" | "log" | "db";

export interface Param {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  scale: ParamScale;
  unit?: string;
  step?: number;
}

export interface AudioDevice {
  kind: string;
  input: GainNode;
  output: GainNode;
  params: Param[];
  set: (id: string, value: number) => void;
  get: (id: string) => number;
  setBypass: (bypass: boolean) => void;
  dispose: () => void;
}
