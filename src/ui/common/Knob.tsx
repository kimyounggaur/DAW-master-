import { useRef } from "react";
import type { Param } from "@/audio/devices/types";

interface Props {
  param: Param;
  value: number;
  onChange: (v: number) => void;
}

function paramRangeNormalize(p: Param, value: number): number {
  if (p.scale === "log") {
    const lo = Math.log(Math.max(0.0001, p.min));
    const hi = Math.log(Math.max(0.0001, p.max));
    return (Math.log(Math.max(0.0001, value)) - lo) / (hi - lo);
  }
  return (value - p.min) / (p.max - p.min);
}

function paramRangeDenormalize(p: Param, n: number): number {
  const clamped = Math.max(0, Math.min(1, n));
  if (p.scale === "log") {
    const lo = Math.log(Math.max(0.0001, p.min));
    const hi = Math.log(Math.max(0.0001, p.max));
    return Math.exp(lo + (hi - lo) * clamped);
  }
  return p.min + (p.max - p.min) * clamped;
}

export function Knob({ param, value, onChange }: Props) {
  const dragRef = useRef<{ startY: number; startN: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startN: paramRangeNormalize(param, value) };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = (ev.clientY - dragRef.current.startY) / 200;
      const sensitivity = ev.shiftKey ? 0.1 : 1;
      const newN = Math.max(0, Math.min(1, dragRef.current.startN - dy * sensitivity));
      onChange(paramRangeDenormalize(param, newN));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onDoubleClick = () => onChange(param.default);

  const norm = paramRangeNormalize(param, value);
  const rot = -135 + norm * 270;
  const decimals = Math.abs(value) < 10 ? 2 : Math.abs(value) < 100 ? 1 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div
        title={param.label}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: "50%",
          cursor: "ns-resize",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 2,
            height: 14,
            background: "var(--accent)",
            left: "calc(50% - 1px)",
            top: 4,
            transformOrigin: "1px 14px",
            transform: `rotate(${rot}deg)`,
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "var(--fg-2)" }}>{param.label}</span>
      <span style={{ fontSize: 10, color: "var(--fg-1)" }}>
        {value.toFixed(decimals)}
        {param.unit ?? ""}
      </span>
    </div>
  );
}
