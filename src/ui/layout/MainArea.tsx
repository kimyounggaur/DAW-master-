import { ZoomIn, ZoomOut } from "lucide-react";
import { useUiStore, type MainView, type SnapValue } from "@/state/uiStore";
import { Timeline } from "@/ui/timeline/Timeline";
import { ClipLauncher } from "@/ui/launcher/ClipLauncher";
import { Mixer } from "@/ui/mixer/Mixer";
import s from "./MainArea.module.css";

const VIEWS: { id: MainView; label: string }[] = [
  { id: "timeline", label: "타임라인" },
  { id: "launcher", label: "클립 런처" },
  { id: "mixer", label: "믹서" },
];

const SNAP_OPTIONS: { id: SnapValue; label: string }[] = [
  { id: "bar", label: "마디" },
  { id: "beat", label: "박" },
  { id: "1/16", label: "1/16" },
];

export function MainArea() {
  const view = useUiStore((st) => st.mainView);
  const setView = useUiStore((st) => st.setMainView);
  const snap = useUiStore((st) => st.snap);
  const setSnap = useUiStore((st) => st.setSnap);
  const zoomX = useUiStore((st) => st.zoomX);
  const setZoom = useUiStore((st) => st.setZoom);

  return (
    <div className={s.root}>
      <div className={s.tabs}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`${s.tab} ${view === v.id ? s.active : ""}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
        <div className={s.spacer} />
        {view === "timeline" && (
          <>
            <label style={{ fontSize: 11, color: "var(--fg-2)" }}>스냅</label>
            <select
              className={s.snap}
              value={snap}
              onChange={(e) => setSnap(e.target.value as SnapValue)}
            >
              {SNAP_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className={s.zoomBtns}>
              <button className={s.iconBtn} onClick={() => setZoom(zoomX / 1.25)} aria-label="줌 아웃">
                <ZoomOut size={12} />
              </button>
              <button className={s.iconBtn} onClick={() => setZoom(zoomX * 1.25)} aria-label="줌 인">
                <ZoomIn size={12} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className={s.content}>
        {view === "timeline" && <Timeline />}
        {view === "launcher" && <ClipLauncher />}
        {view === "mixer" && <Mixer />}
      </div>
    </div>
  );
}
