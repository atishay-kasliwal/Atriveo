import type { DashboardSummary } from "../../lib/api";

export const defaultSummary: DashboardSummary = {
  kpis: {
    jobs: 0,
    referrals: 0,
    pending: 0,
    rejected: 0,
    jobsThisMonth: 0,
    jobsThisWeek: 0,
    jobsToday: 0,
    jobsWithReferral: 0,
  },
  dailyTrend: [],
  referralDailyTrend: [],
  rejectedDailyTrend: [],
  pendingDailyTrend: [],
  referralTrend: [],
  weeklyTrend: [],
  responseStatusTrend: [],
  oaStatusTrend: [],
  monthlyTrend: [],
};

export const DEFAULT_TARGETS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
} as const;

export const ENTERPRISE_SERIES_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#14B8A6",
  "#22C55E",
  "#84CC16",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#A855F7",
  "#EC4899",
];

export const KPI_SPARKLINE_COLORS = {
  primaryBlue: ENTERPRISE_SERIES_COLORS[0],
  skyBlue: ENTERPRISE_SERIES_COLORS[1],
  teal: ENTERPRISE_SERIES_COLORS[2],
  green: ENTERPRISE_SERIES_COLORS[0],
  lime: ENTERPRISE_SERIES_COLORS[1],
  amber: ENTERPRISE_SERIES_COLORS[2],
  red: ENTERPRISE_SERIES_COLORS[0],
  purple: ENTERPRISE_SERIES_COLORS[1],
} as const;

export const CHART_COLORS = {
  trendLine: ENTERPRISE_SERIES_COLORS[0],
  trendGradientTop: "rgba(37, 99, 235, 0.25)",
  trendGradientBottom: "rgba(37, 99, 235, 0)",
  barGradientTop: "rgba(14, 165, 233, 0.9)",
  barGradientBottom: "rgba(37, 99, 235, 0.72)",
  weeklyBar: ENTERPRISE_SERIES_COLORS[2],
  responseBar: ENTERPRISE_SERIES_COLORS[7],
  grid: "var(--chart-grid)",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  axis: "var(--chart-axis)",
  text: "var(--chart-text)",
  textSecondary: "var(--chart-text-secondary)",
  accentSoft: "var(--accent-soft)",
  targetLine: "color-mix(in srgb, var(--accent-soft) 86%, transparent)",
  lastMonthBar: "color-mix(in srgb, var(--text-muted) 56%, transparent)",
  movingAverage: "color-mix(in srgb, var(--text-muted) 74%, transparent)",
};

export const WEEK_COLORS = [
  ENTERPRISE_SERIES_COLORS[0],
  ENTERPRISE_SERIES_COLORS[1],
  ENTERPRISE_SERIES_COLORS[2],
  ENTERPRISE_SERIES_COLORS[0],
];

export const SLOW_DASHBOARD_LOAD_THRESHOLD_MS = 1500;
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
