import { engine } from "../engine";

export interface DrumVoice {
  name: string;
  buffer?: AudioBuffer;
}

const DEFAULT_DRUMS: { name: string; type: OscillatorType | "noise"; freq: number; dur: number; pitchEnv?: number }[] = [
  { name: "Kick", type: "sine", freq: 60, dur: 0.5, pitchEnv: 80 },
  { name: "Snare", type: "noise", freq: 200, dur: 0.18 },
  { name: "HH-C", type: "noise", freq: 8000, dur: 0.04 },
  { name: "HH-O", type: "noise", freq: 8000, dur: 0.3 },
  { name: "Clap", type: "noise", freq: 1500, dur: 0.15 },
  { name: "Tom-Lo", type: "sine", freq: 100, dur: 0.4 },
  { name: "Tom-Hi", type: "sine", freq: 200, dur: 0.35 },
  { name: "Perc", type: "triangle", freq: 700, dur: 0.1 },
];

export interface DrumSampler {
  output: GainNode;
  trigger: (row: number, velocity: number, when: number) => void;
  load: () => Promise<void>;
  voices: DrumVoice[];
}

function makeSynthDrum(
  ctx: AudioContext,
  dest: AudioNode,
  spec: (typeof DEFAULT_DRUMS)[number],
  velocity: number,
  when: number,
) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(velocity, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.dur);
  gain.connect(dest);

  if (spec.type === "noise") {
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(spec.dur * sr));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = spec.name === "HH-C" || spec.name === "HH-O" ? "highpass" : "lowpass";
    filt.frequency.value = spec.freq;
    src.connect(filt).connect(gain);
    src.start(when);
    src.stop(when + spec.dur + 0.01);
  } else {
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq + (spec.pitchEnv ?? 0), when);
    osc.frequency.exponentialRampToValueAtTime(spec.freq, when + 0.06);
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + spec.dur + 0.02);
  }
}

export function createDrumSampler(): DrumSampler {
  const ctx = engine.ctx;
  if (!ctx) throw new Error("engine not ready");
  const output = ctx.createGain();
  output.gain.value = 1;
  const voices: DrumVoice[] = DEFAULT_DRUMS.map((d) => ({ name: d.name }));

  const trigger = (row: number, velocity: number, when: number) => {
    const ctx2 = engine.ctx;
    if (!ctx2) return;
    const spec = DEFAULT_DRUMS[row];
    if (!spec) return;
    const voice = voices[row];
    if (voice?.buffer) {
      const src = ctx2.createBufferSource();
      src.buffer = voice.buffer;
      const g = ctx2.createGain();
      g.gain.value = velocity;
      src.connect(g).connect(output);
      src.start(when);
      return;
    }
    makeSynthDrum(ctx2, output, spec, velocity, when);
  };

  const load = async () => {
    const ctx2 = engine.ctx;
    if (!ctx2) return;
    for (let i = 0; i < DEFAULT_DRUMS.length; i++) {
      const spec = DEFAULT_DRUMS[i];
      if (!spec) continue;
      const fname = spec.name.toLowerCase().replace("-", "_") + ".wav";
      const url = `/samples/${fname}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const buf = await ctx2.decodeAudioData(ab);
        const v = voices[i];
        if (v) v.buffer = buf;
      } catch {
        // fallback to synth — no-op
      }
    }
  };

  return { output, trigger, load, voices };
}
