import type { Project } from "@/model/project";

const DB_NAME = "flowdaw";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) {
        const store = db.createObjectStore("projects", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
      }
      if (!db.objectStoreNames.contains("revisions")) {
        const store = db.createObjectStore("revisions", { keyPath: ["projectId", "rev"] });
        store.createIndex("by-project", "projectId");
      }
      if (!db.objectStoreNames.contains("samples-meta")) {
        db.createObjectStore("samples-meta", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface ProjectRecord {
  id: string;
  title: string;
  updatedAt: number;
  project: Project;
}

interface RevisionRecord {
  projectId: string;
  rev: number;
  ts: number;
  project: Project;
}

export async function putProject(project: Project): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put({
      id: project.id,
      title: project.meta.title,
      updatedAt: project.meta.updatedAt,
      project,
    } satisfies ProjectRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").get(id);
    req.onsuccess = () => {
      const rec = req.result as ProjectRecord | undefined;
      resolve(rec?.project ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").getAll();
    req.onsuccess = () => resolve((req.result as ProjectRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestProject(): Promise<Project | null> {
  const projects = await listProjects();
  if (projects.length === 0) return null;
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects[0]?.project ?? null;
}

export async function pushRevision(project: Project): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("revisions", "readwrite");
    const store = tx.objectStore("revisions");
    const indexReq = store.index("by-project").getAll(project.id);
    indexReq.onsuccess = () => {
      const all = (indexReq.result as RevisionRecord[]) ?? [];
      const next = all.length === 0 ? 1 : Math.max(...all.map((r) => r.rev)) + 1;
      store.put({ projectId: project.id, rev: next, ts: Date.now(), project } satisfies RevisionRecord);
      // trim
      if (all.length >= 10) {
        all.sort((a, b) => a.rev - b.rev);
        for (let i = 0; i <= all.length - 10; i++) {
          const r = all[i];
          if (r) store.delete([r.projectId, r.rev]);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listRevisions(projectId: string): Promise<RevisionRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("revisions", "readonly");
    const req = tx.objectStore("revisions").index("by-project").getAll(projectId);
    req.onsuccess = () => resolve((req.result as RevisionRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function putSampleMeta(id: string, meta: { name: string; size: number; duration: number; type: string }): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("samples-meta", "readwrite");
    tx.objectStore("samples-meta").put({ id, ...meta });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSampleMeta(): Promise<Array<{ id: string; name: string; size: number; duration: number; type: string }>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("samples-meta", "readonly");
    const req = tx.objectStore("samples-meta").getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}
