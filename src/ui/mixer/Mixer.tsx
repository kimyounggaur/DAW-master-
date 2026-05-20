import { useProjectStore } from "@/state/projectStore";
import { ChannelStrip } from "./ChannelStrip";
import s from "./Mixer.module.css";

export function Mixer() {
  const tracks = useProjectStore((st) => st.project.tracks);
  const master = tracks.find((t) => t.type === "master");
  const nonMaster = tracks.filter((t) => t.type !== "master");

  return (
    <div className={s.root}>
      {nonMaster.map((t) => (
        <ChannelStrip key={t.id} track={t} />
      ))}
      {master && (
        <>
          <div style={{ width: 8, borderLeft: "1px solid var(--border)" }} />
          <ChannelStrip key={master.id} track={master} />
        </>
      )}
    </div>
  );
}
