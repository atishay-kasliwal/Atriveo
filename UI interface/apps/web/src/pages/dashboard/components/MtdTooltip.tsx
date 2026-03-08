type Props = {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string | number;
  chartColors: {
    tooltipBg: string;
    tooltipBorder: string;
    text: string;
    trendLine: string;
    accentSoft: string;
  };
};

export default function MtdTooltip({ active, payload, label, chartColors }: Props) {
  if (!active || !payload?.length) return null;
  const byKey = new Map<string, number>();
  payload.forEach((p) => {
    const key = String(p.dataKey ?? "");
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, Number(p.value ?? 0));
  });
  const thisMonth = byKey.get("thisMonth") ?? 0;
  const lastMonth = byKey.get("lastMonth") ?? 0;
  return (
    <div
      style={{
        background: chartColors.tooltipBg,
        border: `1px solid ${chartColors.tooltipBorder}`,
        borderRadius: 6,
        padding: "10px 14px",
      }}
    >
      <p style={{ margin: "0 0 6px 0", fontSize: 11, color: chartColors.text }}>
        Day {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: chartColors.trendLine }}>
        This month: {thisMonth}
      </p>
      <p style={{ margin: "4px 0 0 0", fontSize: 13, fontWeight: 600, color: chartColors.accentSoft }}>
        Last month: {lastMonth}
      </p>
    </div>
  );
}
