import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { putProject, pushRevision, getLatestProject } from "./indexeddb";

const DEBOUNCE_MS = 2000;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = "";

function indicator(state: "idle" | "saving" | "saved" | "error") {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  if (state === "saving") el.textContent = "저장 중…";
  else if (state === "saved") el.textContent = "저장됨";
  else if (state === "error") el.textContent = "저장 실패";
  else el.textContent = "";
  if (state === "saved") {
    setTimeout(() => {
      if (el.textContent === "저장됨") el.textContent = "";
    }, 2000);
  }
}

async function performSave() {
  const project = useProjectStore.getState().project;
  try {
    indicator("saving");
    project.meta.updatedAt = Date.now();
    await putProject(project);
    indicator("saved");
    // every 10 saves, push a revision (keep history short)
    if (Math.random() < 0.2) await pushRevision(project);
  } catch (e) {
    console.warn("autosave failed", e);
    indicator("error");
    useUiStore.getState().showToast("저장 실패. 다시 시도", "error");
  }
}

export function startAutosave(): () => void {
  const trigger = () => {
    const project = useProjectStore.getState().project;
    const serialized = JSON.stringify({
      ...project,
      meta: { ...project.meta, updatedAt: 0 }, // ignore timestamp churn
    });
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(performSave, DEBOUNCE_MS);
  };

  const unsub = useProjectStore.subscribe(trigger);

  const beforeUnload = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    void performSave();
  };
  window.addEventListener("beforeunload", beforeUnload);

  return () => {
    unsub();
    window.removeEventListener("beforeunload", beforeUnload);
    if (saveTimer) clearTimeout(saveTimer);
  };
}

export async function loadLatestProject(): Promise<boolean> {
  try {
    const params = new URLSearchParams(location.search);
    const pid = params.get("p");
    if (pid) {
      const { getProject } = await import("./indexeddb");
      const p = await getProject(pid);
      if (p) {
        useProjectStore.getState().loadProject(p);
        lastSerialized = JSON.stringify({ ...p, meta: { ...p.meta, updatedAt: 0 } });
        return true;
      }
    }
    const latest = await getLatestProject();
    if (latest) {
      useProjectStore.getState().loadProject(latest);
      lastSerialized = JSON.stringify({ ...latest, meta: { ...latest.meta, updatedAt: 0 } });
      return true;
    }
  } catch (e) {
    console.warn("loadLatestProject failed", e);
  }
  return false;
}
