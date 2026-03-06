import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type WeeklyCompetitionChartProps = {
  labels: string[];
  userValues: number[];
  friendValues: number[];
  friendName: string;
  todayLabel: string;
  goalTarget?: number | null;
};

type CanvasTheme = {
  mode: "light" | "dark";
  fontFamily: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  gridOpacity: number;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
};

type WeeklyPoint = {
  label: string;
  you: number;
  friend: number;
  youAhead: [number, number] | null;
  friendAhead: [number, number] | null;
};

function rgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveTheme(modeOverride?: "light" | "dark"): CanvasTheme {
  const fallback: CanvasTheme = {
    mode: "dark",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    grid: "rgba(51,65,85,0.35)",
    gridOpacity: 0.42,
    tooltipBg: "#0F172A",
    tooltipBorder: "rgba(148,163,184,0.34)",
    tooltipShadow: "0 14px 28px rgba(2, 6, 23, 0.5)",
  };

  if (typeof window === "undefined") return fallback;

  const styles = window.getComputedStyle(document.documentElement);
  const value = (name: string, backup: string) => styles.getPropertyValue(name).trim() || backup;

  const mode = modeOverride ?? ((document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark") as "light" | "dark");
  return {
    mode,
    fontFamily: value("--font-header", fallback.fontFamily),
    textPrimary: mode === "light" ? "#0F172A" : value("--chart-text", fallback.textPrimary),
    textSecondary: mode === "light" ? "#334155" : value("--chart-text-secondary", fallback.textSecondary),
    textMuted: mode === "light" ? "#64748B" : "#94A3B8",
    grid: mode === "light" ? "#C7D2E4" : value("--network-chart-grid", fallback.grid),
    gridOpacity: mode === "light" ? 0.72 : 0.42,
    tooltipBg: mode === "light" ? "#FFFFFF" : value("--chart-tooltip-bg", fallback.tooltipBg),
    tooltipBorder: mode === "light" ? "#DCE6F5" : value("--chart-tooltip-border", fallback.tooltipBorder),
    tooltipShadow: mode === "light" ? "0 12px 28px rgba(15, 23, 42, 0.14)" : value("--chart-tooltip-shadow", fallback.tooltipShadow),
  };
}

type CompetitionTooltipProps = TooltipProps<ValueType, NameType> & {
  friendName: string;
  theme: CanvasTheme;
};

function CompetitionTooltip({ active, payload, label, friendName, theme }: CompetitionTooltipProps) {
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

export default function WeeklyCompetitionChart({
  labels,
  userValues,
  friendValues,
  friendName,
  todayLabel,
  goalTarget = null,
}: WeeklyCompetitionChartProps) {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    typeof window === "undefined"
      ? "dark"
      : (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"),
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const root = document.documentElement;
    const syncMode = () => {
      setThemeMode(root.getAttribute("data-theme") === "light" ? "light" : "dark");
    };
    syncMode();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "data-theme")) {
        syncMode();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  const theme = useMemo(() => resolveTheme(themeMode), [themeMode]);
  const showGrid = theme.mode === "light";
  const todayIndexRaw = labels.indexOf(todayLabel);
  const todayIndex = todayIndexRaw >= 0 ? todayIndexRaw : Math.max(0, labels.length - 1);
  const chartTodayIndex = todayIndex + 1; // +1 because we prepend "0"
  const idBase = useId().replace(/[:]/g, "");
  void goalTarget;

  const points = useMemo<WeeklyPoint[]>(() => {
    const dayPoints = labels.map((label, index) => {
      const you = Number(userValues[index] ?? 0);
      const friend = Number(friendValues[index] ?? 0);
      return {
        label,
        you,
        friend,
        youAhead: you >= friend ? [friend, you] : null,
        friendAhead: friend > you ? [you, friend] : null,
      };
    });
    return [
      {
        label: "0",
        you: 0,
        friend: 0,
        youAhead: [0, 0],
        friendAhead: [0, 0],
      },
      ...dayPoints,
    ];
  }, [friendValues, labels, userValues]);

  const yMax = useMemo(() => Math.max(4, ...userValues, ...friendValues) + 2, [friendValues, userValues]);

  const fadeStops = useMemo(() => {
    const denom = Math.max(1, points.length - 1);
    return points.map((_, idx) => {
      const offset = (idx / denom) * 100;
      if (idx > chartTodayIndex) return { offset, opacity: 0.28 };
      const rampBase = Math.max(1, chartTodayIndex);
      const ratio = idx / rampBase;
      return { offset, opacity: 0.45 + ratio * 0.55 };
    });
  }, [chartTodayIndex, points]);

  const renderDot = useMemo(() => {
    return (series: "you" | "friend") =>
      (props: { cx?: number; cy?: number; index?: number; payload?: WeeklyPoint }) => {
        const cx = Number(props.cx ?? NaN);
        const cy = Number(props.cy ?? NaN);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

        const idx = Number(props.index ?? -1);
        const isToday = idx === chartTodayIndex;
        const isFuture = idx > chartTodayIndex;
        const point = props.payload;
        const value = Number(series === "you" ? point?.you : point?.friend);
        const hasValue = value > 0;
        if (!hasValue && !isToday) return null;
        const core = series === "you" ? "#2563EB" : "#F59E0B";
        const baseRadius = series === "you" ? 3.6 : 3.2;
        const radius = isToday ? baseRadius + 1.5 : baseRadius;
        const ringStroke = isFuture ? rgba("#FFFFFF", 0.42) : "#FFFFFF";

        return (
          <g style={{ pointerEvents: "none" }}>
            {isToday && hasValue ? <circle cx={cx} cy={cy} r={radius + 4} fill={rgba(core, 0.24)} /> : null}
            <circle cx={cx} cy={cy} r={radius} fill={core} stroke={ringStroke} strokeWidth={isToday ? 2 : 1.4} />
          </g>
        );
      };
  }, [chartTodayIndex]);

  const renderCountLabel = useMemo(() => {
    return (series: "you" | "friend", placement: "above" | "below") =>
    (props: { x?: number; y?: number; index?: number; value?: number | string }) => {
      const x = Number(props.x ?? NaN);
      const y = Number(props.y ?? NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      const idx = Number(props.index ?? -1);
      if (idx <= 0 || idx > chartTodayIndex) return null;
      const value = Number(props.value ?? 0);
      if (!Number.isFinite(value)) return null;
      if (value <= 0) return null;

      const text = `Count: ${value}`;
      const textY = placement === "above"
        ? y - (idx === chartTodayIndex ? 20 : 14)
        : y + (idx === chartTodayIndex ? 24 : 18);
      const textFill = series === "you"
        ? (theme.mode === "light" ? "#1D4ED8" : "#BFDBFE")
        : (theme.mode === "light" ? "#B45309" : "#FDE68A");

      return (
        <g style={{ pointerEvents: "none" }}>
          <text
            x={x}
            y={textY}
            textAnchor="middle"
            fill={textFill}
            fontSize={10}
            fontWeight={700}
            style={{ fontFamily: theme.fontFamily, letterSpacing: "0.01em" }}
          >
            {text}
          </text>
        </g>
      );
    };
  }, [chartTodayIndex, theme.fontFamily, theme.mode]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, padding: "4px 2px 6px 0", boxSizing: "border-box" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 14, right: 8, left: 0, bottom: 6 }}>
          <defs>
            <linearGradient id={`userArea-${idBase}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(37,99,235,0.20)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0.01)" />
            </linearGradient>
            <linearGradient id={`friendArea-${idBase}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(245,158,11,0.14)" />
              <stop offset="100%" stopColor="rgba(245,158,11,0)" />
            </linearGradient>
            <linearGradient id={`userStroke-${idBase}`} x1="0" y1="0" x2="1" y2="0">
              {fadeStops.map((stop) => (
                <stop
                  key={`fade-${stop.offset}`}
                  offset={`${stop.offset}%`}
                  stopColor="#2563EB"
                  stopOpacity={stop.opacity}
                />
              ))}
            </linearGradient>
            <filter id={`userGlow-${idBase}`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#2563EB" floodOpacity="0.35" />
            </filter>
          </defs>

          <CartesianGrid
            stroke={theme.grid}
            vertical
            strokeDasharray="3 3"
            strokeOpacity={showGrid ? theme.gridOpacity : 0}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            padding={{ left: 0, right: 0 }}
            tickMargin={10}
            minTickGap={18}
            tickFormatter={(value) => (String(value ?? "") === "0" ? "" : String(value ?? ""))}
            tick={{ fill: theme.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: theme.fontFamily }}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, yMax]}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            width={30}
            tickMargin={6}
            tick={{ fill: theme.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: theme.fontFamily }}
          />

          <Tooltip
            cursor={{ stroke: theme.grid, strokeDasharray: "4 4", strokeOpacity: 0.75 }}
            content={<CompetitionTooltip friendName={friendName} theme={theme} />}
          />

          <Area type="monotone" dataKey="youAhead" stroke="none" fill="rgba(37,99,235,0.10)" isAnimationActive={false} />
          <Area type="monotone" dataKey="friendAhead" stroke="none" fill="rgba(245,158,11,0.12)" isAnimationActive={false} />
          <Area type="monotone" dataKey="friend" stroke="none" fill={`url(#friendArea-${idBase})`} isAnimationActive={false} />
          <Area type="monotone" dataKey="you" stroke="none" fill={`url(#userArea-${idBase})`} isAnimationActive={false} />

          <Line
            type="monotone"
            dataKey="friend"
            stroke="#F59E0B"
            strokeOpacity={0.98}
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={renderDot("friend")}
            label={renderCountLabel("friend", "below")}
            activeDot={{ r: 5.2, fill: "#F59E0B", stroke: "#FFFFFF", strokeWidth: 1.6 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="you"
            stroke="#1D4ED8"
            strokeOpacity={0.98}
            strokeWidth={2.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={renderDot("you")}
            label={renderCountLabel("you", "above")}
            activeDot={{ r: 5.8, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 1.8 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="you"
            stroke={`url(#userStroke-${idBase})`}
            strokeWidth={3}
            filter={`url(#userGlow-${idBase})`}
            dot={false}
            activeDot={{ r: 4, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
