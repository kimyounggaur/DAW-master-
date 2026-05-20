import { generatePeaks, type PeakData } from "@/audio/render/peaks";
import { getDecodedSample } from "./opfs";

const peakCache = new Map<string, PeakData>();
const inflight = new Map<string, Promise<PeakData | null>>();

export function getPeaksSync(sampleId: string): PeakData | null {
  return peakCache.get(sampleId) ?? null;
}

export async function getPeaks(sampleId: string): Promise<PeakData | null> {
  if (!sampleId) return null;
  if (peakCache.has(sampleId)) return peakCache.get(sampleId)!;
  if (inflight.has(sampleId)) return inflight.get(sampleId)!;
  const promise = (async () => {
    const buf = await getDecodedSample(sampleId);
    if (!buf) return null;
    const channels: Float32Array[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
    const peaks = generatePeaks(channels, buf.sampleRate);
    peakCache.set(sampleId, peaks);
    inflight.delete(sampleId);
    return peaks;
  })();
  inflight.set(sampleId, promise);
  return promise;
}

export type PeakListener = (sampleId: string, peaks: PeakData) => void;
const listeners = new Set<PeakListener>();

export function onPeaksReady(listener: PeakListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function preloadPeaks(sampleId: string): Promise<void> {
  const peaks = await getPeaks(sampleId);
  if (peaks) {
    for (const l of listeners) l(sampleId, peaks);
  }
}
