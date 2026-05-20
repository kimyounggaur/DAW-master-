import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { useTransportStore } from "@/state/transportStore";
import { useLauncherStore } from "@/state/launcherStore";
import { newId } from "@/lib/id";
import { engine } from "@/audio/engine";
import s from "./ClipLauncher.module.css";

export function ClipLauncher() {
  const tracks = useProjectStore((st) => st.project.tracks).filter((t) => t.type !== "master");
  const scenes = useProjectStore((st) => st.project.scenes);
  const clips = useProjectStore((st) => st.project.clips);
  const timeSig = useProjectStore((st) => st.project.meta.timeSig);
  const setLauncherSlot = useProjectStore((st) => st.setLauncherSlot);
  const addClip = useProjectStore((st) => st.addClip);
  const active = useLauncherStore((st) => st.active);
  const pending = useLauncherStore((st) => st.pending);
  const setPending = useLauncherStore((st) => st.setPending);
  const setActive = useLauncherStore((st) => st.setActive);
  const positionBeats = useTransportStore((st) => st.positionBeats);
  const isPlaying = useTransportStore((st) => st.isPlaying);

  const launch = async (trackId: string, clipId: string | null, immediate: boolean) => {
    await engine.init();
    if (!isPlaying) {
      // immediate when stopped means: start at 0 with this clip
      useTransportStore.getState().setPosition(0);
      setActive(trackId, clipId);
      useTransportStore.getState().play();
      return;
    }
    if (immediate) {
      setActive(trackId, clipId);
      setPending(trackId, null);
      return;
    }
    const beatsPerBar = timeSig[0];
    const nextBar = Math.ceil(positionBeats / beatsPerBar) * beatsPerBar;
    const launchAt = nextBar === positionBeats ? nextBar + beatsPerBar : nextBar;
    setPending(trackId, { trackId, clipId, launchAtBeat: launchAt });
  };

  const launchScene = async (sceneIndex: number) => {
    for (const t of tracks) {
      const clipId = t.launcherSlots[sceneIndex] ?? null;
      await launch(t.id, clipId, false);
    }
  };

  const onSlotClick = (trackId: string, sceneIndex: number, ev: React.MouseEvent) => {
    const t = tracks.find((x) => x.id === trackId);
    if (!t) return;
    const clipId = t.launcherSlots[sceneIndex];
    if (!clipId) {
      // create empty pattern/midi/audio depending on type
      const type: "pattern" | "midi" | "audio" =
        t.type === "drum" ? "pattern" : t.type === "instrument" ? "midi" : "audio";
      if (type === "audio") {
        useUiStore.getState().showToast("오디오 클립은 파일 드롭으로 만드세요", "info");
        return;
      }
      const newClipId = newId();
      addClip(trackId, type, 0, 4, { id: newClipId, name: `${t.name} ${sceneIndex + 1}` });
      const justAdded = useProjectStore.getState().project.clips;
      const realId = Object.values(justAdded).find(
        (c) => c.trackId === trackId && c.name === `${t.name} ${sceneIndex + 1}`,
      )?.id;
      if (realId) setLauncherSlot(trackId, sceneIndex, realId);
      return;
    }
    useUiStore.getState().selectClip(clipId);
    void launch(trackId, clipId, ev.ctrlKey || ev.metaKey);
  };

  return (
    <div className={s.root}>
      <div className={s.grid} style={{ ["--cols" as string]: tracks.length }}>
        <div className={s.headerCell}>Scene</div>
        {tracks.map((t) => (
          <div key={t.id} className={s.headerCell} style={{ borderTop: `3px solid ${t.color}` }}>
            {t.name}
          </div>
        ))}
        <div className={s.headerCell}>Master</div>

        {scenes.map((scene, sIdx) => (
          <div key={scene.id} style={{ display: "contents" }}>
            <div className={s.sceneHeader}>
              <span>{scene.name}</span>
              <button className={s.sceneLaunch} onClick={() => launchScene(sIdx)} title="씬 런치">
                ▶
              </button>
            </div>
            {tracks.map((t) => {
              const clipId = t.launcherSlots[sIdx];
              const clip = clipId ? clips[clipId] : null;
              const isPlaying = active[t.id] === clipId && clipId != null;
              const isPending = pending[t.id]?.clipId === clipId && clipId != null;
              return (
                <div
                  key={t.id + "-" + sIdx}
                  className={`${s.cell} ${clip ? s.filled : ""} ${isPlaying ? s.playing : ""} ${isPending ? s.pending : ""}`}
                  onClick={(ev) => onSlotClick(t.id, sIdx, ev)}
                  title={clip ? `${clip.name} (Ctrl+클릭: 즉시)` : "비어있음 (클릭으로 생성)"}
                >
                  {clip ? <span className={s.cellName}>{clip.name}</span> : <span className={s.empty}>+</span>}
                </div>
              );
            })}
            <div className={s.masterCol}>
              <button
                className={s.sceneLaunch}
                style={{ width: "100%", borderRadius: 4 }}
                onClick={() => {
                  for (const t of tracks) setActive(t.id, null);
                }}
              >
                Stop
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-2)" }}>
        클릭 = 다음 마디에서 launch · Ctrl+클릭 = 즉시 · ▶ = 씬 launch
      </div>
    </div>
  );
}
