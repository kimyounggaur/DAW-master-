export type TrackType = "audio" | "instrument" | "drum" | "bus" | "master";

export interface Send {
  targetTrackId: string;
  amountDb: number;
  preFader: boolean;
}

export interface DeviceState {
  id: string;
  kind: string;
  bypass: boolean;
  params: Record<string, number>;
}

export interface TrackMixer {
  volumeDb: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  sends: Send[];
}

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  color: string;
  height: number;
  mixer: TrackMixer;
  devices: DeviceState[];
  instrument?: DeviceState;
  launcherSlots: (string | null)[];
  timelineClips: string[];
}
