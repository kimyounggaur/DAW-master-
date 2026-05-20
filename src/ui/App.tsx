import { useEffect } from "react";
import { TopBar } from "./layout/TopBar";
import { LeftBrowser } from "./layout/LeftBrowser";
import { RightInspector } from "./layout/RightInspector";
import { BottomPanel } from "./layout/BottomPanel";
import { MainArea } from "./layout/MainArea";
import { useUiStore } from "@/state/uiStore";
import { useTransportStore } from "@/state/transportStore";
import { engine } from "@/audio/engine";
import { startTransportClock, stopTransportClock } from "@/audio/transport";
import { startScheduler, stopScheduler, resyncSchedule } from "@/audio/scheduler";
import { installMetronome } from "@/audio/metronome";
import { subscribeMixerSync } from "@/audio/tracks/trackGraph";
import { installClipScheduler } from "@/audio/clipScheduler";
import { ensureAllInstruments } from "@/audio/instruments/hosting";
import { subscribeDeviceSync } from "@/audio/devices/chain";
import s from "./App.module.css";

export function App() {
  const toast = useUiStore((st) => st.toast);
  const bottomVisible = useUiStore((st) => st.bottomVisible);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let stopMetronome: (() => void) | null = null;
    const stopMixer = subscribeMixerSync();
    const stopDevices = subscribeDeviceSync();
    let stopClipScheduler: (() => void) | null = null;
    const unsub = engine.onReady(() => {
      stop = startTransportClock();
      stopMetronome = installMetronome();
      stopClipScheduler = installClipScheduler();
      ensureAllInstruments();
      startScheduler();
    });
    const unsubTransport = useTransportStore.subscribe((state, prev) => {
      if (state.isPlaying && !prev.isPlaying) resyncSchedule();
      if (!state.isPlaying && prev.isPlaying) resyncSchedule();
    });
    return () => {
      unsub();
      unsubTransport();
      if (stop) stop();
      else stopTransportClock();
      stopMetronome?.();
      stopScheduler();
      stopMixer();
      stopDevices();
      stopClipScheduler?.();
    };
  }, []);

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
