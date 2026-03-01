type Props = {
  label: string;
  value: number | string;
  /** optional accent variant: 'red' for rejects */
  accent?: "red";
  sparkline?: number[];
  sparklineColor?: string;
};

function Sparkline({
  data,
  accent,
  color,
}: {
  data: number[];
  accent?: "red";
  color?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = 30 - ((v - min) / range) * 26 - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke =
    color ?? (accent === "red" ? "rgba(248, 113, 113, 0.9)" : "rgba(96, 165, 250, 0.9)");
  return (
    <svg
      className="kpi-sparkline"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      style={{ color: stroke }}
    >
      <polyline points={points} />
    </svg>
  );
}

export default function KpiCard({ label, value, accent, sparkline, sparklineColor }: Props) {
  const displayValue = value !== undefined && value !== null ? value : 0;
  const className = accent === "red" ? "kpi-card kpi-card--red" : "kpi-card";
  const sparklineData = sparkline && sparkline.length > 1 ? sparkline : [0, 0];
  return (
    <div className={className}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{displayValue}</div>
      <Sparkline data={sparklineData} accent={accent} color={sparklineColor} />
    </div>
  );
}
