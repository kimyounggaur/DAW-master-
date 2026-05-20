import { useEffect } from "react";
import { TopBar } from "./layout/TopBar";
import { LeftBrowser } from "./layout/LeftBrowser";
import { RightInspector } from "./layout/RightInspector";
import { BottomPanel } from "./layout/BottomPanel";
import { MainArea } from "./layout/MainArea";
import { useUiStore } from "@/state/uiStore";
import { useTransportStore } from "@/state/transportStore";
import { engine } from "@/audio/engine";
import s from "./App.module.css";

export function App() {
  const toast = useUiStore((st) => st.toast);
  const bottomVisible = useUiStore((st) => st.bottomVisible);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const tgt = e.target;
      if (tgt instanceof HTMLInputElement || tgt instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        const t = useTransportStore.getState();
        if (t.isPlaying) t.stop();
        else {
          await engine.init();
          t.play();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toastClass =
    toast?.kind === "error" ? s.error : toast?.kind === "success" ? s.success : "";

  return (
    <div
      className={s.root}
      style={{ ["--bottom-h" as string]: bottomVisible ? "240px" : "32px" }}
    >
      <div className={s.topbar}>
        <TopBar />
      </div>
      <div className={s.left}>
        <LeftBrowser />
      </div>
      <div className={s.main}>
        <MainArea />
      </div>
      <div className={s.right}>
        <RightInspector />
      </div>
      <div className={s.bottom}>
        <BottomPanel />
      </div>
      {toast && <div className={`${s.toast} ${toastClass}`}>{toast.message}</div>}
    </div>
  );
}
