import { create } from "zustand";

export type SnapValue = "bar" | "beat" | "1/16";
export type MainView = "timeline" | "launcher" | "mixer";
export type BottomTab = "device" | "pattern" | "piano" | "automation";
export type LeftTab = "samples" | "instruments" | "effects" | "templates";

export interface UiState {
  selectedTrackId: string | null;
  selectedClipId: string | null;
  zoomX: number;
  zoomY: number;
  scrollX: number;
  scrollY: number;
  snap: SnapValue;
  mainView: MainView;
  bottomTab: BottomTab;
  leftTab: LeftTab;
  bottomVisible: boolean;
  toast: { id: number; message: string; kind: "info" | "error" | "success" } | null;
  selectTrack: (id: string | null) => void;
  selectClip: (id: string | null) => void;
  setZoom: (x?: number, y?: number) => void;
  setScroll: (x?: number, y?: number) => void;
  setSnap: (snap: SnapValue) => void;
  setMainView: (v: MainView) => void;
  setBottomTab: (t: BottomTab) => void;
  setLeftTab: (t: LeftTab) => void;
  setBottomVisible: (v: boolean) => void;
  showToast: (message: string, kind?: "info" | "error" | "success") => void;
  clearToast: () => void;
}

let toastCounter = 0;

export const useUiStore = create<UiState>()((set) => ({
  selectedTrackId: null,
  selectedClipId: null,
  zoomX: 32,
  zoomY: 64,
  scrollX: 0,
  scrollY: 0,
  snap: "1/16",
  mainView: "timeline",
  bottomTab: "device",
  leftTab: "samples",
  bottomVisible: true,
  toast: null,

  selectTrack: (id) => set({ selectedTrackId: id, selectedClipId: null }),
  selectClip: (id) => set({ selectedClipId: id }),
  setZoom: (x, y) =>
    set((s) => ({
      zoomX: x !== undefined ? Math.max(4, Math.min(256, x)) : s.zoomX,
      zoomY: y !== undefined ? Math.max(28, Math.min(200, y)) : s.zoomY,
    })),
  setScroll: (x, y) =>
    set((s) => ({
      scrollX: x !== undefined ? Math.max(0, x) : s.scrollX,
      scrollY: y !== undefined ? Math.max(0, y) : s.scrollY,
    })),
  setSnap: (snap) => set({ snap }),
  setMainView: (v) => set({ mainView: v }),
  setBottomTab: (t) => set({ bottomTab: t, bottomVisible: true }),
  setLeftTab: (t) => set({ leftTab: t }),
  setBottomVisible: (v) => set({ bottomVisible: v }),
  showToast: (message, kind = "info") => {
    const id = ++toastCounter;
    set({ toast: { id, message, kind } });
    setTimeout(() => {
      const cur = (useUiStore.getState().toast);
      if (cur && cur.id === id) set({ toast: null });
    }, 4000);
  },
  clearToast: () => set({ toast: null }),
}));
