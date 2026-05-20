import type { Project } from "@/model/project";
import type { Track } from "@/model/track";

export const HEADER_W = 200;
export const RULER_H = 24;

export interface TimelineLayout {
  headerW: number;
  rulerH: number;
  trackTops: Map<string, number>;
  totalContentH: number;
}

export function buildLayout(project: Project): TimelineLayout {
  const trackTops = new Map<string, number>();
  let y = RULER_H;
  for (const t of project.tracks) {
    trackTops.set(t.id, y);
    y += t.height;
  }
  return { headerW: HEADER_W, rulerH: RULER_H, trackTops, totalContentH: y };
}

export function beatToX(beat: number, zoomX: number, scrollX: number): number {
  return HEADER_W + (beat * zoomX - scrollX);
}

export function xToBeat(x: number, zoomX: number, scrollX: number): number {
  return (x - HEADER_W + scrollX) / zoomX;
}

export function getTrackAtY(layout: TimelineLayout, project: Project, y: number): Track | null {
  if (y < layout.rulerH) return null;
  for (const t of project.tracks) {
    const top = layout.trackTops.get(t.id) ?? 0;
    if (y >= top && y < top + t.height) return t;
  }
  return null;
}
