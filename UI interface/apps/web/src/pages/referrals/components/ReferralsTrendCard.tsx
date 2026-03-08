import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Spinner from "../../../components/Spinner";
import { CHART_COLORS } from "../constants";
import type { ChartInsights } from "../types";

type Props = {
  isLoadingTrend: boolean;
  chartData: Array<Record<string, unknown>>;
  chartInsights: ChartInsights;
};

export default function ReferralsTrendCard({ isLoadingTrend, chartData, chartInsights }: Props) {
  return (
    <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
      <div className="trend-uniform-head">
        <h2>Referrals Momentum</h2>
        <p>Last 30 days • Requested vs Referral received</p>
      </div>
      <div className="trend-uniform-body">
        {isLoadingTrend ? (
          <div className="trend-uniform-loading">
            <Spinner />
          </div>
        ) : !chartData.length ? (
          <div className="chart-empty">No referral activity in the last 30 days.</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 24 }}>
              <defs>
                <linearGradient id="areaGradient_referralsMomentum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.requestedLine} stopOpacity={0.58} />
                  <stop offset="55%" stopColor={CHART_COLORS.requestedLine} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={CHART_COLORS.requestedLine} stopOpacity={0} />
                </linearGradient>
                <filter id="lineGlow_referralsMomentum" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor={CHART_COLORS.requestedLine} floodOpacity={0.42} />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal vertical={false} />
              <XAxis
                dataKey="dayLabel"
                stroke={CHART_COLORS.axis}
                tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                tickLine={false}
                height={32}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke={CHART_COLORS.axis}
                tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                tickLine={false}
                allowDecimals={false}
                width={40}
                label={{ value: "Count", angle: -90, position: "insideLeft", fill: CHART_COLORS.textSecondary, fontSize: 11, style: { textAnchor: "middle" } }}
              />
              <Tooltip
                contentStyle={{ background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, borderRadius: 6, padding: "10px 14px" }}
                cursor={false}
                formatter={(value: number, name: string) => {
                  if (name === "referralReceived") return [`${value}`, "Referral received"];
                  if (name === "requested") return [`${value}`, "Requested"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
                labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                itemStyle={{ fontSize: 13, fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="requested" stroke="none" fill={CHART_COLORS.requestedLine} fillOpacity={0.12} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
              <Area type="monotone" dataKey="requested" stroke="none" fill="url(#areaGradient_referralsMomentum)" fillOpacity={1} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
              <Bar
                dataKey="referralReceived"
                fill={CHART_COLORS.receivedBar}
                radius={[4, 4, 0, 0]}
                minPointSize={2}
                label={{ position: "top", fill: CHART_COLORS.textSecondary, fontSize: 9, fontWeight: 400, formatter: (value: number) => (value > 0 ? String(value) : "") }}
              />
              <Line
                type="monotone"
                dataKey="requested"
                stroke={CHART_COLORS.requestedLine}
                strokeWidth={2.6}
                dot={{ r: 3, fill: CHART_COLORS.requestedLine, stroke: "var(--bg-card)", strokeWidth: 1.2, opacity: 1 }}
                activeDot={false}
                connectNulls={false}
                filter="url(#lineGlow_referralsMomentum)"
              >
                <LabelList dataKey="requested" position="top" offset={8} fill={CHART_COLORS.requestedLine} fontSize={10} fontWeight={700} formatter={(value: number) => (value > 0 ? String(value) : "")} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="trend-uniform-foot">
        <span className="trend-uniform-foot-item trend-uniform-foot-item--applied">
          {chartInsights.peakRequested
            ? `Peak: ${chartInsights.peakRequested.value} requests on ${chartInsights.peakRequested.day}`
            : "Peak: -"}
        </span>
        <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
          • {chartInsights.receivedDays} day{chartInsights.receivedDays !== 1 ? "s" : ""} with referral received
        </span>
      </div>
    </div>
  );
}
