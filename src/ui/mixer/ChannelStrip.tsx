import { useRef } from "react";
import type { Track } from "@/model/track";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { Meter } from "@/ui/common/Meter";
import { DEVICE_LABELS } from "@/audio/devices/registry";
import s from "./Mixer.module.css";

interface Props {
  track: Track;
}

const FADER_MIN_DB = -60;
const FADER_MAX_DB = 6;

function dbToY(db: number, height: number): number {
  const norm = 1 - (db - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB);
  return Math.max(0, Math.min(height, norm * height));
}

function yToDb(y: number, height: number): number {
  const norm = 1 - y / height;
  return FADER_MIN_DB + norm * (FADER_MAX_DB - FADER_MIN_DB);
}

export function ChannelStrip({ track }: Props) {
  const selectedId = useUiStore((st) => st.selectedTrackId);
  const selectTrack = useUiStore((st) => st.selectTrack);
  const updateMixer = useProjectStore((st) => st.updateTrackMixer);
  const upsertDevice = useProjectStore((st) => st.upsertDevice);
  const faderRef = useRef<HTMLDivElement | null>(null);

  const isMaster = track.type === "master";
  const isSelected = selectedId === track.id;

  const onFaderDown = (e: React.MouseEvent) => {
    const trackEl = faderRef.current;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const move = (ev: MouseEvent) => {
      const y = ev.clientY - rect.top;
      const db = yToDb(y, rect.height);
      updateMixer(track.id, { volumeDb: Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, db)) });
    };
    move(e.nativeEvent);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onFaderDouble = () => updateMixer(track.id, { volumeDb: 0 });

  return (
    <div
      className={`${s.strip} ${isMaster ? s.master : ""} ${isSelected ? s.selected : ""}`}
      onClick={() => selectTrack(track.id)}
    >
      <div className={s.colorBand} style={{ background: track.color }} />
      <div className={s.name}>{track.name}</div>
      <div className={s.inserts}>
        {track.devices.slice(0, 4).map((d) => (
          <div key={d.id} className={s.insertSlot} title={DEVICE_LABELS[d.kind] ?? d.kind}>
            {DEVICE_LABELS[d.kind] ?? d.kind}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - track.devices.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className={`${s.insertSlot} ${s.empty}`}
            onClick={(e) => {
              e.stopPropagation();
              upsertDevice(track.id, "eq3");
            }}
          >
            +
          </div>
        ))}
      </div>
      <input
        className={s.pan}
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={track.mixer.pan}
        onChange={(e) => updateMixer(track.id, { pan: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
      />
      <div className={s.faderArea}>
        <Meter trackId={track.id} height={200} width={6} />
        <div
          ref={faderRef}
          className={s.faderTrack}
          style={{ height: 200 }}
          onMouseDown={onFaderDown}
          onDoubleClick={onFaderDouble}
        >
          <div
            className={s.faderThumb}
            style={{ top: dbToY(track.mixer.volumeDb, 200) - 7 }}
          />
        </div>
      </div>
      <div className={s.faderValue}>
        {track.mixer.volumeDb > FADER_MIN_DB ? `${track.mixer.volumeDb.toFixed(1)} dB` : "-∞"}
      </div>
      {!isMaster && (
        <div className={s.ms}>
          <button
            className={`${s.msBtn} ${track.mixer.muted ? s.on : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              updateMixer(track.id, { muted: !track.mixer.muted });
            }}
          >
            M
          </button>
          <button
            className={`${s.msBtn} ${s.solo} ${track.mixer.soloed ? s.on : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              updateMixer(track.id, { soloed: !track.mixer.soloed });
            }}
          >
            S
          </button>
        </div>
      )}
    </div>
  );
}
