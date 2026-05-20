import { create } from "zustand";

export interface LoopState {
  enabled: boolean;
  startBeat: number;
  endBeat: number;
}

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  positionBeats: number;
  loop: LoopState;
  metronomeOn: boolean;
  play: () => void;
  stop: () => void;
  toggleRecord: () => void;
  setPosition: (beat: number) => void;
  setLoop: (loop: Partial<LoopState>) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
}

export const useTransportStore = create<TransportState>()((set) => ({
  isPlaying: false,
  isRecording: false,
  positionBeats: 0,
  loop: { enabled: false, startBeat: 0, endBeat: 16 },
  metronomeOn: true,

  play: () => set({ isPlaying: true }),
  stop: () =>
    set((s) => ({
      isPlaying: false,
      isRecording: false,
      positionBeats: s.loop.enabled ? s.loop.startBeat : 0,
    })),
  toggleRecord: () => set((s) => ({ isRecording: !s.isRecording })),
  setPosition: (beat) => set({ positionBeats: Math.max(0, beat) }),
  setLoop: (loop) =>
    set((s) => ({
      loop: {
        enabled: loop.enabled ?? s.loop.enabled,
        startBeat: loop.startBeat ?? s.loop.startBeat,
        endBeat: loop.endBeat ?? s.loop.endBeat,
      },
    })),
  toggleLoop: () =>
    set((s) => ({ loop: { ...s.loop, enabled: !s.loop.enabled } })),
  toggleMetronome: () => set((s) => ({ metronomeOn: !s.metronomeOn })),
}));
