type Cleanup = () => void;

class Engine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  bus: GainNode | null = null;
  private inited = false;
  private resumeListeners = new Set<() => void>();

  async init(): Promise<void> {
    if (this.inited && this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) throw new Error("Web Audio API not supported");
    const ctx = new Ctx({ latencyHint: "interactive" });
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const bus = ctx.createGain();
    bus.gain.value = 1.0;
    bus.connect(master);
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.bus = bus;
    this.inited = true;
    if (ctx.state === "suspended") await ctx.resume();
    for (const fn of this.resumeListeners) fn();
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === "running") await this.ctx.suspend();
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get isReady(): boolean {
    return this.inited && this.ctx !== null;
  }

  onReady(cb: () => void): Cleanup {
    this.resumeListeners.add(cb);
    if (this.isReady) cb();
    return () => this.resumeListeners.delete(cb);
  }

  setMasterDb(db: number): void {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(dbToLinear(db), this.currentTime, 0.01);
  }
}

export const engine = new Engine();

export function dbToLinear(db: number): number {
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number): number {
  if (linear <= 0.0001) return -60;
  return 20 * Math.log10(linear);
}
