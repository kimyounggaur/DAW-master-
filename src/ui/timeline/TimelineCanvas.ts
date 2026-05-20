import type { Project } from "@/model/project";
import type { Clip } from "@/model/clip";
import type { Track } from "@/model/track";
import { setupHiDPI, clear, strokeLineV, strokeLineH, readCssVar } from "@/lib/canvas";
import { buildLayout, HEADER_W, RULER_H, beatToX, xToBeat, getTrackAtY } from "./timelineGeom";
import { beatsToBarPos, beatsToSeconds } from "@/model/time";
import { getPeaksSync, getPeaks, onPeaksReady } from "@/storage/peakCache";
import { pickLevel } from "@/audio/render/peaks";

export interface TimelineDeps {
  getProject: () => Project;
  getZoomX: () => number;
  getZoomY: () => number;
  getScrollX: () => number;
  getScrollY: () => number;
  getPositionBeats: () => number;
  getSelectedClipId: () => string | null;
  getSelectedTrackId: () => string | null;
  getLoop: () => { enabled: boolean; startBeat: number; endBeat: number };
}

export type HitResult =
  | { kind: "empty"; trackId: string | null; beat: number }
  | { kind: "ruler"; beat: number }
  | { kind: "track-header"; trackId: string }
  | {
      kind: "clip";
      clipId: string;
      handle: "body" | "right" | "left";
    };

export class TimelineCanvas {
  private ctx: CanvasRenderingContext2D;
  private dirty = true;
  private cssW = 0;
  private cssH = 0;
  private rafId: number | null = null;

  private unsubPeaks: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private deps: TimelineDeps,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    this.unsubPeaks = onPeaksReady(() => this.invalidate());
    this.loop();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width !== this.cssW || rect.height !== this.cssH) {
      this.cssW = rect.width;
      this.cssH = rect.height;
      this.ctx = setupHiDPI(this.canvas, this.cssW, this.cssH);
      this.dirty = true;
    }
  }

  invalidate() {
    this.dirty = true;
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.unsubPeaks?.();
    this.unsubPeaks = null;
  }

  hitTest(x: number, y: number): HitResult {
    const project = this.deps.getProject();
    const layout = buildLayout(project);

    if (y < RULER_H && x >= HEADER_W) {
      return { kind: "ruler", beat: xToBeat(x, this.deps.getZoomX(), this.deps.getScrollX()) };
    }
    if (x < HEADER_W) {
      const t = getTrackAtY(layout, project, y);
      if (t) return { kind: "track-header", trackId: t.id };
      return { kind: "empty", trackId: null, beat: 0 };
    }

    const track = getTrackAtY(layout, project, y);
    if (!track) return { kind: "empty", trackId: null, beat: 0 };
    const beat = xToBeat(x, this.deps.getZoomX(), this.deps.getScrollX());

    for (const clipId of track.timelineClips) {
      const c = project.clips[clipId];
      if (!c) continue;
      if (beat >= c.startBeat && beat <= c.startBeat + c.lengthBeats) {
        const clipEndX = beatToX(c.startBeat + c.lengthBeats, this.deps.getZoomX(), this.deps.getScrollX());
        const handle: "body" | "right" | "left" = x > clipEndX - 5 ? "right" : "body";
        return { kind: "clip", clipId, handle };
      }
    }
    return { kind: "empty", trackId: track.id, beat };
  }

  private loop = () => {
    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    // playhead always animated
    this.renderPlayhead();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderPlayhead() {
    if (this.cssW === 0) return;
    const ctx = this.ctx;
    const zoomX = this.deps.getZoomX();
    const scrollX = this.deps.getScrollX();
    const x = beatToX(this.deps.getPositionBeats(), zoomX, scrollX);
    if (x < HEADER_W - 1 || x > this.cssW) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(HEADER_W, 0, this.cssW - HEADER_W, this.cssH);
    ctx.clip();
    ctx.strokeStyle = readCssVar("--accent", "#ff8c3a");
    ctx.lineWidth = 1.5;
    strokeLineV(ctx, x, 0, this.cssH);
    ctx.restore();
  }

  render() {
    if (this.cssW === 0 || this.cssH === 0) return;
    const ctx = this.ctx;
    const project = this.deps.getProject();
    const layout = buildLayout(project);
    const zoomX = this.deps.getZoomX();
    const scrollX = this.deps.getScrollX();
    const scrollY = this.deps.getScrollY();
    const selectedClipId = this.deps.getSelectedClipId();
    const selectedTrackId = this.deps.getSelectedTrackId();
    const timeSig = project.meta.timeSig;

    const bg0 = readCssVar("--bg-0", "#0e0f12");
    const bg1 = readCssVar("--bg-1", "#14161b");
    const bg2 = readCssVar("--bg-2", "#1c1f26");
    const fg1 = readCssVar("--fg-1", "#a8aebb");
    const fg2 = readCssVar("--fg-2", "#6b7280");
    const border = readCssVar("--border", "#2a2e38");
    const accent2 = readCssVar("--accent-2", "#2dd4bf");

    clear(ctx, this.cssW, this.cssH, bg0);

    // Ruler background
    ctx.fillStyle = bg2;
    ctx.fillRect(HEADER_W, 0, this.cssW - HEADER_W, RULER_H);

    // Track header background
    ctx.fillStyle = bg1;
    ctx.fillRect(0, 0, HEADER_W, this.cssH);

    // Track rows
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RULER_H, this.cssW, this.cssH - RULER_H);
    ctx.clip();
    ctx.translate(0, -scrollY);
    for (const t of project.tracks) {
      const top = layout.trackTops.get(t.id) ?? 0;
      ctx.fillStyle = t.id === selectedTrackId ? bg2 : bg1;
      ctx.fillRect(0, top, HEADER_W, t.height);
      ctx.fillStyle = bg0;
      ctx.fillRect(HEADER_W, top, this.cssW - HEADER_W, t.height);

      // track color band
      ctx.fillStyle = t.color;
      ctx.fillRect(0, top, 3, t.height);

      // track name
      ctx.fillStyle = fg1;
      ctx.font = "12px Inter, system-ui";
      ctx.textBaseline = "middle";
      ctx.fillText(t.name, 10, top + t.height / 2);

      // mute/solo indicators
      const indicatorY = top + t.height / 2;
      if (t.mixer.muted) {
        ctx.fillStyle = readCssVar("--danger", "#ef4444");
        ctx.fillText("M", HEADER_W - 50, indicatorY);
      }
      if (t.mixer.soloed) {
        ctx.fillStyle = accent2;
        ctx.fillText("S", HEADER_W - 30, indicatorY);
      }

      // bottom border
      ctx.strokeStyle = border;
      strokeLineH(ctx, top + t.height - 0.5, 0, this.cssW);

      // grid
      drawGridForTrack(
        ctx,
        top,
        t.height,
        zoomX,
        scrollX,
        this.cssW,
        timeSig,
        bg2,
        border,
      );

      // clips
      for (const clipId of t.timelineClips) {
        const c = project.clips[clipId];
        if (!c) continue;
        drawClip(ctx, c, t, top, zoomX, scrollX, c.id === selectedClipId, accent2, project.meta.bpm);
      }
    }
    ctx.restore();

    // Loop region (in ruler)
    const loop = this.deps.getLoop();
    if (loop.enabled) {
      const x0 = beatToX(loop.startBeat, zoomX, scrollX);
      const x1 = beatToX(loop.endBeat, zoomX, scrollX);
      ctx.fillStyle = "rgba(45, 212, 191, 0.18)";
      ctx.fillRect(Math.max(HEADER_W, x0), 0, Math.max(0, x1 - Math.max(HEADER_W, x0)), RULER_H);
    }

    // Ruler ticks
    drawRulerTicks(ctx, RULER_H, zoomX, scrollX, this.cssW, timeSig, fg1, fg2, border);

    // Borders
    ctx.strokeStyle = border;
    strokeLineH(ctx, RULER_H, 0, this.cssW);
    strokeLineV(ctx, HEADER_W, 0, this.cssH);

    // Playhead
    this.renderPlayhead();
  }
}

function drawGridForTrack(
  ctx: CanvasRenderingContext2D,
  top: number,
  height: number,
  zoomX: number,
  scrollX: number,
  cssW: number,
  timeSig: [number, number],
  beatColor: string,
  barColor: string,
) {
  const beatsPerBar = timeSig[0];
  const startBeat = Math.max(0, Math.floor((scrollX) / zoomX));
  const endBeat = Math.ceil((scrollX + cssW - HEADER_W) / zoomX) + 1;
  ctx.lineWidth = 1;
  for (let b = startBeat; b <= endBeat; b++) {
    const x = beatToX(b, zoomX, scrollX);
    if (x < HEADER_W) continue;
    const isBar = b % beatsPerBar === 0;
    ctx.strokeStyle = isBar ? barColor : beatColor;
    strokeLineV(ctx, x, top, top + height);
  }
}

function drawRulerTicks(
  ctx: CanvasRenderingContext2D,
  rulerH: number,
  zoomX: number,
  scrollX: number,
  cssW: number,
  timeSig: [number, number],
  fg1: string,
  fg2: string,
  border: string,
) {
  const beatsPerBar = timeSig[0];
  const startBeat = Math.max(0, Math.floor(scrollX / zoomX));
  const endBeat = Math.ceil((scrollX + cssW - HEADER_W) / zoomX) + 1;

  ctx.font = "10px Inter, system-ui";
  ctx.textBaseline = "middle";
  for (let b = startBeat; b <= endBeat; b++) {
    const x = beatToX(b, zoomX, scrollX);
    if (x < HEADER_W) continue;
    const isBar = b % beatsPerBar === 0;
    ctx.strokeStyle = isBar ? border : "transparent";
    if (isBar) strokeLineV(ctx, x, 0, rulerH);
    if (isBar) {
      const pos = beatsToBarPos(b, timeSig);
      ctx.fillStyle = fg1;
      ctx.fillText(`${pos.bar}`, x + 4, rulerH / 2);
    } else if (zoomX > 60) {
      ctx.fillStyle = fg2;
      ctx.fillText(`.${(b % beatsPerBar) + 1}`, x + 2, rulerH / 2);
    }
  }
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  track: Track,
  trackTop: number,
  zoomX: number,
  scrollX: number,
  selected: boolean,
  selColor: string,
  bpm: number,
) {
  const x0 = beatToX(clip.startBeat, zoomX, scrollX);
  const x1 = beatToX(clip.startBeat + clip.lengthBeats, zoomX, scrollX);
  if (x1 < HEADER_W || x0 > 10000) return;
  const w = Math.max(2, x1 - x0);
  const padding = 4;
  const y = trackTop + padding;
  const h = track.height - padding * 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.max(HEADER_W, x0), y, w - Math.max(0, HEADER_W - x0), h);
  ctx.clip();

  ctx.fillStyle = track.color + "55";
  ctx.fillRect(x0, y, w, h);
  ctx.strokeStyle = selected ? selColor : track.color;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, h - 1);

  // header strip
  ctx.fillStyle = track.color;
  ctx.fillRect(x0, y, w, 12);
  ctx.fillStyle = "#fff";
  ctx.font = "10px Inter, system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText(clip.name, x0 + 4, y + 6);

  // content per type
  if (clip.type === "audio") {
    drawAudioWaveform(ctx, clip, x0, y + 14, w, h - 18, zoomX, bpm);
  } else if (clip.type === "midi") {
    drawMidiNotes(ctx, clip, x0, y + 14, w, h - 18);
  } else if (clip.type === "pattern") {
    drawPatternDots(ctx, clip, x0, y + 14, w, h - 18);
  }

  // type label
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "9px Inter, system-ui";
  ctx.fillText(clip.type, x0 + 4, y + h - 8);

  ctx.restore();
}

function drawAudioWaveform(
  ctx: CanvasRenderingContext2D,
  clip: import("@/model/clip").AudioClip,
  x: number,
  y: number,
  w: number,
  h: number,
  zoomX: number,
  bpm: number,
) {
  if (!clip.sampleId) return;
  let peaks = getPeaksSync(clip.sampleId);
  if (!peaks) {
    void getPeaks(clip.sampleId);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    return;
  }
  const samplesPerBeat = (peaks.sampleRate * beatsToSeconds(1, bpm));
  const samplesPerPx = samplesPerBeat / zoomX;
  const lvl = pickLevel(peaks, samplesPerPx);
  if (!lvl) return;

  const center = y + h / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const totalBuckets = lvl.min.length;
  for (let px = 0; px < w; px++) {
    const t = px / w;
    const bucket = Math.floor(t * totalBuckets);
    const mn = lvl.min[bucket] ?? 0;
    const mx = lvl.max[bucket] ?? 0;
    const cx = x + px + 0.5;
    ctx.moveTo(cx, center + mn * (h / 2 - 1));
    ctx.lineTo(cx, center + mx * (h / 2 - 1));
  }
  ctx.stroke();
}

function drawMidiNotes(
  ctx: CanvasRenderingContext2D,
  clip: import("@/model/clip").MidiClip,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (clip.notes.length === 0) return;
  let lo = 127;
  let hi = 0;
  for (const n of clip.notes) {
    if (n.pitch < lo) lo = n.pitch;
    if (n.pitch > hi) hi = n.pitch;
  }
  const range = Math.max(1, hi - lo + 1);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const n of clip.notes) {
    const nx = x + (n.startBeat / clip.lengthBeats) * w;
    const nw = Math.max(1, (n.lengthBeats / clip.lengthBeats) * w);
    const ny = y + (1 - (n.pitch - lo + 1) / range) * (h - 2);
    ctx.fillRect(nx, ny, nw, 2);
  }
}

function drawPatternDots(
  ctx: CanvasRenderingContext2D,
  clip: import("@/model/clip").PatternClip,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rows = clip.steps.length;
  const cellH = h / rows;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (let r = 0; r < rows; r++) {
    const row = clip.steps[r];
    if (!row) continue;
    for (let st = 0; st < row.length; st++) {
      const cell = row[st];
      if (!cell?.on) continue;
      const cx = x + (st / row.length) * w + 1;
      const cw = Math.max(1, w / row.length - 2);
      ctx.fillRect(cx, y + r * cellH + cellH / 2, cw, 1.5);
    }
  }
}

// re-export for hit testing in handlers
export { HEADER_W, RULER_H };
export { buildLayout, beatToX, xToBeat, getTrackAtY } from "./timelineGeom";
