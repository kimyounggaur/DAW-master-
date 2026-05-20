import type { TimelineCanvas, HitResult } from "./TimelineCanvas";
import { xToBeat } from "./timelineGeom";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { useTransportStore } from "@/state/transportStore";
import { snapBeat } from "@/model/time";

interface DragOpts {
  onContextMenu: (e: MouseEvent, hit: HitResult) => void;
}

type DragState =
  | { kind: "idle" }
  | {
      kind: "maybeDrag";
      startX: number;
      startY: number;
      hit: HitResult;
    }
  | {
      kind: "moveClip";
      clipId: string;
      origStartBeat: number;
      startX: number;
    }
  | {
      kind: "resizeClip";
      clipId: string;
      origLength: number;
      startX: number;
    }
  | {
      kind: "scrubRuler";
    }
  | {
      kind: "createClip";
      trackId: string;
      origBeat: number;
    };

export function attachClipDragHandler(
  canvas: HTMLCanvasElement,
  tc: TimelineCanvas,
  opts: DragOpts,
): () => void {
  let drag: DragState = { kind: "idle" };
  const DRAG_THRESHOLD = 4;

  const getXY = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) return;
    const { x, y } = getXY(e);
    const hit = tc.hitTest(x, y);

    if (hit.kind === "ruler") {
      drag = { kind: "scrubRuler" };
      seekTo(hit.beat);
      return;
    }
    if (hit.kind === "track-header") {
      useUiStore.getState().selectTrack(hit.trackId);
      return;
    }
    if (hit.kind === "clip") {
      useUiStore.getState().selectClip(hit.clipId);
      drag = { kind: "maybeDrag", startX: x, startY: y, hit };
      return;
    }
    if (hit.kind === "empty" && hit.trackId) {
      useUiStore.getState().selectTrack(hit.trackId);
    }
    drag = { kind: "maybeDrag", startX: x, startY: y, hit };
  };

  const onMouseMove = (e: MouseEvent) => {
    if (drag.kind === "idle") return;
    const { x } = getXY(e);

    if (drag.kind === "maybeDrag") {
      const dx = Math.abs(x - drag.startX);
      if (dx < DRAG_THRESHOLD) return;
      // upgrade
      if (drag.hit.kind === "clip") {
        const clip = useProjectStore.getState().project.clips[drag.hit.clipId];
        if (!clip) return;
        if (drag.hit.handle === "right") {
          drag = {
            kind: "resizeClip",
            clipId: drag.hit.clipId,
            origLength: clip.lengthBeats,
            startX: drag.startX,
          };
        } else {
          drag = {
            kind: "moveClip",
            clipId: drag.hit.clipId,
            origStartBeat: clip.startBeat,
            startX: drag.startX,
          };
        }
      } else if (drag.hit.kind === "empty" && drag.hit.trackId) {
        drag = { kind: "createClip", trackId: drag.hit.trackId, origBeat: drag.hit.beat };
        return;
      } else {
        drag = { kind: "idle" };
        return;
      }
    }

    if (drag.kind === "scrubRuler") {
      const ui = useUiStore.getState();
      const beat = Math.max(0, xToBeat(x, ui.zoomX, ui.scrollX));
      seekTo(beat);
      return;
    }

    if (drag.kind === "moveClip") {
      const ui = useUiStore.getState();
      const project = useProjectStore.getState().project;
      const deltaBeats = (x - drag.startX) / ui.zoomX;
      const raw = drag.origStartBeat + deltaBeats;
      const snapped = e.altKey ? raw : snapBeat(raw, ui.snap, project.meta.timeSig);
      useProjectStore.getState().moveClip(drag.clipId, Math.max(0, snapped));
      return;
    }

    if (drag.kind === "resizeClip") {
      const ui = useUiStore.getState();
      const project = useProjectStore.getState().project;
      const deltaBeats = (x - drag.startX) / ui.zoomX;
      const raw = drag.origLength + deltaBeats;
      const snapped = e.altKey ? raw : snapBeat(raw, ui.snap, project.meta.timeSig);
      useProjectStore.getState().resizeClip(drag.clipId, Math.max(0.25, snapped));
      return;
    }
  };

  const onMouseUp = () => {
    drag = { kind: "idle" };
  };

  const onDblClick = (e: MouseEvent) => {
    const { x, y } = getXY(e);
    const hit = tc.hitTest(x, y);
    if (hit.kind === "empty" && hit.trackId) {
      const project = useProjectStore.getState().project;
      const track = project.tracks.find((t) => t.id === hit.trackId);
      if (!track) return;
      if (track.type === "audio") return;
      const ui = useUiStore.getState();
      const startBeat = snapBeat(Math.max(0, hit.beat), ui.snap, project.meta.timeSig);
      const type: "midi" | "pattern" = track.type === "drum" ? "pattern" : "midi";
      const clipId = useProjectStore.getState().addClip(
        track.id,
        type,
        startBeat,
        project.meta.timeSig[0],
      );
      useUiStore.getState().selectClip(clipId);
      // open relevant editor
      useUiStore.getState().setBottomTab(type === "pattern" ? "pattern" : "piano");
    } else if (hit.kind === "clip") {
      const clip = useProjectStore.getState().project.clips[hit.clipId];
      if (!clip) return;
      useUiStore.getState().selectClip(clip.id);
      useUiStore.getState().setBottomTab(
        clip.type === "pattern" ? "pattern" : clip.type === "midi" ? "piano" : "device",
      );
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    const { x, y } = getXY(e);
    const hit = tc.hitTest(x, y);
    opts.onContextMenu(e, hit);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const ui = useUiStore.getState();
    if (e.key === "Delete" || e.key === "Backspace") {
      if (ui.selectedClipId) {
        e.preventDefault();
        useProjectStore.getState().deleteClip(ui.selectedClipId);
        ui.selectClip(null);
      }
    } else if (e.key === "Escape") {
      drag = { kind: "idle" };
    } else if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
      if (ui.selectedClipId) {
        const beat = useTransportStore.getState().positionBeats;
        useProjectStore.getState().splitClip(ui.selectedClipId, beat);
      }
    }
  };

  function seekTo(beat: number) {
    useTransportStore.getState().setPosition(Math.max(0, beat));
  }

  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("dblclick", onDblClick);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKey);
  };
}
