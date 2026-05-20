import { engine } from "../engine";
import { createDrumSampler, type DrumSampler } from "./drumSampler";
import { createSimpleSynth, type SimpleSynth } from "./simpleSynth";
import { getOrCreateTrackNode } from "../tracks/trackGraph";
import { useProjectStore } from "@/state/projectStore";

export type InstrumentInstance =
  | { kind: "drumSampler"; impl: DrumSampler }
  | { kind: "simpleSynth"; impl: SimpleSynth };

const instruments = new Map<string, InstrumentInstance>();

export function getOrCreateInstrument(trackId: string): InstrumentInstance | null {
  if (!engine.ctx) return null;
  const project = useProjectStore.getState().project;
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track || !track.instrument) return null;
  const cached = instruments.get(trackId);
  if (cached && cached.kind === track.instrument.kind) return cached;

  // dispose old
  if (cached) disposeInstrument(trackId);

  const node = getOrCreateTrackNode(trackId);
  if (!node) return null;

  if (track.instrument.kind === "drumSampler") {
    const impl = createDrumSampler();
    impl.output.connect(node.input);
    const inst: InstrumentInstance = { kind: "drumSampler", impl };
    instruments.set(trackId, inst);
    void impl.load();
    return inst;
  }
  if (track.instrument.kind === "simpleSynth") {
    const impl = createSimpleSynth();
    impl.output.connect(node.input);
    const inst: InstrumentInstance = { kind: "simpleSynth", impl };
    instruments.set(trackId, inst);
    return inst;
  }
  return null;
}

export function getInstrument(trackId: string): InstrumentInstance | null {
  return instruments.get(trackId) ?? null;
}

export function disposeInstrument(trackId: string): void {
  const inst = instruments.get(trackId);
  if (!inst) return;
  if (inst.kind === "drumSampler") inst.impl.output.disconnect();
  if (inst.kind === "simpleSynth") {
    inst.impl.output.disconnect();
    inst.impl.dispose();
  }
  instruments.delete(trackId);
}

export function ensureAllInstruments(): void {
  const project = useProjectStore.getState().project;
  for (const t of project.tracks) {
    if (t.instrument) getOrCreateInstrument(t.id);
  }
}
