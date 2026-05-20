export interface PeakLevel {
  ratio: number;
  min: Float32Array;
  max: Float32Array;
}

export interface PeakData {
  duration: number;
  sampleRate: number;
  levels: PeakLevel[];
}

const LEVEL_RATIOS = [256, 1024, 4096];

export function generatePeaks(channelData: Float32Array[], sampleRate: number): PeakData {
  // mix to mono if needed
  const len = channelData[0]?.length ?? 0;
  const mono = new Float32Array(len);
  for (const ch of channelData) {
    for (let i = 0; i < len; i++) mono[i] = (mono[i] ?? 0) + (ch[i] ?? 0);
  }
  for (let i = 0; i < len; i++) mono[i] = (mono[i] ?? 0) / channelData.length;

  const levels: PeakLevel[] = LEVEL_RATIOS.map((ratio) => {
    const buckets = Math.ceil(len / ratio);
    const min = new Float32Array(buckets);
    const max = new Float32Array(buckets);
    for (let b = 0; b < buckets; b++) {
      const start = b * ratio;
      const end = Math.min(len, start + ratio);
      let lo = 0;
      let hi = 0;
      for (let i = start; i < end; i++) {
        const v = mono[i] ?? 0;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      min[b] = lo;
      max[b] = hi;
    }
    return { ratio, min, max };
  });

  return { duration: len / sampleRate, sampleRate, levels };
}

export function pickLevel(peaks: PeakData, samplesPerPixel: number): PeakLevel | null {
  if (peaks.levels.length === 0) return null;
  // pick smallest ratio >= samplesPerPixel
  for (const lvl of peaks.levels) {
    if (lvl.ratio >= samplesPerPixel) return lvl;
  }
  return peaks.levels[peaks.levels.length - 1] ?? null;
}
