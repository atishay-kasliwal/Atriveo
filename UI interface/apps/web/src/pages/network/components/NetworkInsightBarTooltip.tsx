type Props = {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: { label?: string; color?: string };
  }>;
  metricLabel: string;
  chartTheme: {
    tooltipBg: string;
    tooltipBorder: string;
    tooltipShadow: string;
  };
};

export default function NetworkInsightBarTooltip({ active, payload, metricLabel, chartTheme }: Props) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const name = String(row?.payload?.label ?? "");
  const value = Number(row?.value ?? 0);
  const color = String(row?.payload?.color ?? "var(--chart-text-secondary)");

  return (
    <div
      style={{
        background: chartTheme.tooltipBg,
        border: `1px solid ${chartTheme.tooltipBorder}`,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 180,
        boxShadow: chartTheme.tooltipShadow,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, color, fontWeight: 700 }}>{name}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--chart-text-secondary)" }}>
        {metricLabel}: <strong>{value}</strong>
      </p>
    </div>
  );
}
