import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "../constants";
import { formatDay } from "../utils";

type TrendRow = {
  day?: string;
  label?: string;
  total?: number;
  avg7?: number;
  rejected?: number;
  referrals?: number;
  pending?: number;
  weekIndex: number;
};

// Custom bar component with subtle referral/rejected indicators
function PremiumApplicationBar(props: any) {
  const { x, y, width, height, payload, radius } = props;
  
  if (!payload || height === 0 || width === 0) return null;

  const total = payload.total ?? 0;
  const referrals = payload.referrals ?? 0;
  const rejected = payload.rejected ?? 0;

  const barY = y + height; // bottom of bar
  const barWidth = width;
  const dotSize = 3;

  // Calculate number of indicator dots
  const referralDots = Math.min(Math.ceil(referrals / Math.max(total / 5, 1)), 5);
  const rejectedDots = Math.min(Math.ceil(rejected / Math.max(total / 5, 1)), 3);

  return (
    <g>
      {/* Main blue bar with gradient */}
      <defs>
        <linearGradient id={`premiumAppBar-${payload.day}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
        </linearGradient>
        <filter id={`barGlow-${payload.day}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3B82F6" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Main application bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius?.[0] ?? 7}
        ry={radius?.[1] ?? 7}
        fill={`url(#premiumAppBar-${payload.day})`}
        filter={`url(#barGlow-${payload.day})`}
        style={{ transition: "opacity 0.2s ease" }}
      />

      {/* Referral dots at the base (green) */}
      {referralDots > 0 && (
        <g opacity={0.6}>
          {Array.from({ length: referralDots }).map((_, i) => {
            const spacing = (barWidth - dotSize * referralDots) / (referralDots + 1);
            const dotX = x + spacing + i * (dotSize + spacing);
            return (
              <circle
                key={`referral-dot-${i}`}
                cx={dotX + dotSize / 2}
                cy={barY - 6}
                r={dotSize / 2}
                fill="#22C55E"
                opacity={0.65}
              />
            );
          })}
        </g>
      )}

      {/* Rejected dots below referral dots (red) */}
      {rejectedDots > 0 && (
        <g opacity={0.5}>
          {Array.from({ length: rejectedDots }).map((_, i) => {
            const spacing = (barWidth - dotSize * rejectedDots) / (rejectedDots + 1);
            const dotX = x + spacing + i * (dotSize + spacing);
            return (
              <circle
                key={`rejected-dot-${i}`}
                cx={dotX + dotSize / 2}
                cy={barY - 2}
                r={dotSize / 2}
                fill="#EF4444"
                opacity={0.55}
              />
            );
          })}
        </g>
      )}
    </g>
  );
}

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
            <label className="chart-filter-label" htmlFor="trend-days">
              Show last
            </label>
            <select
              id="trend-days"
              className="chart-filter-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[60, 30, 15, 10, 7].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 300 : 520}>
          <ComposedChart data={trendData} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 6" stroke={CHART_COLORS.grid} vertical={false} opacity={0.5} />
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
                
                const applications = data.total ?? 0;
                const referrals = data.referrals ?? 0;
                const rejected = data.rejected ?? 0;
                const pending = data.pending ?? 0;
                const referralRate = applications > 0 ? ((referrals / applications) * 100).toFixed(0) : 0;

                return (
                  <div
                    style={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 8,
                      padding: "12px 16px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <p style={{ margin: "0 0 8px 0", fontWeight: 500, fontSize: 11, color: CHART_COLORS.text }}>{title}</p>
                    <p style={{ margin: "0 0 6px 0", fontSize: 13, fontWeight: 600, color: "#3B82F6" }}>
                      Applications: {applications}
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: 12, color: CHART_COLORS.text }}>
                      Referrals: <span style={{ color: "#22C55E", fontWeight: 500 }}>{referrals}</span> ({referralRate}%)
                    </p>
                    <p style={{ margin: "0 0 4px 0", fontSize: 12, color: CHART_COLORS.text }}>
                      Rejected: <span style={{ color: "#EF4444", fontWeight: 500 }}>{rejected}</span>
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: CHART_COLORS.text }}>
                      Pending: <span style={{ fontWeight: 500 }}>{pending}</span>
                    </p>
                  </div>
                );
              }}
              cursor={false}
            />
            {showTodayLine ? (
              <ReferenceLine x={todayLabel} stroke={CHART_COLORS.textSecondary} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "Today", fill: CHART_COLORS.textSecondary, fontSize: 10 }} />
            ) : null}
            <Area type="monotone" dataKey="total" stroke="none" fill="url(#trendAreaGradient)" />
            <Bar
              dataKey="total"
              fill="#3B82F6"
              radius={[7, 7, 0, 0]}
              activeBar={false}
              isAnimationActive={true}
              animationDuration={300}
              label={
                isMobile
                  ? false
                  : { position: "top", fill: CHART_COLORS.textSecondary, fontSize: 11, fontWeight: 500, dy: -8 }
              }
              shape={<PremiumApplicationBar />}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#3B82F6", opacity: 1 }}
              activeDot={false}
              isAnimationActive={true}
              animationDuration={300}
              yAxisId="left"
            />
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
