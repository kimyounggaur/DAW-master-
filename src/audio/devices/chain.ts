import { engine } from "../engine";
import { useProjectStore } from "@/state/projectStore";
import { getOrCreateTrackNode } from "../tracks/trackGraph";
import { createDevice } from "./registry";
import type { AudioDevice } from "./types";

interface ChainState {
  /** deviceId → instance */
  devices: Map<string, AudioDevice>;
  /** ordered list */
  order: string[];
}

const chains = new Map<string, ChainState>();

function disconnectAll(node: GainNode | AudioNode) {
  try { node.disconnect(); } catch { /* noop */ }
}

function rewire(trackId: string) {
  const trackNode = getOrCreateTrackNode(trackId);
  if (!trackNode || !engine.ctx) return;
  const chain = chains.get(trackId);

  // Disconnect old: pan was previously connected to either output (no chain) or first device
  disconnectAll(trackNode.pan);
  if (chain) {
    for (const id of chain.order) {
      const dev = chain.devices.get(id);
      if (dev) {
        disconnectAll(dev.output);
      }
    }
  }

  if (!chain || chain.order.length === 0) {
    trackNode.pan.connect(trackNode.output);
    return;
  }

  let prevOut: AudioNode = trackNode.pan;
  for (const id of chain.order) {
    const dev = chain.devices.get(id);
    if (!dev) continue;
    prevOut.connect(dev.input);
    prevOut = dev.output;
  }
  prevOut.connect(trackNode.output);
}

export function syncTrackDevices(trackId: string): void {
  if (!engine.ctx) return;
  const project = useProjectStore.getState().project;
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return;
  let chain = chains.get(trackId);
  if (!chain) {
    chain = { devices: new Map(), order: [] };
    chains.set(trackId, chain);
  }
  const wantedIds = new Set(track.devices.map((d) => d.id));

  // remove devices not in track
  for (const [id, dev] of chain.devices) {
    if (!wantedIds.has(id)) {
      dev.dispose();
      chain.devices.delete(id);
    }
  }

  // create missing devices and apply params/bypass
  for (const ds of track.devices) {
    let dev = chain.devices.get(ds.id);
    if (!dev) {
      const created = createDevice(ds.kind);
      if (!created) continue;
      chain.devices.set(ds.id, created);
      dev = created;
    }
    // apply params
    for (const p of dev.params) {
      const v = ds.params[p.id];
      if (typeof v === "number") dev.set(p.id, v);
    }
    dev.setBypass(ds.bypass);
  }

  // order
  chain.order = track.devices.map((d) => d.id).filter((id) => chain!.devices.has(id));
  rewire(trackId);
}

export function syncAllDevices(): void {
  const project = useProjectStore.getState().project;
  for (const t of project.tracks) syncTrackDevices(t.id);
}

export function subscribeDeviceSync(): () => void {
  const onChange = () => syncAllDevices();
  const unsubP = useProjectStore.subscribe(onChange);
  const unsubR = engine.onReady(() => syncAllDevices());
  return () => {
    unsubP();
    unsubR();
  };
}
