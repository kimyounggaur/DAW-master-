import { useState } from "react";
import { Play, Pause, Square, Circle, Repeat, Bell, BellOff, Share2, Download } from "lucide-react";
import { useProjectStore } from "@/state/projectStore";
import { useTransportStore } from "@/state/transportStore";
import { beatsToBarPos } from "@/model/time";
import { engine } from "@/audio/engine";
import s from "./TopBar.module.css";

export function TopBar() {
  const title = useProjectStore((st) => st.project.meta.title);
  const setTitle = useProjectStore((st) => st.setTitle);
  const bpm = useProjectStore((st) => st.project.meta.bpm);
  const setBpm = useProjectStore((st) => st.setBpm);
  const timeSig = useProjectStore((st) => st.project.meta.timeSig);
  const key = useProjectStore((st) => st.project.meta.key);

  const isPlaying = useTransportStore((st) => st.isPlaying);
  const isRecording = useTransportStore((st) => st.isRecording);
  const positionBeats = useTransportStore((st) => st.positionBeats);
  const loopOn = useTransportStore((st) => st.loop.enabled);
  const metroOn = useTransportStore((st) => st.metronomeOn);
  const play = useTransportStore((st) => st.play);
  const stop = useTransportStore((st) => st.stop);
  const toggleRecord = useTransportStore((st) => st.toggleRecord);
  const toggleLoop = useTransportStore((st) => st.toggleLoop);
  const toggleMetro = useTransportStore((st) => st.toggleMetronome);

  const pos = beatsToBarPos(positionBeats, timeSig);
  const [bpmDraft, setBpmDraft] = useState<string>(String(bpm));

  const onTogglePlay = async () => {
    await engine.init();
    if (isPlaying) stop();
    else play();
  };

  const onRecord = async () => {
    await engine.init();
    toggleRecord();
    if (!isPlaying) play();
  };

  return (
    <div className={s.bar}>
      <div className={s.left}>
        <span className={s.logo}>FlowDAW</span>
        <input
          className={s.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className={s.center}>
        <button
          className={s.btn}
          onClick={stop}
          title="정지 (Space로 재생/정지)"
          aria-label="정지"
        >
          <Square size={14} />
        </button>
        <button
          className={`${s.btn} ${isPlaying ? s.active : ""}`}
          onClick={onTogglePlay}
          title="재생/일시정지"
          aria-label="재생"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          className={`${s.btn} ${isRecording ? s.primary : ""}`}
          onClick={onRecord}
          title="녹음"
          aria-label="녹음"
        >
          <Circle size={14} fill={isRecording ? "currentColor" : "none"} />
        </button>
        <button
          className={`${s.btn} ${loopOn ? s.active : ""}`}
          onClick={toggleLoop}
          title="루프"
          aria-label="루프"
        >
          <Repeat size={14} />
        </button>
        <button
          className={`${s.btn} ${metroOn ? s.active : ""}`}
          onClick={toggleMetro}
          title="메트로놈"
          aria-label="메트로놈"
        >
          {metroOn ? <Bell size={14} /> : <BellOff size={14} />}
        </button>

        <div className={s.meta}>
          <span className={s.position}>
            {pos.bar}.{pos.beat}.{pos.sixteenth}
          </span>
          <div className={s.field}>
            <span>BPM</span>
            <input
              type="number"
              min={20}
              max={300}
              value={bpmDraft}
              onChange={(e) => setBpmDraft(e.target.value)}
              onBlur={() => {
                const n = Number(bpmDraft);
                if (Number.isFinite(n) && n > 0) setBpm(n);
                else setBpmDraft(String(bpm));
              }}
            />
          </div>
          <div className={s.field}>
            <span>
              {timeSig[0]}/{timeSig[1]}
            </span>
          </div>
          <div className={s.field}>
            <span>
              {key.tonic} {key.scale}
            </span>
          </div>
        </div>
      </div>

      <div className={s.right}>
        <span className={s.saveIndicator} id="save-indicator"></span>
        <button className={s.btn} title="공유" aria-label="공유">
          <Share2 size={14} />
        </button>
        <button className={s.btn} title="내보내기 (WAV)" aria-label="내보내기" id="export-btn">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}
