import { memo, useCallback, useMemo, type CSSProperties } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Last24HoursChartProps, TimeSeriesPoint } from "./types";
import "./Last24HoursChart.css";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;

type ChartPoint = TimeSeriesPoint & { timeValue: number; bucketIndex: number };

type ChartState = {
  points: ChartPoint[];
  chartPoints: ChartPoint[];
  domainStart: number;
  domainEnd: number;
  hourTicks: number[];
  yMax: number;
  nowX: number | null;
};

function parsePoint(point: TimeSeriesPoint): Omit<ChartPoint, "bucketIndex"> | null {
  const timeValue = new Date(point.time).getTime();
  if (!Number.isFinite(timeValue) || !Number.isFinite(point.value)) return null;
  return { ...point, timeValue };
}

function buildHourlyTicks(startMs: number, stepHours = 2): number[] {
  if (!Number.isFinite(startMs)) return [];
  const ticks: number[] = [];
  for (let hour = 0; hour <= 24; hour += stepHours) {
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
  const { points, chartPoints, domainStart, domainEnd, hourTicks, yMax, nowX }: ChartState = useMemo(() => {
    const parsed = data
      .map(parsePoint)
      .filter((point): point is Omit<ChartPoint, "bucketIndex"> => point !== null)
      .sort((a, b) => a.timeValue - b.timeValue);

    const referenceDate = parsed.length ? new Date(parsed[parsed.length - 1].timeValue) : new Date();
    const domainStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
    const domainEnd = domainStart + ONE_DAY_MS;

    const bucketMap = new Map<number, number>();
    parsed.forEach((point) => {
      if (point.timeValue < domainStart || point.timeValue > domainEnd) return;
      const bucketIndex = Math.min(47, Math.max(0, Math.floor((point.timeValue - domainStart) / HALF_HOUR_MS)));
      bucketMap.set(bucketIndex, (bucketMap.get(bucketIndex) ?? 0) + point.value);
    });

    const chartPoints: ChartPoint[] = Array.from({ length: 48 }, (_, bucketIndex) => {
      const timeValue = domainStart + bucketIndex * HALF_HOUR_MS;
      return {
        time: new Date(timeValue).toISOString(),
        timeValue,
        bucketIndex,
        value: bucketMap.get(bucketIndex) ?? 0,
      };
    });

    const points = chartPoints.filter((point) => point.value > 0);
    const maxValue = chartPoints.reduce((max, point) => Math.max(max, point.value), 0);
    const yMax = maxValue <= 0 ? 4 : Math.max(4, Math.ceil(maxValue * 1.2));
    const hourTicks = buildHourlyTicks(domainStart, 2);

    const now = Date.now();
    const nowX = now >= domainStart && now <= domainEnd ? domainStart + Math.floor((now - domainStart) / HALF_HOUR_MS) * HALF_HOUR_MS : null;

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
      if (typeof cx !== "number" || typeof cy !== "number") return <g key={`dot-${index}`} />;
      if (!payload || payload.value <= 0) return <g key={`dot-${index}`} />;
      const isLatest = latestTimeValue !== null && payload.timeValue === latestTimeValue;
      if (!isLatest) return <g key={`dot-${index}`} />;
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={10} fill="var(--last24-accent)" fillOpacity={0.12} />
          <circle cx={cx} cy={cy} r={5} fill="var(--last24-accent)" stroke="var(--last24-card-bg)" strokeWidth={2} />
        </g>
      );
    },
    [latestTimeValue]
  );

  const renderActiveDot = useCallback(
    ({ cx, cy }: { cx?: number; cy?: number }) => {
      if (typeof cx !== "number" || typeof cy !== "number") return <g />;
      return (
        <g>
          <circle cx={cx} cy={cy} r={12} fill="var(--last24-accent)" fillOpacity={0.1} />
          <circle cx={cx} cy={cy} r={6} fill="var(--last24-accent)" stroke="var(--last24-card-bg)" strokeWidth={2.5} />
        </g>
      );
    },
    []
  );

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
              margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id="last24Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--last24-accent)" stopOpacity={0.42} />
                  <stop offset="50%" stopColor="var(--last24-accent)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--last24-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="timeValue"
                type="category"
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
                  if (!point || point.value <= 0) return null;
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
                cursor={{ stroke: "var(--last24-accent)", strokeOpacity: 0.25, strokeWidth: 1.5 }}
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
                stroke="var(--last24-accent)"
                strokeWidth={2.5}
                fill="url(#last24Gradient)"
                dot={renderDot}
                activeDot={renderActiveDot}
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
