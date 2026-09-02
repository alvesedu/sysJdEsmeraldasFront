type StatusBadgeProps = {
  value: string;
  label: string;
};

export function StatusBadge({ value, label }: StatusBadgeProps) {
  return <span className={`status status-${value.toLowerCase()}`}>{label}</span>;
}
