import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { useTransportStore } from "@/state/transportStore";
import { newId } from "@/lib/id";
import { snapBeat } from "@/model/time";
import { PianoRollCanvas, KEY_W } from "./PianoRollCanvas";
import s from "./PianoRoll.module.css";
import type { Note } from "@/model/note";

type Tool = "select" | "draw" | "erase" | "slice";

interface Props {
  clipId: string;
}

export function PianoRoll({ clipId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const prRef = useRef<PianoRollCanvas | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [zoomX, setZoomX] = useState(48);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clip = useProjectStore((st) => st.project.clips[clipId]);
  const projectKey = useProjectStore((st) => st.project.meta.key);
  const timeSig = useProjectStore((st) => st.project.meta.timeSig);
  const setNotes = useProjectStore((st) => st.setClipNotes);

  useEffect(() => {
    if (!canvasRef.current) return;
    const pr = new PianoRollCanvas(canvasRef.current, {
      getClip: () => {
        const c = useProjectStore.getState().project.clips[clipId];
        return c && c.type === "midi" ? c : null;
      },
      getKey: () => useProjectStore.getState().project.meta.key,
      getZoomX: () => zoomX,
      getPositionBeats: () => useTransportStore.getState().positionBeats,
      getClipStartBeat: () => {
        const c = useProjectStore.getState().project.clips[clipId];
        return c?.startBeat ?? 0;
      },
      getSelectedNoteIds: () => selected,
    });
    prRef.current = pr;

    const unsubP = useProjectStore.subscribe(() => pr.invalidate());
    const unsubT = useTransportStore.subscribe(() => pr.invalidate());
    const ro = new ResizeObserver(() => pr.resize());
    if (wrapRef.current) ro.observe(wrapRef.current);

    // center C3 initially
    pr.scrollToPitch(60);

    return () => {
      unsubP();
      unsubT();
      ro.disconnect();
      pr.destroy();
    };
  }, [clipId, zoomX, selected]);

  useEffect(() => {
    prRef.current?.invalidate();
  }, [zoomX, selected, projectKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "b" || e.key === "B") setTool("draw");
      if (e.key === "e" || e.key === "E") setTool("erase");
      if (e.key === "c" || e.key === "C") setTool("slice");
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        const c = useProjectStore.getState().project.clips[clipId];
        if (c && c.type === "midi") {
          setNotes(clipId, c.notes.filter((n) => !selected.has(n.id)));
          setSelected(new Set());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipId, selected, setNotes]);

  if (!clip || clip.type !== "midi") return null;

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pr = prRef.current;
    if (!pr) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = pr.hitTest(x, y);

    if (tool === "erase") {
      if (hit.kind === "note") {
        setNotes(
          clipId,
          (clip as import("@/model/clip").MidiClip).notes.filter((n) => n.id !== hit.noteId),
        );
      }
      return;
    }

    if (hit.kind === "note") {
      const isMulti = e.shiftKey;
      const next = new Set(isMulti ? selected : []);
      next.add(hit.noteId);
      setSelected(next);
      if (hit.handle === "right") {
        startResize(pr, e, hit.noteId);
      } else {
        startMove(pr, e, hit.noteId);
      }
    } else if (hit.kind === "empty" && tool === "draw") {
      const note: Note = {
        id: newId(),
        pitch: hit.pitch,
        startBeat: snapBeat(Math.max(0, hit.beat), "1/16", timeSig),
        lengthBeats: 1,
        velocity: 0.8,
      };
      const current = useProjectStore.getState().project.clips[clipId];
      if (current && current.type === "midi") {
        setNotes(clipId, [...current.notes, note]);
        startResize(pr, e, note.id);
      }
    } else if (hit.kind === "empty" && tool === "select") {
      setSelected(new Set());
    }
  };

  const startMove = (_pr: PianoRollCanvas, downE: React.MouseEvent, noteId: string) => {
    void _pr;
    const rect = (downE.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const startX = downE.clientX - rect.left;
    const startY = downE.clientY - rect.top;
    void startY;
    const startNote = (clip as import("@/model/clip").MidiClip).notes.find((n) => n.id === noteId);
    if (!startNote) return;
    const origBeat = startNote.startBeat;
    const origPitch = startNote.pitch;

    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - rect.left - startX;
      const dy = ev.clientY - rect.top - startY;
      const deltaBeats = dx / zoomX;
      const deltaPitches = -Math.round(dy / 12);
      const c = useProjectStore.getState().project.clips[clipId];
      if (!c || c.type !== "midi") return;
      const next = c.notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              startBeat: snapBeat(Math.max(0, origBeat + deltaBeats), "1/16", timeSig),
              pitch: Math.max(0, Math.min(127, origPitch + deltaPitches)),
            }
          : n,
      );
      setNotes(clipId, next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startResize = (_unused: PianoRollCanvas, downE: React.MouseEvent, noteId: string) => {
    void _unused;
    const rect = (downE.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const startX = downE.clientX - rect.left;
    const startNote = (clip as import("@/model/clip").MidiClip).notes.find((n) => n.id === noteId);
    if (!startNote) return;
    const origLen = startNote.lengthBeats;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - rect.left - startX;
      const newLen = Math.max(0.0625, snapBeat(origLen + dx / zoomX, "1/16", timeSig));
      const c = useProjectStore.getState().project.clips[clipId];
      if (!c || c.type !== "midi") return;
      const next = c.notes.map((n) =>
        n.id === noteId ? { ...n, lengthBeats: newLen } : n,
      );
      setNotes(clipId, next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const pr = prRef.current;
    if (!pr) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomX((z) => Math.max(8, Math.min(256, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    } else {
      pr.scrollBy(e.deltaY);
    }
  };

  const onQuantize = () => {
    const c = useProjectStore.getState().project.clips[clipId];
    if (!c || c.type !== "midi") return;
    const notes = c.notes.map((n) => ({
      ...n,
      startBeat: snapBeat(n.startBeat, "1/16", timeSig),
    }));
    setNotes(clipId, notes);
  };

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <button className={`${s.tool} ${tool === "select" ? s.active : ""}`} onClick={() => setTool("select")}>선택 (V)</button>
        <button className={`${s.tool} ${tool === "draw" ? s.active : ""}`} onClick={() => setTool("draw")}>그리기 (B)</button>
        <button className={`${s.tool} ${tool === "erase" ? s.active : ""}`} onClick={() => setTool("erase")}>지우개 (E)</button>
        <button className={s.tool} onClick={onQuantize}>퀀타이즈 1/16</button>
        <div className={s.spacer} />
        <span style={{ color: "var(--fg-2)" }}>키: {projectKey.tonic} {projectKey.scale}</span>
        <span style={{ color: "var(--fg-2)", marginLeft: 8 }}>줌 {Math.round(zoomX)}px/beat</span>
        <span style={{ marginLeft: 8 }}>키패딩 {KEY_W}px</span>
      </div>
      <div ref={wrapRef} className={s.canvasWrap} onWheel={onWheel}>
        <canvas ref={canvasRef} className={s.canvas} onMouseDown={onMouseDown} />
        <span className={s.hint}>Ctrl+휠 줌 · 휠 세로 스크롤 · Del 선택 노트 삭제</span>
      </div>
    </div>
  );
}
