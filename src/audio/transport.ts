import { engine } from "./engine";
import { useTransportStore } from "@/state/transportStore";
import { useProjectStore } from "@/state/projectStore";
import { secondsToBeats } from "@/model/time";

type Cleanup = () => void;

let rafId: number | null = null;
let lastCtxTime = 0;
let lastBpm = 120;
let unsubStore: Cleanup | null = null;
let active = false;

function tick() {
  if (!active) return;
  const ctx = engine.ctx;
  if (!ctx) {
    rafId = requestAnimationFrame(tick);
    return;
  }
  const now = ctx.currentTime;
  const dt = now - lastCtxTime;
  lastCtxTime = now;

  const t = useTransportStore.getState();
  if (t.isPlaying) {
    const beatsAdvance = secondsToBeats(dt, lastBpm);
    let next = t.positionBeats + beatsAdvance;
    if (t.loop.enabled && next >= t.loop.endBeat) {
      next = t.loop.startBeat + ((next - t.loop.startBeat) % (t.loop.endBeat - t.loop.startBeat));
    }
    useTransportStore.setState({ positionBeats: next });
  }
  rafId = requestAnimationFrame(tick);
}

export function startTransportClock(): Cleanup {
  if (active) return stopTransportClock;
  active = true;
  lastCtxTime = engine.ctx?.currentTime ?? 0;
  lastBpm = useProjectStore.getState().project.meta.bpm;
  unsubStore = useProjectStore.subscribe((s) => {
    lastBpm = s.project.meta.bpm;
  });
  rafId = requestAnimationFrame(tick);
  return stopTransportClock;
}

export function stopTransportClock(): void {
  active = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  unsubStore?.();
  unsubStore = null;
}

export async function ensureTransportRunning(): Promise<void> {
  await engine.init();
  if (!active) startTransportClock();
}
