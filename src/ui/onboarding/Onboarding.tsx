import { useEffect, useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { useTransportStore } from "@/state/transportStore";
import { useUiStore } from "@/state/uiStore";
import { TEMPLATES, buildTemplate, type TemplateKind } from "./templates";
import s from "./Onboarding.module.css";

const VISITED_KEY = "flowdaw.visited";

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [coach, setCoach] = useState<null | "play" | "clip">(null);
  const isPlaying = useTransportStore((st) => st.isPlaying);

  useEffect(() => {
    try {
      if (!localStorage.getItem(VISITED_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (open) return;
    if (isPlaying) {
      setCoach(null);
      return;
    }
    const timer = setTimeout(() => setCoach("play"), 5000);
    return () => clearTimeout(timer);
  }, [open, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => setCoach("clip"), 10000);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  const choose = (kind: TemplateKind) => {
    try { localStorage.setItem(VISITED_KEY, "1"); } catch { /* noop */ }
    if (kind !== "empty") {
      const proj = buildTemplate(kind);
      useProjectStore.getState().loadProject(proj);
      useUiStore.getState().showToast(`${TEMPLATES.find((t) => t.id === kind)?.name} 템플릿 로드`, "success");
    }
    setOpen(false);
  };

  const skip = () => {
    try { localStorage.setItem(VISITED_KEY, "1"); } catch { /* noop */ }
    setOpen(false);
  };

  if (!open && !coach) return null;

  return (
    <>
      {open && (
        <div className={s.overlay}>
          <div className={s.dialog}>
            <h2 className={s.title}>FlowDAW에 오신 걸 환영해요</h2>
            <p className={s.subtitle}>
              어떤 음악을 만들고 싶으세요? 템플릿을 고르면 드럼·베이스·코드가 미리 깔린 채로 시작합니다.
            </p>
            <div className={s.cards}>
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={`${s.card} ${t.id === "empty" ? s.empty : ""}`}
                  onClick={() => choose(t.id)}
                >
                  <span className={s.cardTitle}>{t.name}</span>
                  <span className={s.cardDesc}>{t.description}</span>
                </div>
              ))}
            </div>
            <div className={s.actions}>
              <span>언제든 + Demo Drums 버튼으로 시작할 수도 있어요.</span>
              <button className={s.skip} onClick={skip}>스킵</button>
            </div>
          </div>
        </div>
      )}
      {coach === "play" && !open && (
        <div className={`${s.coach} ${s.play}`}>↑ Play를 눌러 들어보세요</div>
      )}
      {coach === "clip" && !open && (
        <div className={`${s.coach} ${s.clip}`}>↓ 클립을 더블클릭해 편집해 보세요</div>
      )}
    </>
  );
}
