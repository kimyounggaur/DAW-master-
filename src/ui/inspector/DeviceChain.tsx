import { Power, X } from "lucide-react";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { DEVICE_KINDS, DEVICE_LABELS, createDevice } from "@/audio/devices/registry";
import { Knob } from "@/ui/common/Knob";
import s from "./DeviceChain.module.css";

export function DeviceChain() {
  const selectedTrackId = useUiStore((st) => st.selectedTrackId);
  const project = useProjectStore((st) => st.project);
  const upsertDevice = useProjectStore((st) => st.upsertDevice);
  const removeDevice = useProjectStore((st) => st.removeDevice);
  const setBypass = useProjectStore((st) => st.setDeviceBypass);
  const setParam = useProjectStore((st) => st.setDeviceParam);

  const trackId = selectedTrackId ?? project.tracks.find((t) => t.type === "master")?.id ?? null;
  const track = trackId ? project.tracks.find((t) => t.id === trackId) : null;

  if (!track) {
    return <div className={s.empty}>트랙을 선택하세요</div>;
  }

  return (
    <div className={s.root}>
      <div style={{ marginBottom: 8, color: "var(--fg-2)", fontSize: 11 }}>
        트랙: <strong style={{ color: "var(--fg-0)" }}>{track.name}</strong>
      </div>
      <div className={s.rows}>
        {track.devices.length === 0 && (
          <div className={s.empty}>이펙트가 없습니다. 아래에서 추가하세요.</div>
        )}
        {track.devices.map((d) => {
          // create a temporary device just to fetch param schemas without mounting
          const proto = createDevice(d.kind);
          const params = proto?.params ?? [];
          proto?.dispose();
          return (
            <div key={d.id} className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>{DEVICE_LABELS[d.kind] ?? d.kind}</span>
                <div className={s.cardActions}>
                  <button
                    className={`${s.iconBtn} ${d.bypass ? "" : s.active}`}
                    title="활성/바이패스"
                    onClick={() => setBypass(track.id, d.id, !d.bypass)}
                  >
                    <Power size={12} />
                  </button>
                  <button
                    className={`${s.iconBtn} ${s.danger}`}
                    title="제거"
                    onClick={() => removeDevice(track.id, d.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div className={s.params}>
                {params.map((p) => (
                  <Knob
                    key={p.id}
                    param={p}
                    value={d.params[p.id] ?? p.default}
                    onChange={(v) => setParam(track.id, d.id, p.id, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.add}>
        {DEVICE_KINDS.map((kind) => (
          <button key={kind} className={s.addBtn} onClick={() => upsertDevice(track.id, kind)}>
            + {DEVICE_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
