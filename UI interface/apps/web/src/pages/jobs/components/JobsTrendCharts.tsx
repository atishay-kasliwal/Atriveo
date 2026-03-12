import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
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

type ChartPoint = {
  dayLabel: string;
  applied: number;
  rejected: number;
};

type Props = {
  statusFilter?: string;
  isLoadingTrend: boolean;
  chartData: {
    data: ChartPoint[];
    insights: {
      maxApplied: { day: string; value: number; index: number } | null;
      maxRejected: { day: string; value: number; index: number } | null;
      rejectionDays: Array<{ day: string; value: number; index: number }>;
    };
  };
};

export default function JobsTrendCharts({ statusFilter, isLoadingTrend, chartData }: Props) {
  return (
    <>
      {/* Application Momentum Chart - temporarily disabled */}
      {false && statusFilter !== "rejected" && (
        <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
          <div className="trend-uniform-head">
            <h2>Application Momentum</h2>
            <p>Last 30 days • Applications with rejection context</p>
          </div>
          <div className="trend-uniform-body">
            {isLoadingTrend ? (
              <div className="trend-uniform-loading">
                <Spinner />
              </div>
            ) : !chartData.data || chartData.data.length === 0 ? (
              <div className="chart-empty">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  data={chartData.data}
                  margin={{ top: 20, right: 24, left: 8, bottom: 24 }}
                  barCategoryGap="14%"
                >
                  <defs>
                    <linearGradient id="areaGradient_applicationMomentum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.applied} stopOpacity={0.58} />
                      <stop offset="55%" stopColor={CHART_COLORS.applied} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={CHART_COLORS.applied} stopOpacity={0} />
                    </linearGradient>
                    <filter id="lineGlow_applicationMomentum" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor={CHART_COLORS.applied} floodOpacity={0.42} />
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={true}
                    vertical={false}
                  />
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
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                    }}
                    cursor={false}
                    formatter={(value: number, name: string) => {
                      if (name === "applied") return [`${value}`, "Applied"];
                      if (name === "rejected") return [`${value}`, "Rejected"];
                      return [value, name];
                    }}
                    labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                    itemStyle={{ fontSize: 13, fontWeight: 600 }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area type="monotone" dataKey="applied" stroke="none" fill={CHART_COLORS.applied} fillOpacity={0.12} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
                  <Area type="monotone" dataKey="applied" stroke="none" fill="url(#areaGradient_applicationMomentum)" fillOpacity={1} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
                  <Bar
                    dataKey="rejected"
                    fill={CHART_COLORS.rejected}
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                    label={{ position: "top", fill: CHART_COLORS.textSecondary, fontSize: 9, fontWeight: 400, formatter: (value: number) => (value > 0 ? String(value) : "") }}
                  >
                    {chartData.data.map((entry, index) => {
                      const hasRejection = entry.rejected > 0;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS.rejected}
                          style={hasRejection ? { opacity: 1 } : { opacity: 0.3 }}
                        />
                      );
                    })}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="applied"
                    stroke={CHART_COLORS.applied}
                    strokeWidth={2.6}
                    dot={{
                      r: 3,
                      fill: CHART_COLORS.applied,
                      stroke: "var(--bg-card)",
                      strokeWidth: 1.2,
                      opacity: 1,
                    }}
                    activeDot={false}
                    connectNulls={false}
                    strokeDasharray="0"
                    filter="url(#lineGlow_applicationMomentum)"
                  >
                    <LabelList dataKey="applied" position="top" offset={8} fill={CHART_COLORS.applied} fontSize={10} fontWeight={700} formatter={(value: number) => (value > 0 ? String(value) : "")} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="trend-uniform-foot">
            <span className="trend-uniform-foot-item trend-uniform-foot-item--applied">
              {chartData.insights.maxApplied
                ? `Peak: ${chartData.insights.maxApplied.value} applications on ${chartData.insights.maxApplied.day}`
                : "Peak: -"}
            </span>
            <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
              • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {statusFilter === "rejected" && (
        <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
          <div className="trend-uniform-head">
            <h2>Archive Trend</h2>
            <p>Last 30 days • Daily rejected applications</p>
          </div>
          <div className="trend-uniform-body">
            {isLoadingTrend ? (
              <div className="trend-uniform-loading">
                <Spinner />
              </div>
            ) : !chartData.data || chartData.data.length === 0 ? (
              <div className="chart-empty">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  data={chartData.data}
                  margin={{ top: 20, right: 24, left: 8, bottom: 24 }}
                  barCategoryGap="14%"
                >
                  <defs>
                    <linearGradient id="areaGradient_rejectedJobsTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.rejected} stopOpacity={0.56} />
                      <stop offset="55%" stopColor={CHART_COLORS.rejected} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS.rejected} stopOpacity={0} />
                    </linearGradient>
                    <filter id="lineGlow_rejectedJobsTrend" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor={CHART_COLORS.rejected} floodOpacity={0.4} />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={true} vertical={false} />
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
                    label={{ value: "Rejected", angle: -90, position: "insideLeft", fill: CHART_COLORS.textSecondary, fontSize: 11, style: { textAnchor: "middle" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                    }}
                    cursor={false}
                    labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                    itemStyle={{ fontSize: 13, fontWeight: 600, color: CHART_COLORS.rejected }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [`${value}`, "Rejected"]}
                  />
                  <Area type="monotone" dataKey="rejected" stroke="none" fill={CHART_COLORS.rejected} fillOpacity={0.1} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
                  <Area type="monotone" dataKey="rejected" stroke="none" fill="url(#areaGradient_rejectedJobsTrend)" fillOpacity={1} baseValue={0} tooltipType="none" isAnimationActive={false} connectNulls={false} />
                  <Bar
                    dataKey="rejected"
                    fill={CHART_COLORS.rejected}
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                  >
                    {chartData.data.map((entry, index) => {
                      const hasRejection = entry.rejected > 0;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS.rejected}
                          style={hasRejection ? { opacity: 1 } : { opacity: 0.3 }}
                        />
                      );
                    })}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke={CHART_COLORS.rejected}
                    strokeWidth={2.6}
                    dot={{
                      r: 3,
                      fill: CHART_COLORS.rejected,
                      stroke: "var(--bg-card)",
                      strokeWidth: 1.2,
                      opacity: 1,
                    }}
                    activeDot={false}
                    connectNulls={false}
                    strokeDasharray="0"
                    filter="url(#lineGlow_rejectedJobsTrend)"
                    tooltipType="none"
                  >
                    <LabelList dataKey="rejected" position="top" offset={8} fill={CHART_COLORS.rejected} fontSize={10} fontWeight={700} formatter={(value: number) => (value > 0 ? String(value) : "")} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="trend-uniform-foot">
            <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
              {chartData.insights.maxRejected
                ? `Peak: ${chartData.insights.maxRejected.value} rejections on ${chartData.insights.maxRejected.day}`
                : "Peak: -"}
            </span>
            <span className="trend-uniform-foot-item trend-uniform-foot-item--muted">
              • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
