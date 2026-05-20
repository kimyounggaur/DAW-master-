import { engine } from "./engine";
import { useTransportStore } from "@/state/transportStore";
import { useProjectStore } from "@/state/projectStore";
import { secondsToBeats, beatsToSeconds } from "@/model/time";

export interface ScheduleEvent {
  /** ctx time when event should fire */
  when: number;
  /** beat position at the time of event */
  beat: number;
}

export type EventProducer = (
  /** start beat (inclusive) */
  fromBeat: number,
  /** end beat (exclusive) */
  toBeat: number,
  /** translate beat → ctx time */
  beatToCtxTime: (beat: number) => number,
) => void;

const LOOKAHEAD_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

let timerId: ReturnType<typeof setInterval> | null = null;
let nextScheduleBeat = 0;
let lastCtxTime = 0;
let producers: Set<EventProducer> = new Set();
let prevPlaying = false;

function scheduleStep() {
  const ctx = engine.ctx;
  if (!ctx) return;
  const t = useTransportStore.getState();
  const bpm = useProjectStore.getState().project.meta.bpm;

  if (!t.isPlaying) {
    nextScheduleBeat = t.positionBeats;
    lastCtxTime = ctx.currentTime;
    prevPlaying = false;
    return;
  }

  if (!prevPlaying) {
    nextScheduleBeat = t.positionBeats;
    lastCtxTime = ctx.currentTime;
    prevPlaying = true;
  }

  const horizonCtx = ctx.currentTime + SCHEDULE_AHEAD_S;
  // horizon in beats relative to scheduling cursor
  const ctxToBeat = (ctxTime: number) =>
    nextScheduleBeat + secondsToBeats(ctxTime - lastCtxTime, bpm);
  const beatToCtxTime = (beat: number) =>
    lastCtxTime + beatsToSeconds(beat - nextScheduleBeat, bpm);

  const horizonBeat = ctxToBeat(horizonCtx);
  if (horizonBeat <= nextScheduleBeat) return;

  // honor loop
  const loop = t.loop;
  if (loop.enabled && horizonBeat >= loop.endBeat) {
    // schedule up to loop end
    for (const p of producers) p(nextScheduleBeat, loop.endBeat, beatToCtxTime);
    const loopEndCtx = beatToCtxTime(loop.endBeat);
    // wrap to loopStart
    nextScheduleBeat = loop.startBeat;
    lastCtxTime = loopEndCtx;
    return;
  }

  for (const p of producers) p(nextScheduleBeat, horizonBeat, beatToCtxTime);
  // advance cursor
  lastCtxTime = horizonCtx;
  nextScheduleBeat = horizonBeat;
}

export function startScheduler(): void {
  if (timerId !== null) return;
  timerId = setInterval(scheduleStep, LOOKAHEAD_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
}

export function addProducer(p: EventProducer): () => void {
  producers.add(p);
  return () => producers.delete(p);
}

export function clearProducers(): void {
  producers = new Set();
}

/** Reset schedule cursor when user seeks. */
export function resyncSchedule(): void {
  const ctx = engine.ctx;
  if (!ctx) return;
  nextScheduleBeat = useTransportStore.getState().positionBeats;
  lastCtxTime = ctx.currentTime;
  prevPlaying = false;
}
