import { engine, dbToLinear } from "../engine";
import type { Track } from "@/model/track";
import { useProjectStore } from "@/state/projectStore";

export interface TrackNode {
  input: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
  output: GainNode;
  meter?: AnalyserNode;
}

const nodes = new Map<string, TrackNode>();

function createNode(ctx: AudioContext): TrackNode {
  const input = ctx.createGain();
  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const output = ctx.createGain();
  const meter = ctx.createAnalyser();
  meter.fftSize = 1024;
  input.connect(gain);
  gain.connect(pan);
  pan.connect(output);
  output.connect(meter);
  return { input, gain, pan, output, meter };
}

export function getOrCreateTrackNode(trackId: string): TrackNode | null {
  if (!engine.ctx || !engine.bus) return null;
  const existing = nodes.get(trackId);
  if (existing) return existing;
  const node = createNode(engine.ctx);
  node.output.connect(engine.bus);
  nodes.set(trackId, node);
  syncFromTrack(trackId);
  return node;
}

export function getTrackNode(trackId: string): TrackNode | null {
  return nodes.get(trackId) ?? null;
}

export function destroyTrackNode(trackId: string): void {
  const n = nodes.get(trackId);
  if (!n) return;
  n.input.disconnect();
  n.gain.disconnect();
  n.pan.disconnect();
  n.output.disconnect();
  n.meter?.disconnect();
  nodes.delete(trackId);
}

function effectiveMute(track: Track, allTracks: Track[]): boolean {
  if (track.mixer.muted) return true;
  const anySoloed = allTracks.some((t) => t.mixer.soloed && t.type !== "master");
  if (track.type === "master") return false;
  if (anySoloed && !track.mixer.soloed) return true;
  return false;
}

export function syncFromTrack(trackId: string): void {
  const ctx = engine.ctx;
  if (!ctx) return;
  const project = useProjectStore.getState().project;
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return;
  const node = getOrCreateTrackNode(trackId);
  if (!node) return;
  const muted = effectiveMute(track, project.tracks);
  node.gain.gain.setTargetAtTime(muted ? 0 : dbToLinear(track.mixer.volumeDb), ctx.currentTime, 0.01);
  node.pan.pan.setTargetAtTime(track.mixer.pan, ctx.currentTime, 0.01);
}

export function syncAll(): void {
  const project = useProjectStore.getState().project;
  for (const t of project.tracks) syncFromTrack(t.id);
}

export function subscribeMixerSync(): () => void {
  const onChange = () => syncAll();
  const unsubProject = useProjectStore.subscribe(onChange);
  const unsubReady = engine.onReady(() => syncAll());
  return () => {
    unsubProject();
    unsubReady();
  };
}

/** Reads RMS + Peak from the analyser (0..1 range, linear). */
export function readMeter(node: TrackNode): { rms: number; peak: number } {
  if (!node.meter) return { rms: 0, peak: 0 };
  const buf = new Float32Array(node.meter.fftSize);
  node.meter.getFloatTimeDomainData(buf);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] ?? 0;
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sum / buf.length);
  return { rms, peak };
}
