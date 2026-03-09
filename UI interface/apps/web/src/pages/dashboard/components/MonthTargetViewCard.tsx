import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "../constants";
import MtdTooltip from "./MtdTooltip";

type MtdStats = {
  thisTotal: number;
  thisAvg: number;
  lastTotal: number;
  lastAvg: number;
  bestThis: { day: number; value: number };
  bestLast: { day: number; value: number };
};

type MtdDailyCompareRow = {
  day: number;
  thisMonth: number;
  lastMonth: number;
};

type Props = {
  mtdStats: MtdStats | null;
  mtdDailyCompare: MtdDailyCompareRow[];
  dailyTarget: number;
};

export default function MonthTargetViewCard({ mtdStats, mtdDailyCompare, dailyTarget }: Props) {
  return (
    <div className="card card-mtd">
      <div className="chart-header">
        <div className="chart-title-group">
          <h2>Month Target View</h2>
        </div>
      </div>
      {mtdStats ? (
        <div className="mtd-stats">
          <div>
            <span className="mtd-label">This month total</span>
            <strong>{Math.round(mtdStats.thisTotal)}</strong>
            <span className="mtd-sub">Avg/day {mtdStats.thisAvg.toFixed(1)}</span>
          </div>
          <div>
            <span className="mtd-label">Last month total</span>
            <strong>{Math.round(mtdStats.lastTotal)}</strong>
            <span className="mtd-sub">Avg/day {mtdStats.lastAvg.toFixed(1)}</span>
          </div>
          <div>
            <span className="mtd-label">Best day (this)</span>
            <strong>Day {mtdStats.bestThis.day} · {mtdStats.bestThis.value}</strong>
          </div>
          <div>
            <span className="mtd-label">Best day (last)</span>
            <strong>Day {mtdStats.bestLast.day} · {mtdStats.bestLast.value}</strong>
          </div>
        </div>
      ) : null}
      {mtdDailyCompare.length ? (
        <div className="mtd-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mtdDailyCompare} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={CHART_COLORS.axis}
                tick={{ fill: CHART_COLORS.textSecondary, fontSize: 9, fontWeight: 400 }}
                axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                tickLine={false}
                interval={4}
              />
              <YAxis
                stroke={CHART_COLORS.axis}
                tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
              />
              <ReferenceLine
                y={dailyTarget}
                stroke={CHART_COLORS.targetLine}
                strokeDasharray="4 4"
                label={{ value: `Target ${dailyTarget}`, fill: CHART_COLORS.textSecondary, fontSize: 10 }}
              />
              <Tooltip content={<MtdTooltip chartColors={CHART_COLORS} />} cursor={false} />
              <Bar
                dataKey="lastMonth"
                name="Last month"
                fill={CHART_COLORS.lastMonthBar}
                barSize={6}
                radius={[3, 3, 0, 0]}
                activeBar={false}
              />
              <Bar dataKey="thisMonth" name="This month" barSize={6} radius={[3, 3, 0, 0]} activeBar={false}>
                {mtdDailyCompare.map((row, idx) => (
                  <Cell
                    key={`mtd-this-${idx}`}
                    fill={(row.thisMonth ?? 0) >= dailyTarget ? CHART_COLORS.trendLine : CHART_COLORS.accentSoft}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty">No data yet</div>
      )}
    </div>
  );
}
