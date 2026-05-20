import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { useTransportStore } from "@/state/transportStore";
import { TimelineCanvas } from "./TimelineCanvas";
import { HEADER_W } from "./timelineGeom";
import { attachClipDragHandler } from "./ClipDragHandler";
import { TrackHeaders } from "./TrackHeaders";
import { putSample, getDecodedSample } from "@/storage/opfs";
import { preloadPeaks } from "@/storage/peakCache";
import { engine } from "@/audio/engine";
import { secondsToBeats } from "@/model/time";
import s from "./Timeline.module.css";

export function Timeline() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tcRef = useRef<TimelineCanvas | null>(null);
  const [ctxMenu, setCtxMenu] = useState<
    | { x: number; y: number; clipId: string | null; trackId: string | null }
    | null
  >(null);
  const addTrack = useProjectStore((st) => st.addTrack);
  const setInstrument = useProjectStore((st) => st.setInstrument);
  const addClip = useProjectStore((st) => st.addClip);

  useEffect(() => {
    if (!canvasRef.current) return;
    const tc = new TimelineCanvas(canvasRef.current, {
      getProject: () => useProjectStore.getState().project,
      getZoomX: () => useUiStore.getState().zoomX,
      getZoomY: () => useUiStore.getState().zoomY,
      getScrollX: () => useUiStore.getState().scrollX,
      getScrollY: () => useUiStore.getState().scrollY,
      getPositionBeats: () => useTransportStore.getState().positionBeats,
      getSelectedClipId: () => useUiStore.getState().selectedClipId,
      getSelectedTrackId: () => useUiStore.getState().selectedTrackId,
      getLoop: () => useTransportStore.getState().loop,
    });
    tcRef.current = tc;

    const unsubProject = useProjectStore.subscribe(() => tc.invalidate());
    const unsubUi = useUiStore.subscribe(() => tc.invalidate());
    const unsubT = useTransportStore.subscribe(() => tc.invalidate());

    const ro = new ResizeObserver(() => tc.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    const detach = attachClipDragHandler(canvasRef.current, tc, {
      onContextMenu: (e, hit) => {
        e.preventDefault();
        setCtxMenu({
          x: e.clientX,
          y: e.clientY,
          clipId: hit.kind === "clip" ? hit.clipId : null,
          trackId: hit.kind === "track-header" ? hit.trackId : null,
        });
      },
    });

    return () => {
      detach();
      tc.destroy();
      ro.disconnect();
      unsubProject();
      unsubUi();
      unsubT();
    };
  }, []);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const ui = useUiStore.getState();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      ui.setZoom(ui.zoomX * factor, undefined);
    } else if (e.shiftKey) {
      ui.setScroll(ui.scrollX + e.deltaY, undefined);
    } else {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        ui.setScroll(ui.scrollX + e.deltaX, undefined);
      } else {
        ui.setScroll(undefined, ui.scrollY + e.deltaY);
      }
    }
  };

  const onAddTrack = (type: "audio" | "instrument" | "drum") => {
    const id = addTrack(type);
    if (type === "instrument") setInstrument(id, "simpleSynth");
    if (type === "drum") setInstrument(id, "drumSampler");
    useUiStore.getState().selectTrack(id);
  };

  const onAddDemoDrum = () => {
    const id = addTrack("drum", "Demo Drums");
    setInstrument(id, "drumSampler");
    // 4-on-the-floor pattern across 2 bars
    const clipId = addClip(id, "pattern", 0, 8, { name: "Demo Beat", stepCount: 16 });
    const project = useProjectStore.getState().project;
    const clip = project.clips[clipId];
    if (clip && clip.type === "pattern") {
      const steps = clip.steps.map((row) => row.slice());
      const kick = steps[0];
      const snare = steps[1];
      const hh = steps[2];
      if (kick && snare && hh) {
        for (let i = 0; i < 16; i += 4) {
          const s = kick[i];
          if (s) { s.on = true; s.velocity = 1; }
        }
        for (let i = 4; i < 16; i += 8) {
          const s = snare[i];
          if (s) { s.on = true; s.velocity = 0.9; }
        }
        for (let i = 0; i < 16; i += 2) {
          const s = hh[i];
          if (s) { s.on = true; s.velocity = 0.7; }
        }
      }
      useProjectStore.getState().setClipSteps(clipId, steps);
      useProjectStore.getState().setLauncherSlot(id, 0, clipId);
    }
    useUiStore.getState().selectTrack(id);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    await engine.init();
    const project = useProjectStore.getState().project;
    const ui = useUiStore.getState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beatRaw = Math.max(0, (x - 200 + ui.scrollX) / ui.zoomX);
    const beat = Math.round(beatRaw / 0.25) * 0.25;

    let dropTrackId: string | null = null;
    const tc = tcRef.current;
    if (tc) {
      const hit = tc.hitTest(x, y);
      if (hit.kind === "track-header") dropTrackId = hit.trackId;
      else if (hit.kind === "empty" && hit.trackId) dropTrackId = hit.trackId;
      else if (hit.kind === "clip") {
        const c = project.clips[hit.clipId];
        if (c) dropTrackId = c.trackId;
      }
    }
    const targetTrack =
      (dropTrackId && project.tracks.find((t) => t.id === dropTrackId && t.type === "audio")) ||
      project.tracks.find((t) => t.type === "audio");
    let audioTrackId: string;
    if (targetTrack) {
      audioTrackId = targetTrack.id;
    } else {
      audioTrackId = useProjectStore.getState().addTrack("audio");
    }

    for (const file of Array.from(e.dataTransfer.files)) {
      try {
        const sampleId = await putSample(file, file.name);
        const buf = await getDecodedSample(sampleId);
        if (!buf) continue;
        const lengthBeats = secondsToBeats(buf.duration, project.meta.bpm);
        const clipId = useProjectStore.getState().addClip(audioTrackId, "audio", beat, lengthBeats, {
          name: file.name.replace(/\.[^/.]+$/, ""),
          sampleId,
        });
        void preloadPeaks(sampleId);
        useUiStore.getState().selectClip(clipId);
        useUiStore.getState().showToast(`임포트 완료: ${file.name} (${buf.duration.toFixed(2)}s)`, "success");
      } catch {
        useUiStore.getState().showToast(`임포트 실패: ${file.name}`, "error");
      }
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className={s.root}
      onWheel={onWheel}
      onClick={() => setCtxMenu(null)}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <canvas ref={canvasRef} className={s.canvas} />
      <TrackHeaders />
      <div className={s.addTrack}>
        <button className={s.addBtn} onClick={() => onAddTrack("instrument")}>+ Instrument</button>
        <button className={s.addBtn} onClick={() => onAddTrack("audio")}>+ Audio</button>
        <button className={s.addBtn} onClick={() => onAddTrack("drum")}>+ Drum</button>
        <button className={`${s.addBtn} ${s.demoBtn}`} onClick={onAddDemoDrum}>+ Demo Drums</button>
      </div>
      {ctxMenu && (
        <div
          className={s.contextMenu}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.clipId && (
            <>
              <button
                className={s.contextMenuItem}
                onClick={() => {
                  useUiStore.getState().selectClip(ctxMenu.clipId);
                  setCtxMenu(null);
                }}
              >
                선택
              </button>
              <button
                className={s.contextMenuItem}
                onClick={() => {
                  if (ctxMenu.clipId) {
                    const project = useProjectStore.getState().project;
                    const c = project.clips[ctxMenu.clipId];
                    if (c) {
                      const newId = useProjectStore.getState().addClip(
                        c.trackId,
                        c.type,
                        c.startBeat + c.lengthBeats,
                        c.lengthBeats,
                        c.type === "pattern"
                          ? { stepCount: c.stepCount, steps: JSON.parse(JSON.stringify(c.steps)), swing: c.swing }
                          : c.type === "midi"
                            ? { notes: JSON.parse(JSON.stringify(c.notes)) }
                            : { sampleId: c.sampleId, offsetBeats: c.offsetBeats, gainDb: c.gainDb, fadeInBeats: c.fadeInBeats, fadeOutBeats: c.fadeOutBeats, pitchSemitones: c.pitchSemitones },
                      );
                      useUiStore.getState().selectClip(newId);
                    }
                  }
                  setCtxMenu(null);
                }}
              >
                복제
              </button>
              <button
                className={`${s.contextMenuItem} ${s.danger}`}
                onClick={() => {
                  if (ctxMenu.clipId) useProjectStore.getState().deleteClip(ctxMenu.clipId);
                  setCtxMenu(null);
                }}
              >
                삭제
              </button>
            </>
          )}
          {ctxMenu.trackId && (
            <button
              className={`${s.contextMenuItem} ${s.danger}`}
              onClick={() => {
                if (ctxMenu.trackId) useProjectStore.getState().removeTrack(ctxMenu.trackId);
                setCtxMenu(null);
              }}
            >
              트랙 삭제
            </button>
          )}
        </div>
      )}
      <span style={{ position: "absolute", left: 4, top: 4, fontSize: 10, color: "var(--fg-2)", pointerEvents: "none" }}>
        Ctrl+휠 줌 · Shift+휠 가로 스크롤 · 휠 세로 스크롤
      </span>
      <span style={{ position: "absolute", right: 8, top: 4, fontSize: 10, color: "var(--fg-2)", pointerEvents: "none" }}>
        헤더 너비 {HEADER_W}px
      </span>
    </div>
  );
}
