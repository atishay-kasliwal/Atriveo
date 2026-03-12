import { memo, useCallback, useId, useMemo, useState, type CSSProperties } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Last24HoursChartProps, TimeSeriesPoint } from "./types";
import "./Last24HoursChart.css";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ChartPoint = TimeSeriesPoint & { timeValue: number; isPadding?: boolean };

type ChartState = {
  points: ChartPoint[];
  chartPoints: ChartPoint[];
  domainStart: number;
  domainEnd: number;
  hourTicks: number[];
  yMax: number;
  nowX: number | null;
};

function parsePoint(point: TimeSeriesPoint): ChartPoint | null {
  const timeValue = new Date(point.time).getTime();
  if (!Number.isFinite(timeValue) || !Number.isFinite(point.value)) return null;
  return { ...point, timeValue };
}

function buildHourlyTicks(startMs: number, stepHours = 1): number[] {
  if (!Number.isFinite(startMs)) return [];
  const ticks: number[] = [];
  for (let hour = 1; hour <= 24; hour += stepHours) {
    ticks.push(startMs + hour * 60 * 60 * 1000);
  }
  return ticks;
}

const Last24HoursChart = memo(function Last24HoursChart({
  title,
  metricTotal,
  changePercent,
  data,
}: Last24HoursChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { points, chartPoints, domainStart, domainEnd, hourTicks, yMax, nowX }: ChartState = useMemo(() => {
    const parsed = data
      .map(parsePoint)
      .filter((point): point is ChartPoint => point !== null)
      .sort((a, b) => a.timeValue - b.timeValue);

    const referenceDate = parsed.length ? new Date(parsed[parsed.length - 1].timeValue) : new Date();
    const domainStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
    const domainEnd = domainStart + ONE_DAY_MS;
    const points = parsed.filter((point) => point.timeValue >= domainStart && point.timeValue <= domainEnd);
    const chartPoints = points.length ? [...points] : [];

    if (chartPoints.length) {
      const first = chartPoints[0];
      const last = chartPoints[chartPoints.length - 1];
      if (first.timeValue > domainStart) {
        chartPoints.unshift({
          time: new Date(domainStart).toISOString(),
          value: 0,
          timeValue: domainStart,
          isPadding: true,
        });
      }
      if (last.timeValue < domainEnd) {
        chartPoints.push({
          time: new Date(domainEnd).toISOString(),
          value: 0,
          timeValue: domainEnd,
          isPadding: true,
        });
      }
    }

    const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0);
    const yMax = maxValue <= 0 ? 4 : Math.max(4, Math.ceil(maxValue * 1.2));
    const hourTicks = buildHourlyTicks(domainStart, 1);

    const now = Date.now();
    const nowX = now >= domainStart && now <= domainEnd ? now : null;

    return { points, chartPoints, domainStart, domainEnd, hourTicks, yMax, nowX };
  }, [data]);

  const totalFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const avgFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const totalDisplay = useMemo(() => totalFormatter.format(metricTotal), [metricTotal, totalFormatter]);
  const avgPerHour = useMemo(() => avgFormatter.format(metricTotal / 24), [metricTotal, avgFormatter]);

  const changeDisplay = useMemo(() => {
    if (typeof changePercent !== "number" || !Number.isFinite(changePercent)) return null;
    const rounded = Math.round(changePercent);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }, [changePercent]);

  const changeClass = useMemo(() => {
    if (typeof changePercent !== "number" || !Number.isFinite(changePercent)) return "last24-chart-change";
    if (changePercent > 0) return "last24-chart-change last24-chart-change--up";
    if (changePercent < 0) return "last24-chart-change last24-chart-change--down";
    return "last24-chart-change last24-chart-change--flat";
  }, [changePercent]);

  const formatHourTick = useCallback(
    (value: number) => {
      const hour = Math.round((value - domainStart) / 3600000);
      const clamped = Math.min(Math.max(hour, 0), 24);
      return `${clamped}:00`;
    },
    [domainStart]
  );

  const formatTime24 = useCallback((value: number) => {
    const date = new Date(value);
    const hours = String(date.getHours());
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }, []);

  const latestTimeValue = useMemo(
    () => (points.length ? points[points.length - 1].timeValue : null),
    [points]
  );

  const renderDot = useCallback(
    ({
      cx,
      cy,
      index,
      payload,
    }: {
      cx?: number;
      cy?: number;
      index?: number;
      payload?: ChartPoint;
    }) => {
      if (typeof cx !== "number" || typeof cy !== "number" || typeof index !== "number") return null;
      if (!payload || payload.isPadding) return null;
      const isLatest = latestTimeValue !== null && payload.timeValue === latestTimeValue;
      const isActive = index === activeIndex;
      const radius = isActive ? 6 : isLatest ? 5 : 4;
      return (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="var(--last24-card-bg)"
          stroke="var(--last24-accent)"
          strokeWidth={2.5}
        />
      );
    },
    [activeIndex, latestTimeValue]
  );

  const handleMouseMove = useCallback(
    (state: { isTooltipActive?: boolean; activeTooltipIndex?: number }) => {
      if (state?.isTooltipActive && typeof state.activeTooltipIndex === "number") {
        const hovered = chartPoints[state.activeTooltipIndex];
        if (hovered?.isPadding) {
          setActiveIndex(null);
          return;
        }
        setActiveIndex(state.activeTooltipIndex);
      } else {
        setActiveIndex(null);
      }
    },
    [chartPoints]
  );

  const handleMouseLeave = useCallback(() => setActiveIndex(null), []);

  const accentStyle = useMemo(
    () =>
      ({
        ["--last24-accent" as const]: "#2563EB",
        ["--last24-accent-soft" as const]: "rgba(37, 99, 235, 0.26)",
      }) as CSSProperties,
    []
  );

  return (
    <section className="last24-chart-card" style={accentStyle}>
      <div className="last24-chart-header">
        <div className="last24-chart-header-left">
          <h3 className="last24-chart-title">{title}</h3>
          <div className="last24-chart-meta">
            <span className={changeClass}>
              {changeDisplay ?? "—"} <span className="last24-chart-meta-muted">vs yesterday</span>
            </span>
            <span className="last24-chart-divider">•</span>
            <span className="last24-chart-meta-muted">Avg/hour {avgPerHour}</span>
          </div>
        </div>
        <div className="last24-chart-total">{totalDisplay}</div>
      </div>

      {points.length ? (
        <div className="last24-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartPoints}
              margin={{ top: 6, right: 12, left: 0, bottom: 4 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id={`last24Area_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--last24-accent)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--last24-accent)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timeValue"
                type="number"
                scale="time"
                domain={[domainStart, domainEnd]}
                ticks={hourTicks}
                tickFormatter={formatHourTick}
                tick={{ fill: "var(--chart-text-secondary)", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                height={22}
                interval={0}
              />
              <YAxis
                width={36}
                domain={[0, yMax]}
                tick={{ fill: "var(--chart-text-secondary)", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={(props) => {
                  if (!props.active || !props.payload?.length) return null;
                  const point = props.payload[0]?.payload as ChartPoint | undefined;
                  if (!point || point.isPadding) return null;
                  const label = point.value === 1 ? "Application" : "Applications";
                  return (
                    <div className="last24-tooltip">
                      <div className="last24-tooltip-time">{formatTime24(point.timeValue)}</div>
                      <div className="last24-tooltip-value">
                        {point.value} {label}
                      </div>
                    </div>
                  );
                }}
                cursor={false}
                shared={false}
              />
              {nowX !== null ? (
                <ReferenceLine
                  x={nowX}
                  stroke="var(--chart-text-secondary)"
                  strokeOpacity={0.45}
                  strokeDasharray="4 4"
                  label={{ value: "Now", position: "insideBottom", fill: "var(--chart-text-secondary)", fontSize: 10 }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#last24Area_${gradientId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--last24-accent)"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="none"
                dot={renderDot}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="last24-chart-empty">No data yet</div>
      )}
    </section>
  );
});

export default Last24HoursChart;
