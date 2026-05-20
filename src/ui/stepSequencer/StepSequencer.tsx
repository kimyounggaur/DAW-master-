interface Props {
  clipId: string;
}

export function StepSequencer({ clipId }: Props) {
  return (
    <div style={{ padding: 16, color: "var(--fg-2)" }}>
      Step Sequencer (S9에서 구현) — clip: {clipId}
    </div>
  );
}
