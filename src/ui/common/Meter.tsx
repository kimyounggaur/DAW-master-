import { useEffect, useRef } from "react";
import { getTrackNode, readMeter } from "@/audio/tracks/trackGraph";

interface Props {
  trackId: string;
  height?: number;
  width?: number;
}

export function Meter({ trackId, height = 200, width = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const peakHoldRef = useRef(0);
  const peakHoldTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let last = 0;
    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (now - last < 40) return; // ~25fps
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#101216";
      ctx.fillRect(0, 0, width, height);

      const node = getTrackNode(trackId);
      if (!node) return;
      const { rms, peak } = readMeter(node);
      const peakDb = 20 * Math.log10(Math.max(peak, 0.00001));
      const rmsDb = 20 * Math.log10(Math.max(rms, 0.00001));

      const drawBar = (db: number, color: string) => {
        const norm = Math.max(0, Math.min(1, (db + 60) / 66)); // -60..+6
        const h = norm * height;
        ctx.fillStyle = color;
        ctx.fillRect(0, height - h, width, h);
      };
      drawBar(rmsDb, "#2dd4bf");
      // peak overlay
      const peakNorm = Math.max(0, Math.min(1, (peakDb + 60) / 66));
      ctx.fillStyle = peakDb > -1 ? "#ef4444" : "#fbbf24";
      ctx.fillRect(0, height - peakNorm * height - 1, width, 1);

      // peak hold
      if (peakNorm > peakHoldRef.current) {
        peakHoldRef.current = peakNorm;
        peakHoldTimeRef.current = now;
      } else if (now - peakHoldTimeRef.current > 1500) {
        peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.005);
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, height - peakHoldRef.current * height - 1, width, 1);

      // -6 mark
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      const mark6 = ((-6 + 60) / 66) * height;
      ctx.fillRect(0, height - mark6, width, 1);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [trackId, width, height]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}
