import { useEffect, useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { useTransportStore } from "@/state/transportStore";
import s from "./StepSequencer.module.css";

interface Props {
  clipId: string;
}

const ROW_NAMES = ["Kick", "Snare", "HH-C", "HH-O", "Clap", "Tom-Lo", "Tom-Hi", "Perc"];

export function StepSequencer({ clipId }: Props) {
  const clip = useProjectStore((st) => st.project.clips[clipId]);
  const setSteps = useProjectStore((st) => st.setClipSteps);
  const setSwing = useProjectStore((st) => st.setClipSwing);
  const [activeRow, setActiveRow] = useState(0);
  const positionBeats = useTransportStore((st) => st.positionBeats);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setActiveRow((r) => (r + 1) % ROW_NAMES.length);
      }
      if (e.key >= "1" && e.key <= "8") {
        setActiveRow(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!clip || clip.type !== "pattern") return null;

  const toggleStep = (row: number, step: number) => {
    const steps = clip.steps.map((r) => r.map((cell) => ({ ...cell })));
    const cell = steps[row]?.[step];
    if (!cell) return;
    cell.on = !cell.on;
    if (cell.on && cell.velocity === 0) cell.velocity = 0.8;
    setSteps(clipId, steps);
  };

  const setVelocity = (row: number, step: number, v: number) => {
    const steps = clip.steps.map((r) => r.map((cell) => ({ ...cell })));
    const cell = steps[row]?.[step];
    if (!cell) return;
    cell.velocity = Math.max(0.05, Math.min(1, v));
    setSteps(clipId, steps);
  };

  const stepDur = 4 / clip.stepCount;
  const localBeat = positionBeats - clip.startBeat;
  const playingStep =
    localBeat >= 0 && localBeat < clip.lengthBeats ? Math.floor(localBeat / stepDur) : -1;

  const gridClass = clip.stepCount === 32 ? `${s.grid} ${s.gridWide}` : s.grid;
  const velClass = clip.stepCount === 32 ? `${s.velocityRow} ${s.velocityRowWide}` : s.velocityRow;
  const beatsPerStep = clip.stepCount === 16 ? 4 : 8; // 4 steps per beat (1/16), 8 (1/32)

  return (
    <div className={s.root}>
      <div className={s.header}>
        <span>패턴 · {clip.stepCount} steps</span>
        <div className={s.swing}>
          <span>Swing</span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={clip.swing}
            onChange={(e) => setSwing(clipId, Number(e.target.value))}
          />
          <span>{Math.round(clip.swing * 100)}%</span>
        </div>
        <span style={{ color: "var(--fg-2)" }}>Tab=다음 행 · 1~8=행 선택</span>
      </div>
      <div className={gridClass}>
        {ROW_NAMES.map((label, row) => (
          <RowRender
            key={row}
            label={label}
            row={row}
            active={row === activeRow}
            steps={clip.steps[row] ?? []}
            stepCount={clip.stepCount}
            beatsPerStep={beatsPerStep}
            playingStep={playingStep}
            onToggle={(step) => toggleStep(row, step)}
            onSelect={() => setActiveRow(row)}
          />
        ))}
      </div>
      <div className={velClass}>
        <div className={s.rowLabel}>Velocity</div>
        {(clip.steps[activeRow] ?? []).map((cell, step) => (
          <div
            key={step}
            className={s.velBar}
            onMouseDown={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const v = 1 - (e.clientY - rect.top) / rect.height;
              setVelocity(activeRow, step, v);
            }}
          >
            <div className={s.velFill} style={{ height: `${cell.velocity * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface RowRenderProps {
  label: string;
  row: number;
  active: boolean;
  steps: import("@/model/note").Step[];
  stepCount: number;
  beatsPerStep: number;
  playingStep: number;
  onToggle: (step: number) => void;
  onSelect: () => void;
}

function RowRender(p: RowRenderProps) {
  return (
    <>
      <button
        className={s.rowLabel}
        style={{
          background: "transparent",
          border: "none",
          color: p.active ? "var(--accent)" : "var(--fg-1)",
          textAlign: "left",
          cursor: "pointer",
        }}
        onClick={p.onSelect}
      >
        {p.row + 1}. {p.label}
      </button>
      {Array.from({ length: p.stepCount }, (_, step) => {
        const cell = p.steps[step];
        const on = !!cell?.on;
        const beatStart = step % p.beatsPerStep === 0;
        const playing = step === p.playingStep;
        const cn = [s.cell, on ? s.on : "", beatStart ? s.beatStart : "", playing ? s.playing : ""]
          .filter(Boolean)
          .join(" ");
        return <div key={step} className={cn} onClick={() => p.onToggle(step)} />;
      })}
    </>
  );
}
