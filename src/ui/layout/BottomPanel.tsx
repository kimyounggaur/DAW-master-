import { useUiStore, type BottomTab } from "@/state/uiStore";
import { useProjectStore } from "@/state/projectStore";
import { StepSequencer } from "@/ui/stepSequencer/StepSequencer";
import { PianoRoll } from "@/ui/pianoRoll/PianoRoll";
import { DeviceChain } from "@/ui/inspector/DeviceChain";
import s from "./BottomPanel.module.css";

const TABS: { id: BottomTab; label: string }[] = [
  { id: "device", label: "디바이스 체인" },
  { id: "pattern", label: "패턴 에디터" },
  { id: "piano", label: "피아노 롤" },
  { id: "automation", label: "오토메이션" },
];

export function BottomPanel() {
  const tab = useUiStore((st) => st.bottomTab);
  const setTab = useUiStore((st) => st.setBottomTab);
  const visible = useUiStore((st) => st.bottomVisible);
  const setVisible = useUiStore((st) => st.setBottomVisible);
  const selectedClipId = useUiStore((st) => st.selectedClipId);
  const clip = useProjectStore((st) => (selectedClipId ? st.project.clips[selectedClipId] : null));

  if (!visible) {
    return (
      <div className={s.root}>
        <div className={s.tabs}>
          <span className={s.tab}>축소됨</span>
          <div className={s.spacer} />
          <button className={s.collapse} onClick={() => setVisible(true)}>
            펼치기 ▴
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${s.tab} ${tab === t.id ? s.active : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className={s.spacer} />
        <button className={s.collapse} onClick={() => setVisible(false)}>
          접기 ▾
        </button>
      </div>
      <div className={s.content}>
        {tab === "device" && <DeviceChain />}
        {tab === "pattern" &&
          (clip && clip.type === "pattern" ? (
            <StepSequencer clipId={clip.id} />
          ) : (
            <div className={s.placeholder}>패턴 클립을 선택하세요</div>
          ))}
        {tab === "piano" &&
          (clip && clip.type === "midi" ? (
            <PianoRoll clipId={clip.id} />
          ) : (
            <div className={s.placeholder}>MIDI 클립을 선택하세요</div>
          ))}
        {tab === "automation" && <div className={s.placeholder}>오토메이션은 Phase 2에서 추가됩니다</div>}
      </div>
    </div>
  );
}
