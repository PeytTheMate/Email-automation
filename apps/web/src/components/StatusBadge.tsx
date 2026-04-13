type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {label.replaceAll("_", " ")}
    </span>
  );
}
