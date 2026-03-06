import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Line } from "recharts";

type Props = {
  label: string;
  value: number | string;
  /** optional accent variant: 'red' for rejects */
  accent?: "red";
  sparkline?: number[];
  sparklineColor?: string;
  changeContext?: string;
};

function Sparkline({
  data,
  accent,
  color,
  label,
}: {
  data: number[];
  accent?: "red";
  color?: string;
  label: string;
}) {
  if (!data.length) return null;

  const instanceId = useId().replace(/:/g, "");
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "kpi";
  const gradientId = `sparkGradient_${slug}_${instanceId}`;
  const fillColor = color ?? (accent === "red" ? "#EF4444" : "#2563EB");
  const lineColor = color ?? (accent === "red" ? "#EF4444" : "#2563EB");
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const hasVariation = range > 0;
  // Normalize values into a balanced sparkline band while reducing visual top padding.
  const chartData = data.map((value, idx) => ({
    idx,
    value: hasVariation ? 12 + ((value - min) / range) * 84 : 50,
  }));

  return (
    <div className="kpi-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.72} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            baseValue={0}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={4}
            strokeOpacity={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function KpiCard({ label, value, accent, sparkline, sparklineColor, changeContext }: Props) {
  const displayValue = value !== undefined && value !== null ? value : 0;
  const className = accent === "red" ? "kpi-card kpi-card--red" : "kpi-card";
  const sparklineData = sparkline && sparkline.length > 1 ? sparkline : [0, 0];
  const startValue = sparklineData[0] ?? 0;
  const endValue = sparklineData[sparklineData.length - 1] ?? 0;
  const delta = endValue - startValue;
  let trendClass = "kpi-change kpi-change--flat";
  let trendText = "0%";
  if (startValue !== 0) {
    const pct = Math.round((Math.abs(delta) / Math.abs(startValue)) * 100);
    if (delta > 0) {
      trendClass = "kpi-change kpi-change--up";
      trendText = `↑ ${pct}%`;
    } else if (delta < 0) {
      trendClass = "kpi-change kpi-change--down";
      trendText = `↓ ${pct}%`;
    }
  }
  const contextText = changeContext?.trim() || "vs start of shown trend";

  return (
    <div className={className}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value-row">
        <div className="kpi-value">{displayValue}</div>
        <span className={trendClass}>{trendText}</span>
      </div>
      <div className="kpi-change-context">{contextText}</div>
      <Sparkline data={sparklineData} accent={accent} color={sparklineColor} label={label} />
    </div>
  );
}
