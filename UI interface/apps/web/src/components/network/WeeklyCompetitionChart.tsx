import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CompetitionTooltip from "./CompetitionTooltip";
import { resolveTheme, rgba, type CanvasTheme } from "./weeklyCompetitionUtils";

type WeeklyCompetitionChartProps = {
  labels: string[];
  userValues: number[];
  friendValues: number[];
  friendName: string;
  todayLabel: string;
  goalTarget?: number | null;
};

type WeeklyPoint = {
  label: string;
  you: number | null;
  friend: number | null;
  youAhead: [number, number] | null;
  friendAhead: [number, number] | null;
};

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
      const isFuture = index > todayIndex;
      if (isFuture) {
        return { label, you: null, friend: null, youAhead: null, friendAhead: null };
      }
      const you = Number(userValues[index] ?? 0);
      const friend = Number(friendValues[index] ?? 0);
      return {
        label,
        you,
        friend,
        youAhead: you >= friend ? ([friend, you] as [number, number]) : null,
        friendAhead: friend > you ? ([you, friend] as [number, number]) : null,
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
  }, [friendValues, labels, todayIndex, userValues]);

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
        const core = series === "you" ? "#2563EB" : "#8B5CF6";
        const baseRadius = series === "you" ? 3.6 : 3.2;
        const radius = isToday ? baseRadius + 1.5 : baseRadius;
        const ringStroke = isFuture ? rgba("#FFFFFF", 0.42) : "#FFFFFF";

        return (
          <g key={`dot-${series}-${idx}`} style={{ pointerEvents: "none" }}>
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

      const text = `${value}`;
      const textY = placement === "above"
        ? y - (idx === chartTodayIndex ? 20 : 14)
        : y + (idx === chartTodayIndex ? 24 : 18);
      const textFill = series === "you"
        ? (theme.mode === "light" ? "#1D4ED8" : "#93C5FD")
        : (theme.mode === "light" ? "#6D28D9" : "#C4B5FD");

      return (
        <g style={{ pointerEvents: "none" }}>
          <text
            x={x}
            y={textY}
            textAnchor="middle"
            fill={textFill}
            fontSize={12}
            fontWeight={800}
            style={{ fontFamily: theme.fontFamily, letterSpacing: "-0.01em" }}
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
              <stop offset="0%" stopColor="rgba(37,99,235,0.32)" />
              <stop offset="60%" stopColor="rgba(37,99,235,0.08)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0)" />
            </linearGradient>
            <linearGradient id={`friendArea-${idBase}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.24)" />
              <stop offset="60%" stopColor="rgba(139,92,246,0.06)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
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
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#3B82F6" floodOpacity="0.45" />
            </filter>
            <filter id={`friendGlow-${idBase}`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.35" />
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

          <Area type="monotone" dataKey="youAhead" stroke="none" fill="rgba(37,99,235,0.12)" isAnimationActive={false} />
          <Area type="monotone" dataKey="friendAhead" stroke="none" fill="rgba(139,92,246,0.10)" isAnimationActive={false} />
          <Area type="monotone" dataKey="friend" stroke="none" fill={`url(#friendArea-${idBase})`} isAnimationActive={false} />
          <Area type="monotone" dataKey="you" stroke="none" fill={`url(#userArea-${idBase})`} isAnimationActive={false} />

          {todayLabel && todayLabel !== "0" ? (
            <ReferenceLine
              x={todayLabel}
              stroke="rgba(148,163,184,0.3)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: "Today",
                position: "insideTopRight",
                fontSize: 10,
                fontWeight: 600,
                fill: theme.textMuted,
                dy: -4,
              }}
            />
          ) : null}

          <Line
            key="line-friend"
            type="monotone"
            dataKey="friend"
            stroke="#8B5CF6"
            strokeOpacity={0.95}
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={renderDot("friend")}
            label={renderCountLabel("friend", "below")}
            activeDot={{ r: 5.2, fill: "#8B5CF6", stroke: "#FFFFFF", strokeWidth: 1.6 }}
            isAnimationActive={false}
          />
          <Line
            key="line-friend-glow"
            type="monotone"
            dataKey="friend"
            stroke="#8B5CF6"
            strokeWidth={2.6}
            filter={`url(#friendGlow-${idBase})`}
            dot={false}
            activeDot={false}
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
            key="line-you-glow"
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
