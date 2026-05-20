import { engine } from "@/audio/engine";

const SAMPLE_DIR = "samples";

interface NavStorage {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
}

async function rootDir(): Promise<FileSystemDirectoryHandle | null> {
  const ns = navigator.storage as unknown as NavStorage;
  if (!ns.getDirectory) return null;
  return await ns.getDirectory();
}

async function ensureDir(): Promise<FileSystemDirectoryHandle | null> {
  const root = await rootDir();
  if (!root) return null;
  return await root.getDirectoryHandle(SAMPLE_DIR, { create: true });
}

export async function sha256(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const decodedCache = new Map<string, AudioBuffer>();
const metaCache = new Map<string, { name: string; size: number; duration: number; type: string }>();

export interface SampleMeta {
  id: string;
  name: string;
  size: number;
  duration: number;
  type: string;
}

export async function putSample(file: Blob, originalName: string): Promise<string> {
  const id = await sha256(file);
  const dir = await ensureDir();
  if (dir) {
    try {
      await dir.getFileHandle(id, { create: false });
      // already exists
    } catch {
      const fh = await dir.getFileHandle(id, { create: true });
      const w = await fh.createWritable();
      await w.write(file);
      await w.close();
    }
    // store name + duration via decode
  }
  // decode for meta
  if (!engine.ctx) await engine.init();
  const buf = await engine.ctx!.decodeAudioData(await file.arrayBuffer());
  decodedCache.set(id, buf);
  metaCache.set(id, {
    name: originalName,
    size: file.size,
    duration: buf.duration,
    type: file.type || "audio/wav",
  });
  // persist meta in IndexedDB later (S18)
  return id;
}

export async function getSample(id: string): Promise<Blob | null> {
  const dir = await ensureDir();
  if (!dir) return null;
  try {
    const fh = await dir.getFileHandle(id, { create: false });
    const f = await fh.getFile();
    return f;
  } catch {
    return null;
  }
}

export async function getDecodedSample(id: string): Promise<AudioBuffer | null> {
  if (!id) return null;
  if (decodedCache.has(id)) return decodedCache.get(id)!;
  const blob = await getSample(id);
  if (!blob) return null;
  if (!engine.ctx) await engine.init();
  const buf = await engine.ctx!.decodeAudioData(await blob.arrayBuffer());
  decodedCache.set(id, buf);
  return buf;
}

export async function listSamples(): Promise<SampleMeta[]> {
  const dir = await ensureDir();
  if (!dir) return [];
  const out: SampleMeta[] = [];
  // OPFS directory iteration uses async iterator on entries()
  const anyDir = dir as unknown as { values: () => AsyncIterable<FileSystemHandle> };
  for await (const h of anyDir.values()) {
    if (h.kind !== "file") continue;
    const meta = metaCache.get(h.name) ?? { name: h.name, size: 0, duration: 0, type: "" };
    out.push({ id: h.name, ...meta });
  }
  return out;
}

export function getSampleMeta(id: string): SampleMeta | null {
  const m = metaCache.get(id);
  if (!m) return null;
  return { id, ...m };
}

export function rememberMeta(id: string, meta: Omit<SampleMeta, "id">): void {
  metaCache.set(id, meta);
}
