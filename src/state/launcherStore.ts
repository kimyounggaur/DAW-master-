import { create } from "zustand";

export interface PendingLaunch {
  trackId: string;
  clipId: string | null; // null = stop
  launchAtBeat: number;
}

export interface LauncherState {
  /** trackId → currently playing clipId */
  active: Record<string, string | null>;
  /** trackId → pending launch info */
  pending: Record<string, PendingLaunch | null>;
  setActive: (trackId: string, clipId: string | null) => void;
  setPending: (trackId: string, p: PendingLaunch | null) => void;
  clear: () => void;
}

export const useLauncherStore = create<LauncherState>()((set) => ({
  active: {},
  pending: {},
  setActive: (trackId, clipId) =>
    set((s) => ({ active: { ...s.active, [trackId]: clipId } })),
  setPending: (trackId, p) =>
    set((s) => ({ pending: { ...s.pending, [trackId]: p } })),
  clear: () => set({ active: {}, pending: {} }),
}));
