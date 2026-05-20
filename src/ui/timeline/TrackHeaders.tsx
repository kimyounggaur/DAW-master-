import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import s from "./TrackHeaders.module.css";

export function TrackHeaders() {
  const tracks = useProjectStore((st) => st.project.tracks);
  const scrollY = useUiStore((st) => st.scrollY);
  const updateMixer = useProjectStore((st) => st.updateTrackMixer);
  const renameTrack = useProjectStore((st) => st.renameTrack);
  const selectTrack = useUiStore((st) => st.selectTrack);

  let y = 0; // matches RULER_H offset by virtue of .layer top
  return (
    <div className={s.layer} style={{ transform: `translateY(${-scrollY}px)` }}>
      {tracks.map((t) => {
        const rowY = y;
        y += t.height;
        return (
          <div
            key={t.id}
            className={s.row}
            style={{ top: rowY, height: t.height }}
            onMouseDown={() => selectTrack(t.id)}
          >
            <div className={s.color} style={{ background: t.color }} />
            <input
              className={s.name}
              value={t.name}
              onChange={(e) => renameTrack(t.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className={s.controls}>
              <button
                className={`${s.btn} ${t.mixer.muted ? s.muted : ""}`}
                title="음소거"
                onClick={(e) => {
                  e.stopPropagation();
                  updateMixer(t.id, { muted: !t.mixer.muted });
                }}
              >
                M
              </button>
              <button
                className={`${s.btn} ${t.mixer.soloed ? s.soloed : ""}`}
                title="솔로"
                onClick={(e) => {
                  e.stopPropagation();
                  updateMixer(t.id, { soloed: !t.mixer.soloed });
                }}
              >
                S
              </button>
              {(t.type === "audio" || t.type === "instrument" || t.type === "drum") && (
                <button
                  className={`${s.btn} ${t.mixer.armed ? s.armed : ""}`}
                  title="녹음 대기"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateMixer(t.id, { armed: !t.mixer.armed });
                  }}
                >
                  R
                </button>
              )}
            </div>
            {t.height >= 56 && (
              <div className={s.faderWrap}>
                <input
                  className={s.fader}
                  type="range"
                  min={-60}
                  max={6}
                  step={0.1}
                  value={t.mixer.volumeDb}
                  onChange={(e) => updateMixer(t.id, { volumeDb: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {t.height >= 56 && (
              <div className={s.panWrap}>
                <span>P</span>
                <input
                  className={s.pan}
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={t.mixer.pan}
                  onChange={(e) => updateMixer(t.id, { pan: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
