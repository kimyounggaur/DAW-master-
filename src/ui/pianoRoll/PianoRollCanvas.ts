import type { MidiClip } from "@/model/clip";
import type { Note } from "@/model/note";
import type { Pitch, Scale } from "@/model/project";
import { setupHiDPI, clear, strokeLineV, strokeLineH, readCssVar } from "@/lib/canvas";

export interface PianoRollDeps {
  getClip: () => MidiClip | null;
  getKey: () => { tonic: Pitch; scale: Scale };
  getZoomX: () => number; // px per beat
  getPositionBeats: () => number;
  getClipStartBeat: () => number;
  getSelectedNoteIds: () => Set<string>;
}

export const KEY_W = 60;
export const NOTE_H = 12;
export const TOP_PAD = 0;
export const NUM_PITCHES = 96; // C0..B7

const SCALE_INTERVALS: Record<Scale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

const PITCH_INDEX: Record<Pitch, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export type PrHit =
  | { kind: "empty"; pitch: number; beat: number }
  | { kind: "key"; pitch: number }
  | { kind: "note"; noteId: string; handle: "body" | "right" };

export class PianoRollCanvas {
  private ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dirty = true;
  private rafId: number | null = null;
  scrollY = NOTE_H * 32; // start view around middle (C3 area)

  constructor(
    private canvas: HTMLCanvasElement,
    private deps: PianoRollDeps,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
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
  }

  hitTest(x: number, y: number): PrHit {
    const pitchIdx = Math.floor((y + this.scrollY - TOP_PAD) / NOTE_H);
    const pitch = NUM_PITCHES - 1 - pitchIdx;
    if (x < KEY_W) return { kind: "key", pitch };
    const beat = (x - KEY_W) / this.deps.getZoomX();
    const clip = this.deps.getClip();
    if (clip) {
      for (const n of clip.notes) {
        if (n.pitch !== pitch) continue;
        if (beat >= n.startBeat && beat <= n.startBeat + n.lengthBeats) {
          const endX = KEY_W + (n.startBeat + n.lengthBeats) * this.deps.getZoomX();
          const handle: "body" | "right" = x > endX - 5 ? "right" : "body";
          return { kind: "note", noteId: n.id, handle };
        }
      }
    }
    return { kind: "empty", pitch, beat };
  }

  pitchToY(pitch: number): number {
    const pitchIdx = NUM_PITCHES - 1 - pitch;
    return TOP_PAD + pitchIdx * NOTE_H - this.scrollY;
  }

  beatToX(beat: number): number {
    return KEY_W + beat * this.deps.getZoomX();
  }

  scrollBy(dy: number) {
    const maxScroll = NUM_PITCHES * NOTE_H - this.cssH + 20;
    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + dy));
    this.invalidate();
  }

  scrollToPitch(pitch: number) {
    const y = (NUM_PITCHES - 1 - pitch) * NOTE_H;
    this.scrollY = Math.max(0, y - this.cssH / 2);
    this.invalidate();
  }

  private loop = () => {
    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    this.renderPlayhead();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderPlayhead() {
    const clip = this.deps.getClip();
    if (!clip) return;
    const localBeat = this.deps.getPositionBeats() - this.deps.getClipStartBeat();
    if (localBeat < 0 || localBeat > clip.lengthBeats) return;
    const x = this.beatToX(localBeat);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(KEY_W, 0, this.cssW - KEY_W, this.cssH);
    this.ctx.clip();
    this.ctx.strokeStyle = readCssVar("--accent", "#ff8c3a");
    this.ctx.lineWidth = 1.2;
    strokeLineV(this.ctx, x, 0, this.cssH);
    this.ctx.restore();
  }

  render() {
    if (this.cssW === 0) return;
    const ctx = this.ctx;
    const clip = this.deps.getClip();
    const key = this.deps.getKey();
    const selected = this.deps.getSelectedNoteIds();
    const bg0 = readCssVar("--bg-0", "#0e0f12");
    const bg1 = readCssVar("--bg-1", "#14161b");
    const bg2 = readCssVar("--bg-2", "#1c1f26");
    const fg1 = readCssVar("--fg-1", "#a8aebb");
    const border = readCssVar("--border", "#2a2e38");
    const accent = readCssVar("--accent", "#ff8c3a");
    const accent2 = readCssVar("--accent-2", "#2dd4bf");

    clear(ctx, this.cssW, this.cssH, bg0);

    const scaleSet = new Set(
      SCALE_INTERVALS[key.scale].map((iv) => (iv + PITCH_INDEX[key.tonic]) % 12),
    );

    // rows
    for (let p = 0; p < NUM_PITCHES; p++) {
      const y = TOP_PAD + (NUM_PITCHES - 1 - p) * NOTE_H - this.scrollY;
      if (y > this.cssH || y + NOTE_H < 0) continue;
      const pitchMod = p % 12;
      const isBlack = BLACK_KEYS.has(pitchMod);
      const inScale = scaleSet.has(pitchMod);
      ctx.fillStyle = isBlack ? bg1 : bg0;
      if (inScale) ctx.fillStyle = isBlack ? bg2 : "#14171d";
      ctx.fillRect(KEY_W, y, this.cssW - KEY_W, NOTE_H);
      ctx.strokeStyle = border;
      strokeLineH(ctx, y + NOTE_H - 0.5, KEY_W, this.cssW);

      // key column
      ctx.fillStyle = isBlack ? "#0a0a0d" : "#dcdee5";
      ctx.fillRect(0, y, KEY_W, NOTE_H);
      ctx.strokeStyle = "#2a2a2e";
      strokeLineH(ctx, y + NOTE_H - 0.5, 0, KEY_W);
      // C label
      if (pitchMod === 0) {
        const octave = Math.floor(p / 12) - 1;
        ctx.fillStyle = isBlack ? "#dcdee5" : "#0a0a0d";
        ctx.font = "10px Inter, system-ui";
        ctx.textBaseline = "middle";
        ctx.fillText(`C${octave}`, 4, y + NOTE_H / 2);
      }
    }

    // grid - bar lines
    if (clip) {
      const beats = clip.lengthBeats;
      for (let b = 0; b <= beats; b++) {
        const x = this.beatToX(b);
        if (x > this.cssW) break;
        const isBar = b % 4 === 0;
        ctx.strokeStyle = isBar ? border : "rgba(255,255,255,0.04)";
        strokeLineV(ctx, x, 0, this.cssH);
      }
    }

    // notes
    if (clip) {
      for (const note of clip.notes) {
        drawNote(ctx, note, this, accent, accent2, selected.has(note.id));
      }
    }

    // keys-area dividing line
    ctx.strokeStyle = border;
    strokeLineV(ctx, KEY_W, 0, this.cssH);

    // velocity lane (bottom 40px)
    const laneH = 40;
    if (this.cssH > laneH + 20 && clip) {
      const laneY = this.cssH - laneH;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(KEY_W, laneY, this.cssW - KEY_W, laneH);
      ctx.strokeStyle = border;
      strokeLineH(ctx, laneY, KEY_W, this.cssW);
      ctx.fillStyle = fg1;
      ctx.font = "9px Inter, system-ui";
      ctx.fillText("Velocity", KEY_W + 4, laneY + 8);

      ctx.fillStyle = accent2;
      for (const note of clip.notes) {
        const nx = this.beatToX(note.startBeat);
        const h = (note.velocity) * (laneH - 4);
        ctx.fillRect(nx, laneY + (laneH - h), 2, h);
      }
    }

    this.renderPlayhead();
  }
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  note: Note,
  pr: PianoRollCanvas,
  baseColor: string,
  selColor: string,
  selected: boolean,
) {
  const x = pr.beatToX(note.startBeat);
  const y = pr.pitchToY(note.pitch);
  const w = Math.max(2, note.lengthBeats * (pr as unknown as { deps: PianoRollDeps }).deps.getZoomX());
  const h = NOTE_H - 1;
  ctx.fillStyle = selected ? selColor : baseColor;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? "#fff" : "rgba(0,0,0,0.4)";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
