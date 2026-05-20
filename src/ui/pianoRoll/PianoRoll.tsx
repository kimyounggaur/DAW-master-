interface Props {
  clipId: string;
}

export function PianoRoll({ clipId }: Props) {
  return (
    <div style={{ padding: 16, color: "var(--fg-2)" }}>
      Piano Roll (S13에서 구현) — clip: {clipId}
    </div>
  );
}
