import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, WEEK_COLORS } from "../constants";
import { formatDay } from "../utils";

type TrendLineKey = "applications" | "referral" | "rejected" | "all";

type TrendRow = {
  day?: string;
  label?: string;
  total?: number;
  avg7?: number;
  referral?: number;
  rejected?: number;
  weekIndex: number;
};

type WeeklyInsights = {
  diff: number;
  status: "ahead" | "behind" | "equal";
  peakLabel: string;
  peakValue: number;
  behindPeak: number;
};

type DailyMotivation = {
  quote: string;
  author: string;
};

type TargetHeaderMetrics = {
  dailyHits: number;
  daysInMonth: number;
  monthlyBehind: number;
};

type Props = {
  trendData: TrendRow[];
  weeklyInsights: WeeklyInsights | null;
  targetHeaderMetrics: TargetHeaderMetrics;
  days: number;
  setDays: (value: number) => void;
  dailyTrendTicks: string[];
  todayLabel: string;
  showTodayLine: boolean;
  dailyMotivation: DailyMotivation | null;
  isMobile?: boolean;
};

export default function ApplicationsTrendCard({
  trendData,
  weeklyInsights,
  targetHeaderMetrics,
  days,
  setDays,
  dailyTrendTicks,
  todayLabel,
  showTodayLine,
  dailyMotivation,
  isMobile = false,
}: Props) {
  const [trendLine, setTrendLine] = useState<TrendLineKey>("applications");

  function renderLabeledDot(color: string, valueKey: keyof TrendRow) {
    return (props: Record<string, unknown>) => {
      const cx = props.cx as number;
      const cy = props.cy as number;
      const payload = props.payload as TrendRow;
      const value = payload?.[valueKey] as number | undefined;
      return (
        <g key={`dot-${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={4} fill={color} opacity={1} />
          {value != null && (
            <text
              x={cx}
              y={cy - 7}
              textAnchor="middle"
              fontSize={11}
              fill={CHART_COLORS.textSecondary}
              fontWeight={400}
            >
              {value}
            </text>
          )}
        </g>
      );
    };
  }

  return (
    <section className="chart-grid chart-grid-trend">
      <div className="card card-chart-trend" style={{ paddingBottom: 24 }}>
        <div className="chart-header">
          <div className="chart-title-group">
            <h2>Applications Trend</h2>
            <p className="chart-subtitle">Daily applications</p>
          </div>
          <div className="chart-filter">
            {weeklyInsights ? (
              <span
                className={`delta-pill ${
                  weeklyInsights.diff < 0 ? "delta-pill--down" : weeklyInsights.diff > 0 ? "delta-pill--up" : "delta-pill--neutral"
                }`}
              >
                {weeklyInsights.diff === 0
                  ? "Same as last week"
                  : `${weeklyInsights.diff > 0 ? "+" : "−"}${Math.abs(weeklyInsights.diff)} vs last week`}
              </span>
            ) : null}
            <span className="delta-pill delta-pill--target">
              Daily target hit <strong>{targetHeaderMetrics.dailyHits}/{targetHeaderMetrics.daysInMonth}</strong>
              <span className="delta-pill-sep">•</span>
              Behind <strong>{targetHeaderMetrics.monthlyBehind}</strong>
            </span>
            <select
              id="trend-line"
              className="chart-filter-select"
              value={trendLine}
              onChange={(e) => setTrendLine(e.target.value as TrendLineKey)}
            >
              <option value="applications">Application Trendline</option>
              <option value="referral">Referral Trendline</option>
              <option value="rejected">Rejected Trendline</option>
              <option value="all">All Trendlines</option>
            </select>
            <select
              id="trend-days"
              className="chart-filter-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[60, 30, 15, 10, 7].map((d) => (
                <option key={d} value={d}>
                  {d}d
                </option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 300 : 520}>
          <ComposedChart data={trendData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
              axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
              tickLine={false}
              ticks={dailyTrendTicks.length > 0 ? dailyTrendTicks : undefined}
              interval={isMobile ? "preserveStartEnd" : 0}
              height={24}
            />
            <YAxis
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const data = props.payload[0].payload as TrendRow;
                const dateStr = data.day ? formatDay(data.day) : props.label || "";
                const title = data.label === todayLabel ? `Today — ${dateStr}` : dateStr;
                return (
                  <div
                    style={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                    }}
                  >
                    <p style={{ margin: "0 0 6px 0", fontWeight: 500, fontSize: 11, color: CHART_COLORS.text }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CHART_COLORS.trendLine }}>
                      Applications: {data.total}
                    </p>
                    {(trendLine === "referral" || trendLine === "all") ? (
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, fontWeight: 600, color: CHART_COLORS.weeklyBar }}>
                        Referrals: {data.referral ?? 0}
                      </p>
                    ) : null}
                    {(trendLine === "rejected" || trendLine === "all") ? (
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, fontWeight: 600, color: CHART_COLORS.responseBar }}>
                        Rejected: {data.rejected ?? 0}
                      </p>
                    ) : null}
                  </div>
                );
              }}
              cursor={false}
            />
            {showTodayLine ? (
              <ReferenceLine x={todayLabel} stroke={CHART_COLORS.textSecondary} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "Today", fill: CHART_COLORS.textSecondary, fontSize: 10 }} />
            ) : null}
            <Bar
              dataKey="total"
              fillOpacity={0.85}
              radius={[5, 5, 0, 0]}
              activeBar={false}
              label={
                isMobile
                  ? false
                  : { position: "top", fill: CHART_COLORS.textSecondary, fontSize: 11, fontWeight: 400, dy: -4 }
              }
            >
              {trendData.map((row, i) => (
                <Cell key={row.day ?? i} fill={WEEK_COLORS[row.weekIndex % WEEK_COLORS.length]} />
              ))}
            </Bar>
            {(trendLine === "applications" || trendLine === "all") ? (
              <>
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={CHART_COLORS.trendLine}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.trendLine, opacity: 0.9 }}
                  activeDot={false}
                />
                {trendLine === "applications" ? (
                  <Line
                    type="monotone"
                    dataKey="avg7"
                    stroke={CHART_COLORS.movingAverage}
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                ) : null}
              </>
            ) : null}
            {(trendLine === "referral" || trendLine === "all") ? (
              <Line
                type="monotone"
                dataKey="referral"
                stroke={CHART_COLORS.weeklyBar}
                strokeWidth={2}
                strokeDasharray={trendLine === "all" ? "5 4" : undefined}
                dot={renderLabeledDot(CHART_COLORS.weeklyBar, "referral")}
                activeDot={false}
              />
            ) : null}
            {(trendLine === "rejected" || trendLine === "all") ? (
              <Line
                type="monotone"
                dataKey="rejected"
                stroke={CHART_COLORS.responseBar}
                strokeWidth={2}
                strokeDasharray={trendLine === "all" ? "5 4" : undefined}
                dot={renderLabeledDot(CHART_COLORS.responseBar, "rejected")}
                activeDot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
        {weeklyInsights && (
          <div
            style={{
              marginTop: 0,
              paddingTop: 8,
              paddingBottom: 0,
              borderTop: `1px solid ${CHART_COLORS.grid}`,
              fontSize: isMobile ? "0.8rem" : "0.85rem",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              gap: isMobile ? 8 : 14,
              width: "100%",
            }}
          >
            {dailyMotivation ? (
              <span
                style={{
                  color: CHART_COLORS.textSecondary,
                  flex: isMobile ? "1 1 auto" : "0 1 auto",
                  maxWidth: isMobile ? "100%" : "48%",
                  minWidth: 0,
                  whiteSpace: "normal",
                  lineHeight: isMobile ? 1.4 : 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: isMobile ? 2 : "unset",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {dailyMotivation.quote} — {dailyMotivation.author}
              </span>
            ) : null}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                marginLeft: isMobile ? 0 : "auto",
                justifyContent: isMobile ? "flex-start" : "flex-end",
                gap: isMobile ? 6 : 10,
                textAlign: isMobile ? "left" : "right",
                whiteSpace: isMobile ? "normal" : "nowrap",
              }}
            >
              <span style={{ color: CHART_COLORS.trendLine }}>
                {weeklyInsights.status === "equal"
                  ? "Same pace as last week"
                  : `You are ${Math.abs(weeklyInsights.diff)} applications ${weeklyInsights.status} vs last week`}
              </span>
              {weeklyInsights.peakLabel ? (
                <span style={{ color: CHART_COLORS.accentSoft }}>
                  • Peak day: {weeklyInsights.peakValue} on {weeklyInsights.peakLabel}
                </span>
              ) : null}
              <span style={{ color: CHART_COLORS.textSecondary }}>
                • You are {weeklyInsights.behindPeak} behind your peak
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
