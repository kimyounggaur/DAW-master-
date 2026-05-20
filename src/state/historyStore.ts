import { create } from "zustand";
import { useProjectStore } from "./projectStore";
import type { Project } from "@/model/project";

const MAX_ENTRIES = 200;

interface Entry {
  project: Project;
  label: string;
  ts: number;
}

export interface HistoryState {
  undoStack: Entry[];
  redoStack: Entry[];
  recording: boolean;
  groupActive: boolean;
  groupLabel: string;
  /** capture a snapshot before mutation */
  pushBefore: (label: string) => void;
  beginGroup: (label: string) => void;
  endGroup: () => void;
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
}

function deepClone<T>(o: T): T {
  return structuredClone(o);
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  recording: true,
  groupActive: false,
  groupLabel: "",

  pushBefore: (label) => {
    const project = useProjectStore.getState().project;
    set((s) => {
      const cur: Entry = { project: deepClone(project), label, ts: Date.now() };
      const next = s.undoStack.slice();
      next.push(cur);
      while (next.length > MAX_ENTRIES) next.shift();
      return { undoStack: next, redoStack: [] };
    });
  },

  beginGroup: (label) => {
    const s = get();
    if (s.groupActive) return;
    const project = useProjectStore.getState().project;
    set({
      groupActive: true,
      groupLabel: label,
      undoStack: (() => {
        const cur: Entry = { project: deepClone(project), label, ts: Date.now() };
        const next = s.undoStack.slice();
        next.push(cur);
        while (next.length > MAX_ENTRIES) next.shift();
        return next;
      })(),
      redoStack: [],
    });
  },
  endGroup: () => set({ groupActive: false, groupLabel: "" }),

  undo: () => {
    const s = get();
    if (s.undoStack.length === 0) return false;
    const prev = s.undoStack[s.undoStack.length - 1];
    if (!prev) return false;
    const cur = useProjectStore.getState().project;
    set({
      recording: false,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, { project: deepClone(cur), label: prev.label, ts: Date.now() }],
    });
    useProjectStore.getState().loadProject(deepClone(prev.project));
    set({ recording: true });
    return true;
  },

  redo: () => {
    const s = get();
    if (s.redoStack.length === 0) return false;
    const next = s.redoStack[s.redoStack.length - 1];
    if (!next) return false;
    const cur = useProjectStore.getState().project;
    set({
      recording: false,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { project: deepClone(cur), label: next.label, ts: Date.now() }],
    });
    useProjectStore.getState().loadProject(deepClone(next.project));
    set({ recording: true });
    return true;
  },

  clear: () => set({ undoStack: [], redoStack: [] }),
}));
