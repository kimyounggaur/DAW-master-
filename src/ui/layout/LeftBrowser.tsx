import { useEffect, useRef, useState } from "react";
import { useUiStore, type LeftTab } from "@/state/uiStore";
import { listSamples, putSample, type SampleMeta } from "@/storage/opfs";
import { preloadPeaks } from "@/storage/peakCache";
import { engine } from "@/audio/engine";
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
  const [samples, setSamples] = useState<SampleMeta[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const showToast = useUiStore((st) => st.showToast);

  useEffect(() => {
    void listSamples().then(setSamples);
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await engine.init();
    for (const f of Array.from(files)) {
      try {
        const id = await putSample(f, f.name);
        void preloadPeaks(id);
        showToast(`임포트: ${f.name}`, "success");
      } catch {
        showToast(`실패: ${f.name}`, "error");
      }
    }
    setSamples(await listSamples());
    if (fileInput.current) fileInput.current.value = "";
  };

  const startDrag = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("application/x-flowdaw-sample", id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <>
      <div className={s.section}>가져온 샘플</div>
      {samples.length === 0 ? (
        <div className={s.placeholder}>샘플이 비어있습니다</div>
      ) : (
        samples.map((sm) => (
          <div
            key={sm.id}
            className={s.item}
            draggable
            onDragStart={(e) => startDrag(e, sm.id)}
            title={`${sm.name}\n${sm.duration.toFixed(2)}s · ${Math.round(sm.size / 1024)} KB`}
          >
            <span className={s.name}>{sm.name || sm.id.slice(0, 8)}</span>
            <span className={s.meta}>{sm.duration ? sm.duration.toFixed(1) + "s" : ""}</span>
          </div>
        ))
      )}
      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: "none" }}
        onChange={onPick}
      />
      <div className={s.upload} onClick={() => fileInput.current?.click()}>
        + 오디오 파일 가져오기
      </div>
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
  const showToast = useUiStore((st) => st.showToast);
  return (
    <>
      <div className={s.section}>템플릿</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <TemplateRow id="lofi" name="Lo-fi Beat" desc="90 BPM A minor" onLoad={showToast} />
        <TemplateRow id="pop" name="Pop Loop" desc="110 BPM C major" onLoad={showToast} />
        <TemplateRow id="edm" name="EDM Drop" desc="128 BPM F minor" onLoad={showToast} />
        <TemplateRow id="kpop" name="K-Pop Verse" desc="120 BPM G minor" onLoad={showToast} />
        <TemplateRow id="empty" name="Empty" desc="비어있는 프로젝트" onLoad={showToast} />
      </div>
    </>
  );
}

function TemplateRow({
  id,
  name,
  desc,
  onLoad,
}: {
  id: import("@/ui/onboarding/templates").TemplateKind;
  name: string;
  desc: string;
  onLoad: (msg: string, kind?: "info" | "error" | "success") => void;
}) {
  return (
    <div
      className={s.item}
      onClick={async () => {
        const { buildTemplate } = await import("@/ui/onboarding/templates");
        const { useProjectStore: ps } = await import("@/state/projectStore");
        if (id === "empty") ps.getState().createEmptyProject();
        else ps.getState().loadProject(buildTemplate(id));
        onLoad(`${name} 로드 완료`, "success");
      }}
      title={desc}
    >
      <span className={s.name}>{name}</span>
      <span className={s.meta}>{desc}</span>
    </div>
  );
}
