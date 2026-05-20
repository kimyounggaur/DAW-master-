import { engine } from "./engine";
import { useTransportStore } from "@/state/transportStore";
import { useProjectStore } from "@/state/projectStore";
import { addProducer } from "./scheduler";

function scheduleClick(ctx: AudioContext, dest: AudioNode, when: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = accent ? 1000 : 800;
  const attack = 0.005;
  const release = accent ? 0.045 : 0.025;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.5, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + release);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + attack + release + 0.05);
}

let unsubProducer: (() => void) | null = null;
let scheduledBeats: Set<number> = new Set();

export function installMetronome(): () => void {
  if (unsubProducer) return unsubProducer;
  unsubProducer = addProducer((fromBeat, toBeat, beatToCtxTime) => {
    const ctx = engine.ctx;
    const dest = engine.bus;
    if (!ctx || !dest) return;
    const transport = useTransportStore.getState();
    if (!transport.metronomeOn) return;
    const timeSig = useProjectStore.getState().project.meta.timeSig;
    const beatsPerBar = timeSig[0];
    const firstBeat = Math.ceil(fromBeat * 1e6) / 1e6;
    let b = Math.ceil(firstBeat);
    while (b < toBeat) {
      const key = Math.round(b * 1000);
      if (!scheduledBeats.has(key)) {
        const when = beatToCtxTime(b);
        const accent = b % beatsPerBar === 0;
        scheduleClick(ctx, dest, when, accent);
        scheduledBeats.add(key);
      }
      b += 1;
    }
    // garbage-collect old scheduled beats
    if (scheduledBeats.size > 1024) {
      const cutoff = (fromBeat - 4) * 1000;
      scheduledBeats = new Set(Array.from(scheduledBeats).filter((k) => k > cutoff));
    }
  });
  return () => {
    unsubProducer?.();
    unsubProducer = null;
    scheduledBeats.clear();
  };
}

export function resetMetronomeMemory(): void {
  scheduledBeats.clear();
}
