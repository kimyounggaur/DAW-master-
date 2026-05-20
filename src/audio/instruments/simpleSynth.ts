import { engine } from "../engine";

export interface SimpleSynth {
  output: GainNode;
  noteOn: (pitch: number, velocity: number, when: number) => void;
  noteOff: (pitch: number, when: number) => void;
  setParam: (name: string, val: number) => void;
  dispose: () => void;
}

const MAX_VOICES = 16;

interface Voice {
  pitch: number;
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  amp: GainNode;
  startedAt: number;
  releaseAt: number | null;
}

const DEFAULT_PARAMS = {
  waveform: 0, // 0:saw 1:square 2:triangle 3:sine
  attack: 0.01,
  decay: 0.2,
  sustain: 0.6,
  release: 0.3,
  cutoff: 4000,
  resonance: 0.5,
  detune: 0,
};

const WAVEFORMS: OscillatorType[] = ["sawtooth", "square", "triangle", "sine"];

function pitchToFreq(pitch: number, detune: number): number {
  return 440 * Math.pow(2, (pitch + detune / 100 - 69) / 12);
}

export function createSimpleSynth(): SimpleSynth {
  const ctx = engine.ctx;
  if (!ctx) throw new Error("engine not ready");
  const output = ctx.createGain();
  output.gain.value = 0.3;

  const params: Record<string, number> = { ...DEFAULT_PARAMS };
  const voices: Voice[] = [];

  function makeVoice(pitch: number, vel: number, when: number): Voice {
    const ctx2 = engine.ctx!;
    const osc = ctx2.createOscillator();
    const filter = ctx2.createBiquadFilter();
    const amp = ctx2.createGain();
    const wfIdx = Math.max(0, Math.min(3, Math.floor(params.waveform ?? 0)));
    osc.type = WAVEFORMS[wfIdx] ?? "sawtooth";
    osc.frequency.value = pitchToFreq(pitch, params.detune ?? 0);
    filter.type = "lowpass";
    filter.frequency.value = params.cutoff ?? 4000;
    filter.Q.value = params.resonance ?? 0.5;
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(vel, when + (params.attack ?? 0.01));
    amp.gain.linearRampToValueAtTime(vel * (params.sustain ?? 0.6), when + (params.attack ?? 0.01) + (params.decay ?? 0.2));
    osc.connect(filter).connect(amp).connect(output);
    osc.start(when);
    return { pitch, osc, filter, amp, startedAt: when, releaseAt: null };
  }

  function killOldest() {
    if (voices.length === 0) return;
    voices.sort((a, b) => a.startedAt - b.startedAt);
    const v = voices.shift();
    if (v) {
      try { v.osc.stop(); } catch { /* noop */ }
      v.osc.disconnect();
      v.filter.disconnect();
      v.amp.disconnect();
    }
  }

  const noteOn: SimpleSynth["noteOn"] = (pitch, velocity, when) => {
    if (voices.length >= MAX_VOICES) killOldest();
    const v = makeVoice(pitch, Math.max(0.05, velocity), when);
    voices.push(v);
  };

  const noteOff: SimpleSynth["noteOff"] = (pitch, when) => {
    const ctx2 = engine.ctx!;
    for (const v of voices) {
      if (v.pitch === pitch && v.releaseAt === null) {
        v.releaseAt = when;
        const rel = params.release ?? 0.3;
        v.amp.gain.cancelScheduledValues(when);
        const currentGain = v.amp.gain.value;
        v.amp.gain.setValueAtTime(currentGain, when);
        v.amp.gain.linearRampToValueAtTime(0, when + rel);
        try { v.osc.stop(when + rel + 0.02); } catch { /* noop */ }
        const total = when + rel + 0.05;
        const delay = Math.max(0, (total - ctx2.currentTime) * 1000);
        setTimeout(() => {
          const idx = voices.indexOf(v);
          if (idx >= 0) voices.splice(idx, 1);
          v.osc.disconnect();
          v.filter.disconnect();
          v.amp.disconnect();
        }, delay);
      }
    }
  };

  const setParam: SimpleSynth["setParam"] = (name, val) => {
    params[name] = val;
  };

  const dispose = () => {
    for (const v of voices) {
      try { v.osc.stop(); } catch { /* noop */ }
      v.osc.disconnect();
      v.filter.disconnect();
      v.amp.disconnect();
    }
    voices.length = 0;
    output.disconnect();
  };

  return { output, noteOn, noteOff, setParam, dispose };
}

export { DEFAULT_PARAMS as DEFAULT_SYNTH_PARAMS };
