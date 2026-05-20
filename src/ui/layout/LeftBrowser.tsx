import { useUiStore, type LeftTab } from "@/state/uiStore";
import s from "./LeftBrowser.module.css";

const TABS: { id: LeftTab; label: string }[] = [
  { id: "samples", label: "샘플" },
  { id: "instruments", label: "악기" },
  { id: "effects", label: "이펙트" },
  { id: "templates", label: "템플릿" },
];

export function LeftBrowser() {
  const tab = useUiStore((s) => s.leftTab);
  const setTab = useUiStore((s) => s.setLeftTab);

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
      </div>
      <div className={s.content}>
        {tab === "samples" && <SamplesPanel />}
        {tab === "instruments" && <InstrumentsPanel />}
        {tab === "effects" && <EffectsPanel />}
        {tab === "templates" && <TemplatesPanel />}
      </div>
    </div>
  );
}

function SamplesPanel() {
  return (
    <>
      <div className={s.section}>가져온 샘플</div>
      <div className={s.placeholder}>샘플이 비어있습니다</div>
    </>
  );
}

function InstrumentsPanel() {
  return (
    <>
      <div className={s.section}>내장 악기</div>
      <div className={s.item} draggable data-instrument="simpleSynth">
        <span className={s.name}>Simple Synth</span>
        <span className={s.meta}>Synth</span>
      </div>
      <div className={s.item} draggable data-instrument="drumSampler">
        <span className={s.name}>Drum Sampler</span>
        <span className={s.meta}>Drum</span>
      </div>
    </>
  );
}

function EffectsPanel() {
  const fx = [
    { kind: "eq3", name: "EQ3", group: "EQ" },
    { kind: "compressor", name: "Compressor", group: "Dynamics" },
    { kind: "delay", name: "Delay", group: "Time" },
    { kind: "reverb", name: "Reverb", group: "Space" },
    { kind: "limiter", name: "Limiter", group: "Dynamics" },
  ];
  return (
    <>
      <div className={s.section}>이펙트</div>
      {fx.map((f) => (
        <div key={f.kind} className={s.item} draggable data-effect={f.kind}>
          <span className={s.name}>{f.name}</span>
          <span className={s.meta}>{f.group}</span>
        </div>
      ))}
    </>
  );
}

function TemplatesPanel() {
  return (
    <>
      <div className={s.section}>템플릿</div>
      <div className={s.placeholder}>S21에서 채워집니다</div>
    </>
  );
}
