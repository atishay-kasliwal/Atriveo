import type { ComponentType } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MAX_NETWORK_TODAY_BARS, NETWORK_CHART_THEME } from "../constants";
import { formatFirstNameLastInitial, rgbaFromHex, todayBarGradientId } from "../utils";
import NetworkInsightBarTooltip from "./NetworkInsightBarTooltip";

type BadgePreview = {
  id: string;
  name: string;
  description: string;
  tier: string;
  Icon: ComponentType;
};

type TodayRow = {
  key: string;
  label: string;
  color: string;
  isLeader: boolean;
  total: number;
};

type Props = {
  todayRows: TodayRow[];
  average: number;
  hasSingleLeader: boolean;
  hiddenCount: number;
  topEarnedBadges: BadgePreview[];
};

export default function NetworkPerformanceSnapshotCard({
  todayRows,
  average,
  hasSingleLeader,
  hiddenCount,
  topEarnedBadges,
}: Props) {
  return (
    <div className="network-trend-card network-insight-card network-weekly-card">
      <div className="chart-header network-insight-card-head network-rivalry-header">
        <div className="chart-title-group network-rivalry-head">
          <h2 className="network-insight-title">Performance Snapshot</h2>
        </div>
      </div>
      <div className="network-mini-chart network-split-chart">
        <div className="network-chart-stage">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={todayRows} margin={{ top: 14, right: 6, left: 0, bottom: 6 }} barCategoryGap="18%">
              <defs>
                {todayRows.map((row) => {
                  const gradId = todayBarGradientId(row.key);
                  return (
                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.98 : 0.9)} />
                      <stop offset="100%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.34 : 0.22)} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={NETWORK_CHART_THEME.grid} vertical={false} opacity={0.35} />
              <XAxis
                dataKey="label"
                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 12, fontWeight: 600 }}
                axisLine={{ stroke: NETWORK_CHART_THEME.grid }}
                tickLine={false}
                interval={0}
                height={28}
                tickMargin={8}
                minTickGap={18}
                padding={{ left: 4, right: 4 }}
                tickFormatter={(value) => formatFirstNameLastInitial(String(value ?? ""))}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: NETWORK_CHART_THEME.grid }}
                width={30}
                tickMargin={6}
                domain={[0, (dataMax: number) => Math.max(4, Math.ceil(Number(dataMax || 0) * 1.15))]}
              />
              {average > 0 && todayRows.length > 1 ? (
                <ReferenceLine
                  y={average}
                  stroke="var(--text-muted)"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  opacity={0.8}
                  ifOverflow="extendDomain"
                  label={(props: { viewBox?: { x?: number; y?: number; width?: number } }) => {
                    const x = Number(props.viewBox?.x ?? 0) + Number(props.viewBox?.width ?? 0) / 2;
                    const y = Number(props.viewBox?.y ?? 0) - 8;
                    return (
                      <text x={x} y={y} fill="var(--text-secondary)" fontSize={11} fontWeight={600} textAnchor="middle">
                        Avg {Math.round(average)}
                      </text>
                    );
                  }}
                />
              ) : null}
              <Tooltip content={<NetworkInsightBarTooltip metricLabel="Applications today" chartTheme={NETWORK_CHART_THEME} />} cursor={false} />
              <Bar
                dataKey="total"
                fillOpacity={1}
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
                isAnimationActive
                animationBegin={80}
                animationDuration={720}
                animationEasing="ease-out"
                activeBar={false}
              >
                <LabelList
                  dataKey="total"
                  position="insideTop"
                  offset={12}
                  content={(props: {
                    x?: number | string;
                    y?: number | string;
                    width?: number | string;
                    height?: number | string;
                    value?: number | string;
                    payload?: { isLeader?: boolean; color?: string; total?: number } | null;
                  }) => {
                    const x = Number(props.x ?? 0);
                    const y = Number(props.y ?? 0);
                    const width = Number(props.width ?? 0);
                    const height = Number(props.height ?? 0);
                    const value = Number(props.value ?? 0);
                    const isLeader = Boolean(props.payload?.isLeader);
                    const payloadColor = String(props.payload?.color ?? "#2563eb");
                    if (!(value > 0) || width <= 0) return null;
                    const centerX = x + width / 2;
                    const isShortBar = height < 30;
                    const labelY = isShortBar ? y - 10 : y + 16;
                    const textColor = isShortBar ? (isLeader ? payloadColor : rgbaFromHex(payloadColor, 0.9)) : "#ffffff";
                    return (
                      <g>
                        {hasSingleLeader && isLeader ? (
                          <text x={centerX} y={y - (isShortBar ? 26 : 14)} textAnchor="middle" fill={payloadColor} fontSize={16} filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.1))">
                            {"\u{1F451}"}
                          </text>
                        ) : null}
                        <text
                          x={centerX}
                          y={labelY}
                          textAnchor="middle"
                          fill={textColor}
                          fontSize={14}
                          fontWeight={700}
                          style={{ textShadow: !isShortBar ? "0px 1px 2px rgba(0,0,0,0.3)" : "none" }}
                        >
                          {String(value)}
                        </text>
                      </g>
                    );
                  }}
                />
                {todayRows.map((row) => (
                  <Cell
                    key={`today-${row.key}`}
                    fill={`url(#${todayBarGradientId(row.key)})`}
                    fillOpacity={1}
                    stroke={row.total > 0 ? (row.isLeader ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.12)"}
                    strokeWidth={row.isLeader ? 2 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {hiddenCount > 0 ? (
        <p className="network-weekly-hint" style={{ marginTop: 8 }}>
          Top {MAX_NETWORK_TODAY_BARS} shown. +{hiddenCount} more friend
          {hiddenCount === 1 ? "" : "s"} have activity today.
        </p>
      ) : null}
      <div className="network-badge-preview" aria-label="Achievements preview">
        <div className="network-badge-preview-head">
          <p className="network-badge-preview-title">Achievements</p>
        </div>
        {topEarnedBadges.length ? (
          <div className="network-badge-preview-row">
            {topEarnedBadges.map((badge) => {
              const Icon = badge.Icon;
              return (
                <div
                  key={badge.id}
                  className={`network-badge-preview-item network-medal tier-${badge.tier}`}
                  aria-label={`${badge.name}. ${badge.description}`}
                >
                  <span className="network-badge-preview-icon">
                    <Icon />
                  </span>
                  <span className="network-badge-preview-label">{badge.name}</span>
                  <span className="network-medal-tooltip" role="tooltip">
                    <strong>{badge.name}</strong>
                    <span>{badge.description}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="network-badge-preview-empty">Apply and compete this week to unlock your first badge.</p>
        )}
      </div>
    </div>
  );
}
