import { useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { useUiStore } from "@/state/uiStore";
import { bounceProject } from "@/audio/render/offlineBounce";
import { encodeWav } from "@/audio/render/wavEncoder";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const project = useProjectStore((st) => st.project);
  const showToast = useUiStore((st) => st.showToast);
  const [filename, setFilename] = useState(project.meta.title || "flowdaw-export");
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!open) return null;

  const onStart = async () => {
    setProgress(0);
    try {
      const buffer = await bounceProject(project, {
        sampleRate,
        numChannels: 2,
        onProgress: (f) => setProgress(f),
      });
      const blob = encodeWav(buffer);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      // auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.wav`;
      a.click();
      showToast("WAV 익스포트 완료", "success");
    } catch (e) {
      console.warn("export failed", e);
      showToast("익스포트 실패", "error");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: 24,
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>WAV로 내보내기</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--fg-2)" }}>파일명</label>
          <input value={filename} onChange={(e) => setFilename(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--fg-2)" }}>샘플 레이트</label>
          <select
            value={sampleRate}
            onChange={(e) => setSampleRate(Number(e.target.value) as 44100 | 48000)}
          >
            <option value={48000}>48000 Hz</option>
            <option value={44100}>44100 Hz</option>
          </select>
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-2)" }}>
          길이: {project.arrangement.lengthBars} 마디 · BPM {project.meta.bpm}
        </div>
        {progress !== null && (
          <div style={{ height: 8, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", background: "var(--accent)" }} />
          </div>
        )}
        {downloadUrl && (
          <audio src={downloadUrl} controls style={{ width: "100%" }} />
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}>닫기</button>
          <button
            style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}
            onClick={onStart}
            disabled={progress !== null}
          >
            {progress !== null ? `${Math.round(progress * 100)}%` : "내보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
