import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { CanvasTheme } from "./weeklyCompetitionUtils";

type CompetitionTooltipProps = TooltipProps<ValueType, NameType> & {
  friendName: string;
  theme: CanvasTheme;
};

export default function CompetitionTooltip({ active, payload, label, friendName, theme }: CompetitionTooltipProps) {
  if (!active || !payload?.length) return null;

  const youPoint = payload.find((entry) => String(entry.dataKey) === "you");
  const friendPoint = payload.find((entry) => String(entry.dataKey) === "friend");
  if (!youPoint && !friendPoint) return null;

  const youValue = Number(youPoint?.value ?? 0);
  const friendValue = Number(friendPoint?.value ?? 0);

  return (
    <div
      style={{
        background: theme.tooltipBg,
        color: theme.textPrimary,
        border: `1px solid ${theme.tooltipBorder}`,
        borderRadius: 12,
        padding: "10px 13px",
        boxShadow: theme.tooltipShadow,
        fontFamily: theme.fontFamily,
        minWidth: 170,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: theme.textPrimary }}>{String(label ?? "")}</p>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>You: {youValue} applications</p>
      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
        {friendName}: {friendValue} applications
      </p>
      <p style={{ margin: "7px 0 0", fontSize: 11, fontWeight: 600, color: theme.textMuted }}>
        {youValue === friendValue ? "Even today" : youValue > friendValue ? `You lead by +${youValue - friendValue}` : `${friendName} leads by +${friendValue - youValue}`}
      </p>
    </div>
  );
}
