import s from "@/ui/layout/RightInspector.module.css";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";

export function Inspector() {
  const selectedTrackId = useUiStore((st) => st.selectedTrackId);
  const selectedClipId = useUiStore((st) => st.selectedClipId);
  const project = useProjectStore((st) => st.project);

  const clip = selectedClipId ? project.clips[selectedClipId] : null;
  const track = selectedTrackId ? project.tracks.find((t) => t.id === selectedTrackId) : null;

  if (clip) return <ClipInspector clipId={clip.id} />;
  if (track) return <TrackInspector trackId={track.id} />;
  return <ProjectInspector />;
}

function ProjectInspector() {
  const project = useProjectStore((st) => st.project);
  const setBpm = useProjectStore((st) => st.setBpm);
  const setLengthBars = useProjectStore((st) => st.setLengthBars);

  return (
    <>
      <div className={s.section}>프로젝트</div>
      <div className={s.row}>
        <label>제목</label>
        <span>{project.meta.title}</span>
      </div>
      <div className={s.row}>
        <label>BPM</label>
        <input
          type="number"
          min={20}
          max={300}
          value={project.meta.bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
        />
      </div>
      <div className={s.row}>
        <label>박자</label>
        <span>
          {project.meta.timeSig[0]}/{project.meta.timeSig[1]}
        </span>
      </div>
      <div className={s.row}>
        <label>조성</label>
        <span>
          {project.meta.key.tonic} {project.meta.key.scale}
        </span>
      </div>
      <div className={s.row}>
        <label>길이(마디)</label>
        <input
          type="number"
          min={4}
          max={256}
          value={project.arrangement.lengthBars}
          onChange={(e) => setLengthBars(Number(e.target.value))}
        />
      </div>
      <div className={s.row}>
        <label>트랙 수</label>
        <span>{project.tracks.length}</span>
      </div>
      <div className={s.placeholder} style={{ marginTop: 16 }}>
        트랙이나 클립을 선택하면 여기에 옵션이 나타납니다.
      </div>
    </>
  );
}

function TrackInspector({ trackId }: { trackId: string }) {
  const track = useProjectStore((st) => st.project.tracks.find((t) => t.id === trackId));
  const renameTrack = useProjectStore((st) => st.renameTrack);
  if (!track) return <div className={s.placeholder}>트랙을 찾지 못했습니다</div>;

  return (
    <>
      <div className={s.section}>트랙</div>
      <div className={s.row}>
        <label>이름</label>
        <input value={track.name} onChange={(e) => renameTrack(track.id, e.target.value)} />
      </div>
      <div className={s.row}>
        <label>타입</label>
        <span>{track.type}</span>
      </div>
      <div className={s.row}>
        <label>색</label>
        <span style={{ display: "inline-block", width: 14, height: 14, background: track.color, borderRadius: 3 }} />
      </div>
      <div className={s.section}>디바이스 체인</div>
      {track.devices.length === 0 ? (
        <div className={s.placeholder}>이펙트가 없습니다</div>
      ) : (
        track.devices.map((d) => (
          <div key={d.id} className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.title}>{d.kind}</span>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function ClipInspector({ clipId }: { clipId: string }) {
  const clip = useProjectStore((st) => st.project.clips[clipId]);
  const moveClip = useProjectStore((st) => st.moveClip);
  const resizeClip = useProjectStore((st) => st.resizeClip);
  const updateClip = useProjectStore((st) => st.updateClip);

  if (!clip) return <div className={s.placeholder}>클립을 찾지 못했습니다</div>;

  return (
    <>
      <div className={s.section}>클립 ({clip.type})</div>
      <div className={s.row}>
        <label>이름</label>
        <input value={clip.name} onChange={(e) => updateClip(clip.id, { name: e.target.value })} />
      </div>
      <div className={s.row}>
        <label>시작 비트</label>
        <input
          type="number"
          min={0}
          step={0.25}
          value={clip.startBeat}
          onChange={(e) => moveClip(clip.id, Number(e.target.value))}
        />
      </div>
      <div className={s.row}>
        <label>길이 비트</label>
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={clip.lengthBeats}
          onChange={(e) => resizeClip(clip.id, Number(e.target.value))}
        />
      </div>
      <div className={s.row}>
        <label>반복</label>
        <input
          type="checkbox"
          checked={clip.loop}
          onChange={(e) => updateClip(clip.id, { loop: e.target.checked })}
        />
      </div>
    </>
  );
}
