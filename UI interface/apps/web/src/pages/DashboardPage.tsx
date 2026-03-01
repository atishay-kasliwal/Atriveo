import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import KpiCard from "../components/KpiCard";
import Spinner from "../components/Spinner";
import PendingList from "../components/PendingList";
import PendingPreview from "../components/PendingPreview";
import ReferralsPreview from "../components/ReferralsPreview";
import NotesPreview from "../components/NotesPreview";
import quotesData from "../lib/quotes.json";
import {
  getDashboardSummary,
  getTargetProgress,
  updateTargets,
  type DashboardSummary,
  type TargetProgress,
} from "../lib/api";

const defaultSummary: DashboardSummary = {
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

const DEFAULT_TARGETS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
} as const;

// Executive-level chart design: muted bluish colors, clean typography, minimal noise
const CHART_COLORS = {
  // Main trend chart
  trendLine: "#6ee7b7", // soft mint
  trendGradientTop: "rgba(110, 231, 183, 0.22)",
  trendGradientBottom: "rgba(110, 231, 183, 0)",
  barGradientTop: "rgba(96, 165, 250, 0.9)",
  barGradientBottom: "rgba(30, 64, 175, 0.85)",
  // Different colors for different chart types
  weeklyBar: "#60a5fa", // muted blue for weekly
  monthlyBar: "#3b82f6", // darker blue for monthly
  referralBar: ["#60a5fa", "#818cf8", "#a78bfa"], // blue, indigo, purple
  responseBar: "#818cf8", // indigo for response status
  oaBar: "#a78bfa", // purple for OA status
  bar: ["#60a5fa", "#3b82f6", "#818cf8", "#a78bfa", "#c084fc", "#94a3b8"], // bluish palette
  grid: "rgba(255,255,255,0.08)", // lighter gridlines
  tooltipBg: "#18181b",
  tooltipBorder: "rgba(255,255,255,0.12)",
  axis: "#71717a", // subtle axis color
  text: "#e4e4e7", // primary text
  textSecondary: "#a1a1aa", // secondary text (tick labels)
};

const WEEK_COLORS = [
  "#4f8cff",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#38bdf8",
  "#818cf8",
];


const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
}

function utcDateFromIsoDay(day: string): Date | null {
  const p = parseIsoDay(day);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

function isoDayAddDays(day: string, deltaDays: number): string {
  const d = utcDateFromIsoDay(day);
  if (!d) return day;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function weekStartIsoUtc(day: string): string {
  const d = utcDateFromIsoDay(day);
  if (!d) return day;
  const dayOfWeek = d.getUTCDay(); // 0..6, Sun..Sat
  const daysFromMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

function formatDay(day: string) {
  try {
    const d = utcDateFromIsoDay(day);
    if (!d || isNaN(d.getTime())) return day;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return day;
  }
}

function formatDayShort(day: string) {
  try {
    const p = parseIsoDay(day);
    if (!p) return day;
    return `${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  } catch {
    return day;
  }
}

function formatWeek(week: string) {
  try {
    const d = utcDateFromIsoDay(week);
    if (!d || isNaN(d.getTime())) return week;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
  } catch {
    return week;
  }
}

function formatMonth(month: string) {
  try {
    const [y, m] = month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return isNaN(d.getTime()) ? month : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  } catch {
    return month;
  }
}

function dayWithSuffix(day: number): string {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function MtdTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map<string, number>();
  payload.forEach((p) => {
    const key = String(p.dataKey ?? "");
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, Number(p.value ?? 0));
  });
  const thisMonth = byKey.get("thisMonth") ?? 0;
  const lastMonth = byKey.get("lastMonth") ?? 0;
  return (
    <div
      style={{
        background: CHART_COLORS.tooltipBg,
        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
        borderRadius: 6,
        padding: "10px 14px",
      }}
    >
      <p style={{ margin: "0 0 6px 0", fontSize: 11, color: CHART_COLORS.text }}>
        Day {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CHART_COLORS.trendLine }}>
        This month: {thisMonth}
      </p>
      <p style={{ margin: "4px 0 0 0", fontSize: 13, fontWeight: 600, color: "rgba(96, 165, 250, 0.9)" }}>
        Last month: {lastMonth}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(defaultSummary);
  const [mtdSummary, setMtdSummary] = useState<DashboardSummary>(defaultSummary);
  const [targetProgress, setTargetProgress] = useState<TargetProgress | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [targetForm, setTargetForm] = useState({
    daily: "",
    weekly: "",
    monthly: "",
  });
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30); // default 30 days

  async function loadSummary() {
    try {
      setError("");
      const sum = await getDashboardSummary(days);
      setSummary(sum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMtdSummary() {
    try {
      const mtd = await getDashboardSummary(62);
      setMtdSummary(mtd);
    } catch {
      /* ignore MTD errors */
    }
  }

  async function loadTargetSummary() {
    try {
      const res = await getTargetProgress();
      setTargetProgress(res);
      setTargetForm({
        daily: String(res.daily.target ?? DEFAULT_TARGETS.daily),
        weekly: String(res.weekly.target ?? DEFAULT_TARGETS.weekly),
        monthly: String(res.monthly.target ?? DEFAULT_TARGETS.monthly),
      });
    } catch {
      setTargetProgress(null);
    }
  }

  useEffect(() => {
    loadSummary();
  }, [days]);

  useEffect(() => {
    loadMtdSummary();
  }, []);

  useEffect(() => {
    loadTargetSummary();
  }, []);

  useEffect(() => {
    const onRefresh = () => {
      loadSummary();
      loadMtdSummary();
      loadTargetSummary();
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [days]);

  const trendData = useMemo(() => {
    const raw = summary.dailyTrend ?? [];
    const lastIso = raw.length ? String(raw[raw.length - 1].day) : "";
    const lastDate = lastIso ? utcDateFromIsoDay(lastIso) : null;

    return raw.map((row, idx) => {
      const p = parseIsoDay(row.day);
      const monthIndex = p ? p.m - 1 : 0;
      const dayOfMonth = p ? p.d : 0;
      const label = `${MONTH_NAMES[monthIndex] ?? MONTH_NAMES[0]} ${dayOfMonth || 0}`;

      const value = row.total ?? 0;
      const rowDate = row.day ? utcDateFromIsoDay(row.day) : null;
      const diffDays =
        lastDate && rowDate
          ? Math.max(0, Math.round((lastDate.getTime() - rowDate.getTime()) / 86400000))
          : 0;
      const weekIndex = Math.floor(diffDays / 7);
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = raw.slice(windowStart, idx + 1);
      const avg7 =
        windowSlice.reduce((sum, r) => sum + (r.total ?? 0), 0) / (windowSlice.length || 1);
  
      return {
        ...row,
        label,
        month: monthIndex,
        dayOfMonth,
        weekIndex,
        avg7,
      };
    });
  }, [summary.dailyTrend]);

  /** KPIs derived from the same job/trend data used for the charts */
  const derivedKpis = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    const monthly = summary.monthlyTrend ?? [];
    const referral = summary.referralTrend ?? [];

    // Use the same "today" as the daily trend series (DB CURRENT_DATE).
    const seriesTodayIso = daily.length ? String(daily[daily.length - 1].day) : "";
    const todayParts = seriesTodayIso ? parseIsoDay(seriesTodayIso) : null;
    const monthKey = todayParts
      ? `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}`
      : "";

    const jobsToday = seriesTodayIso ? daily.find((r) => r.day === seriesTodayIso)?.total ?? 0 : 0;
    const jobsThisMonth = monthly.find((r) => r.month === monthKey)?.total ?? 0;
    const jobsWithReferral = referral.find((r) => r.referral_status === "Yes")?.total ?? 0;

    // This week = calendar week total to match weekly chart
    const jobsThisWeek =
      (summary.weeklyTrend?.length ?? 0) > 0
        ? summary.weeklyTrend[summary.weeklyTrend.length - 1].total ?? 0
        : 0;

    const lastWeekSameWeekday = (() => {
      if (!seriesTodayIso) return 0;
      const todayDate = utcDateFromIsoDay(seriesTodayIso);
      if (!todayDate) return 0;
      const lastWeekSameWeekdayIso = isoDayAddDays(seriesTodayIso, -7);
      return daily.find((r) => r.day === lastWeekSameWeekdayIso)?.total ?? 0;
    })();

    const lastWeekSameWeekdayLabel = (() => {
      if (!seriesTodayIso) return "Last week";
      const d = utcDateFromIsoDay(seriesTodayIso);
      if (!d) return "Last week";
      const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(d);
      return `Last week on ${weekday}`;
    })();

    const lastMonthSameDay = (() => {
      if (!todayParts) return { label: "Last month", value: 0 };
      const prevMonth = todayParts.m === 1 ? 12 : todayParts.m - 1;
      const prevYear = todayParts.m === 1 ? todayParts.y - 1 : todayParts.y;
      const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      const targetDay = Math.min(todayParts.d, daysInPrevMonth);
      const targetIso = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
      return {
        label: `Last month on ${dayWithSuffix(targetDay)}`,
        value: daily.find((r) => r.day === targetIso)?.total ?? 0,
      };
    })();

    return {
      jobs: summary.kpis.jobs ?? 0,
      jobsToday,
      jobsThisWeek,
      jobsThisMonth,
      jobsWithReferral,
      pending: summary.kpis.pending ?? 0,
      rejected: summary.kpis.rejected ?? 0,
      lastWeekSameWeekdayLabel,
      jobsLastWeekSameWeekday: lastWeekSameWeekday,
      lastMonthSameDayLabel: lastMonthSameDay.label,
      jobsLastMonthSameDay: lastMonthSameDay.value,
    };
  }, [
    summary.dailyTrend,
    summary.monthlyTrend,
    summary.referralTrend,
    summary.kpis.jobs,
    summary.weeklyTrend,
    summary.kpis.pending,
    summary.kpis.rejected,
  ]);

  const todayLabel = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    const seriesTodayIso = daily.length ? String(daily[daily.length - 1].day) : "";
    const p = seriesTodayIso ? parseIsoDay(seriesTodayIso) : null;
    if (!p) return "";
    return `${MONTH_NAMES[p.m - 1]} ${p.d}`;
  }, [summary.dailyTrend]);

  const currentMonthPrefix = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    const seriesTodayIso = daily.length ? String(daily[daily.length - 1].day) : "";
    const p = seriesTodayIso ? parseIsoDay(seriesTodayIso) : null;
    if (!p) return "";
    return `${p.y}-${String(p.m).padStart(2, "0")}`;
  }, [summary.dailyTrend]);

  const dailyTrendTicks = useMemo(() => {
    const labels = new Set<string>();
    trendData.forEach((row) => {
      if (row.dayOfMonth === 1) labels.add(row.label);
      const d = row.day ? utcDateFromIsoDay(row.day) : null;
      if (d && d.getUTCDay() === 1) labels.add(row.label); // Monday week start
    });
    if (trendData.some((row) => row.label === todayLabel)) labels.add(todayLabel);
    return trendData
      .filter((row) => labels.has(row.label))
      .map((row) => row.label)
      .filter((l, i, arr) => arr.indexOf(l) === i);
  }, [trendData, todayLabel]);

  const showTodayLine = Boolean(todayLabel) && trendData.some((row) => row.label === todayLabel);

  const weeklyMaxPoint = useMemo(() => {
    const arr = summary.weeklyTrend ?? [];
    if (!arr.length) return null;
    return arr.reduce(
      (max, pt) => ((pt.total ?? 0) > (max.total ?? 0) ? pt : max),
      arr[0] as { week: string; total: number },
    );
  }, [summary.weeklyTrend]);

  const weeklyTickFormatter = useMemo(() => {
    const arr = summary.weeklyTrend ?? [];
    const lastWeek = arr.length ? arr[arr.length - 1].week : "";
    return (week: string) => (lastWeek && week === lastWeek ? "This week" : formatWeek(week));
  }, [summary.weeklyTrend]);

  const latestMonthIndex = useMemo(() => {
    const arr = summary.monthlyTrend ?? [];
    return arr.length ? arr.length - 1 : -1;
  }, [summary.monthlyTrend]);

  const dailyMotivation = useMemo(() => {
    const list = (quotesData as { quotes?: Array<{ quote: string; author: string }> }).quotes ?? [];
    if (!list.length) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const idx = (dayOfYear - 1 + list.length) % list.length;
    return list[idx];
  }, []);

  const monthHeatmap = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    if (!daily.length) return null;
    const map = new Map<string, number>();
    daily.forEach((d) => {
      map.set(String(d.day), d.total ?? 0);
    });
    const lastIso = String(daily[daily.length - 1].day);
    const lastDate = utcDateFromIsoDay(lastIso);
    if (!lastDate) return null;

    const year = lastDate.getUTCFullYear();
    const month = lastDate.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    const startWeekday = start.getUTCDay(); // 0 Sun..6 Sat

    const cells: Array<{ day: string; value: number; dayNum: number }> = [];
    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ day: "", value: 0, dayNum: 0 });
    }
    for (let d = 1; d <= end.getUTCDate(); d += 1) {
      const date = new Date(Date.UTC(year, month, d));
      const iso = date.toISOString().slice(0, 10);
      cells.push({ day: iso, value: map.get(iso) ?? 0, dayNum: d });
    }

    return {
      year,
      month,
      todayIso: lastIso,
      todayDay: lastDate.getUTCDate(),
      cells,
    };
  }, [summary.dailyTrend]);

  const kpiSparkline = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    if (!daily.length) return [];
    return daily.slice(-14).map((d) => d.total ?? 0);
  }, [summary.dailyTrend]);

  const kpiSparklineByMetric = useMemo(() => {
    const daily = summary.dailyTrend ?? [];
    if (!daily.length) {
      return {
        total: [],
        thisMonth: [],
        thisWeek: [],
        todayWindow: [],
        referral: [],
        pending: [],
        rejects: [],
        lastWeekWindow: [],
        lastMonthWindow: [],
      };
    }

    const seriesTodayIso = String(daily[daily.length - 1].day);
    const todayDate = utcDateFromIsoDay(seriesTodayIso);
    const todayParts = seriesTodayIso ? parseIsoDay(seriesTodayIso) : null;
    const monthKey = todayParts
      ? `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}`
      : "";

    const total = daily
      .reduce<number[]>((acc, d) => {
        const prev = acc.length ? acc[acc.length - 1] : 0;
        acc.push(prev + (d.total ?? 0));
        return acc;
      }, [])
      .slice(-14);

    const thisMonth = daily
      .filter((d) => String(d.day).startsWith(monthKey))
      .slice(-14)
      .map((d) => d.total ?? 0);

    let thisWeek: number[] = [];
    if (todayDate) {
      const dayOfWeek = todayDate.getUTCDay();
      const daysFromMonday = (dayOfWeek + 6) % 7;
      const startOfWeek = isoDayAddDays(seriesTodayIso, -daysFromMonday);
      thisWeek = daily
        .filter((d) => String(d.day) >= startOfWeek)
        .map((d) => d.total ?? 0)
        .slice(-14);
    }

    const todayWindow = daily.slice(-7).map((d) => d.total ?? 0);

    const last14Days = daily.slice(-14).map((d) => String(d.day));
    const referralMap = new Map((summary.referralDailyTrend ?? []).map((d) => [String(d.day), d.total ?? 0]));
    const pendingMap = new Map((summary.pendingDailyTrend ?? []).map((d) => [String(d.day), d.total ?? 0]));
    const rejectsMap = new Map((summary.rejectedDailyTrend ?? []).map((d) => [String(d.day), d.total ?? 0]));

    const referral = last14Days.map((day) => referralMap.get(day) ?? 0);
    const pending = last14Days.map((day) => pendingMap.get(day) ?? 0);
    const rejects = last14Days.map((day) => rejectsMap.get(day) ?? 0);

    let lastWeekWindow: number[] = [];
    if (todayDate) {
      const dayOfWeek = todayDate.getUTCDay();
      const daysFromMonday = (dayOfWeek + 6) % 7;
      const thisWeekStartIso = isoDayAddDays(seriesTodayIso, -daysFromMonday);
      const lastWeekStartIso = isoDayAddDays(thisWeekStartIso, -7);
      const lastWeekEndIso = isoDayAddDays(thisWeekStartIso, -1);
      lastWeekWindow = daily
        .filter((d) => String(d.day) >= lastWeekStartIso && String(d.day) <= lastWeekEndIso)
        .map((d) => d.total ?? 0);
    }

    let lastMonthWindow: number[] = [];
    if (todayParts) {
      const prevMonth = todayParts.m === 1 ? 12 : todayParts.m - 1;
      const prevYear = todayParts.m === 1 ? todayParts.y - 1 : todayParts.y;
      const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
      lastMonthWindow = daily
        .filter((d) => String(d.day).startsWith(prevMonthKey))
        .map((d) => d.total ?? 0);
    }

    return {
      total,
      thisMonth,
      thisWeek,
      todayWindow,
      referral,
      pending,
      rejects,
      lastWeekWindow,
      lastMonthWindow,
    };
  }, [summary.dailyTrend, summary.referralDailyTrend, summary.pendingDailyTrend, summary.rejectedDailyTrend]);

  const mtdCompare = useMemo(() => {
    const daily = mtdSummary.dailyTrend ?? [];
    if (!daily.length) return null;
    const lastIso = String(daily[daily.length - 1].day);
    const lastDate = utcDateFromIsoDay(lastIso);
    if (!lastDate) return null;

    const y = lastDate.getUTCFullYear();
    const m = lastDate.getUTCMonth();
    const d = lastDate.getUTCDate();

    const thisStart = new Date(Date.UTC(y, m, 1));
    const lastMonthStart = new Date(Date.UTC(y, m - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(y, m - 1, d));

    let thisMonth = 0;
    let lastMonth = 0;
    daily.forEach((row) => {
      const rowDate = utcDateFromIsoDay(String(row.day));
      if (!rowDate) return;
      if (rowDate >= thisStart && rowDate <= lastDate) {
        thisMonth += row.total ?? 0;
      }
      if (rowDate >= lastMonthStart && rowDate <= lastMonthEnd) {
        lastMonth += row.total ?? 0;
      }
    });

    return [
      { label: "This month", total: thisMonth },
      { label: "Last month", total: lastMonth },
    ];
  }, [summary.dailyTrend]);

  const mtdDelta = useMemo(() => {
    if (!mtdCompare) return null;
    const thisMonth = mtdCompare[0]?.total ?? 0;
    const lastMonth = mtdCompare[1]?.total ?? 0;
    if (lastMonth === 0) return thisMonth === 0 ? 0 : 100;
    return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  }, [mtdCompare]);

  const mtdDailyCompare = useMemo(() => {
    const daily = mtdSummary.dailyTrend ?? [];
    if (!daily.length) return [];
    const map = new Map<string, number>();
    daily.forEach((d) => {
      map.set(String(d.day), d.total ?? 0);
    });
    const lastIso = String(daily[daily.length - 1].day);
    const lastDate = utcDateFromIsoDay(lastIso);
    if (!lastDate) return [];

    const y = lastDate.getUTCFullYear();
    const m = lastDate.getUTCMonth();
    const daysInThisMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const daysInLastMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const rows: Array<{ day: number; thisMonth: number; lastMonth: number }> = [];
    for (let d = 1; d <= daysInThisMonth; d += 1) {
      const thisIso = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
      const lastIsoDay = d <= daysInLastMonth ? new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) : "";
      const thisVal = map.get(thisIso) ?? 0;
      const lastVal = lastIsoDay ? map.get(lastIsoDay) ?? 0 : 0;
      rows.push({
        day: d,
        thisMonth: thisVal,
        lastMonth: lastVal,
      });
    }
    let runningThis = 0;
    let runningLast = 0;
    return rows.map((r) => {
      runningThis += r.thisMonth;
      runningLast += r.lastMonth;
      return { ...r, thisCum: runningThis, lastCum: runningLast };
    });
  }, [mtdSummary.dailyTrend]);

  const mtdStats = useMemo(() => {
    if (!mtdDailyCompare.length) return null;
    const thisTotal = mtdDailyCompare.reduce((s, r) => s + r.thisMonth, 0);
    const lastTotal = mtdDailyCompare.reduce((s, r) => s + r.lastMonth, 0);
    const days = mtdDailyCompare.length;
    const thisAvg = days ? thisTotal / days : 0;
    const lastAvg = days ? lastTotal / days : 0;
    const bestThis = mtdDailyCompare.reduce(
      (max, r) => (r.thisMonth > max.value ? { day: r.day, value: r.thisMonth } : max),
      { day: 0, value: 0 },
    );
    const bestLast = mtdDailyCompare.reduce(
      (max, r) => (r.lastMonth > max.value ? { day: r.day, value: r.lastMonth } : max),
      { day: 0, value: 0 },
    );
    return { thisTotal, lastTotal, thisAvg, lastAvg, bestThis, bestLast };
  }, [mtdDailyCompare]);

  const weeklyInsights = useMemo(() => {
    const daily = (mtdSummary.dailyTrend?.length ? mtdSummary.dailyTrend : summary.dailyTrend) ?? [];
    const weekly = summary.weeklyTrend ?? [];
    if (!daily.length) return null;

    // Week-over-week from weeklyTrend to match weekly chart/KPI
    const lastWeekTotal = weekly.length >= 2 ? weekly[weekly.length - 2].total ?? 0 : 0;
    const thisWeekTotal = weekly.length >= 1 ? weekly[weekly.length - 1].total ?? 0 : 0;
    const diff = thisWeekTotal - lastWeekTotal;
    const status = diff > 0 ? "ahead" : diff < 0 ? "behind" : "equal";

    // Peak across available daily range (not just last 7 days)
    const peak = daily.reduce(
      (max, d) => ((d.total ?? 0) > (max.total ?? 0) ? d : max),
      daily[0] as { day: string; total: number },
    );

    const latestNonZero = [...daily].reverse().find((d) => (d.total ?? 0) > 0);
    const latestDayTotal = latestNonZero?.total ?? 0;
    const behindPeak = Math.max((peak?.total ?? 0) - latestDayTotal, 0);

    const suggestion =
      status === "behind"
        ? "Increase daily application volume slightly to regain momentum."
        : status === "ahead"
          ? "Maintain this pace to build strong weekly momentum."
          : "Performance is stable. Focus on quality applications.";

    return {
      diff,
      status,
      peakValue: peak?.total ?? 0,
      peakLabel: peak?.day ? formatDayShort(peak.day) : "",
      behindPeak,
      latestDayTotal,
      suggestion,
    };
  }, [summary.dailyTrend, mtdSummary.dailyTrend, summary.weeklyTrend]);

  const monthlyTargetKpiValue = useMemo(() => {
    if (!targetProgress) return `${0}/${DEFAULT_TARGETS.monthly}`;
    const cur = targetProgress.monthly.current ?? 0;
    const target =
      targetProgress.monthly.target == null || targetProgress.monthly.target <= 0
        ? DEFAULT_TARGETS.monthly
        : targetProgress.monthly.target;
    return `${cur}/${target}`;
  }, [targetProgress]);

  const effectiveTargets = useMemo(() => {
    const dailyRaw = targetProgress?.daily.target;
    const weeklyRaw = targetProgress?.weekly.target;
    const monthlyRaw = targetProgress?.monthly.target;
    return {
      daily: dailyRaw == null || dailyRaw <= 0 ? DEFAULT_TARGETS.daily : dailyRaw,
      weekly: weeklyRaw == null || weeklyRaw <= 0 ? DEFAULT_TARGETS.weekly : weeklyRaw,
      monthly: monthlyRaw == null || monthlyRaw <= 0 ? DEFAULT_TARGETS.monthly : monthlyRaw,
    };
  }, [targetProgress]);

  const todayTargetLabel = useMemo(() => {
    const raw = targetProgress?.anchorDay || new Date().toISOString().slice(0, 10);
    try {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
      if (isNaN(d.getTime())) return "Today target";
      return `${new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(d)} target`;
    } catch {
      return "Today target";
    }
  }, [targetProgress?.anchorDay]);

  const targetHeaderMetrics = useMemo(() => {
    const daily = mtdSummary.dailyTrend ?? [];
    if (!daily.length) {
      return {
        dailyHits: 0,
        weeklyHits: 0,
        daysInMonth: 30,
        monthlyCurrent: 0,
        monthlyTarget: effectiveTargets.monthly,
        monthlyBehind: Math.max(effectiveTargets.monthly, 0),
        monthlyPct: 0,
      };
    }

    const anchorIso = String(daily[daily.length - 1].day);
    const anchorParts = parseIsoDay(anchorIso);
    if (!anchorParts) {
      return {
        dailyHits: 0,
        weeklyHits: 0,
        daysInMonth: 30,
        monthlyCurrent: 0,
        monthlyTarget: effectiveTargets.monthly,
        monthlyBehind: Math.max(effectiveTargets.monthly, 0),
        monthlyPct: 0,
      };
    }

    const monthPrefix = `${anchorParts.y}-${String(anchorParts.m).padStart(2, "0")}`;
    const monthRows = daily.filter((r) => String(r.day).startsWith(monthPrefix));

    const dailyHits = monthRows.filter((r) => (r.total ?? 0) >= effectiveTargets.daily).length;

    const weekTotals = new Map<string, number>();
    for (const row of monthRows) {
      const key = weekStartIsoUtc(String(row.day));
      weekTotals.set(key, (weekTotals.get(key) ?? 0) + (row.total ?? 0));
    }
    const weeklyHits = Array.from(weekTotals.values()).filter((v) => v >= effectiveTargets.weekly).length;

    const monthlyCurrent = monthRows.reduce((sum, r) => sum + (r.total ?? 0), 0);
    const monthlyTarget = effectiveTargets.monthly;
    const daysInMonth = new Date(Date.UTC(anchorParts.y, anchorParts.m, 0)).getUTCDate();
    const monthlyBehind = Math.max(monthlyTarget - monthlyCurrent, 0);
    const monthlyPct = monthlyTarget > 0 ? Math.round((monthlyCurrent / monthlyTarget) * 100) : 0;

    return {
      dailyHits,
      weeklyHits,
      daysInMonth,
      monthlyCurrent,
      monthlyTarget,
      monthlyBehind,
      monthlyPct,
    };
  }, [mtdSummary.dailyTrend, effectiveTargets.daily, effectiveTargets.weekly, effectiveTargets.monthly]);

  async function onSaveTargets(e: React.FormEvent) {
    e.preventDefault();
    function parse(v: string): number | null {
      const t = v.trim();
      if (!t) return null;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.floor(n);
    }
    try {
      setIsSavingTarget(true);
      await updateTargets({
        daily_target: parse(targetForm.daily),
        weekly_target: parse(targetForm.weekly),
        monthly_target: parse(targetForm.monthly),
      });
      await loadTargetSummary();
      setShowTargetModal(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSavingTarget(false);
    }
  }
  

  if (isLoading) {
    return (
      <div className="card">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="error">
          {error}
          {error.includes("Unauthorized") && (
            <p className="error-hint">
              Token in .env: {import.meta.env.VITE_API_TOKEN ? "set" : "missing"} · Restart dev server after editing
              apps/web/.env
            </p>
          )}
        </div>
      ) : null}

      <section className="kpi-grid">
        <KpiCard label="Applications till now" value={derivedKpis.jobs} sparkline={kpiSparklineByMetric.total} />
        <KpiCard label="Applications this month" value={derivedKpis.jobsThisMonth} sparkline={kpiSparklineByMetric.thisMonth} />
        <KpiCard label="Applications this week" value={derivedKpis.jobsThisWeek} sparkline={kpiSparklineByMetric.thisWeek} />
        <KpiCard label="Applications today" value={derivedKpis.jobsToday} sparkline={kpiSparklineByMetric.todayWindow} />
        <KpiCard
          label="Total applications with referral"
          value={derivedKpis.jobsWithReferral}
          sparkline={kpiSparklineByMetric.referral}
          sparklineColor="rgba(110, 231, 183, 0.9)"
        />
        <KpiCard
          label="Monthly target progress"
          value={monthlyTargetKpiValue}
          sparkline={kpiSparklineByMetric.thisMonth}
          sparklineColor="rgba(110, 231, 183, 0.9)"
        />
        <KpiCard label="Total rejects" value={derivedKpis.rejected} accent="red" sparkline={kpiSparklineByMetric.rejects} />
      </section>
      <section className="dashboard-actions">
        <button type="button" className="quick-add-btn" onClick={() => setShowTargetModal(true)}>
          Set Targets
        </button>
        <span className="pending-meta">
          {todayTargetLabel} {targetProgress?.daily.current ?? 0}/{effectiveTargets.daily} · Weekly target {targetProgress?.weekly.current ?? 0}/{effectiveTargets.weekly} · Monthly target {targetProgress?.monthly.current ?? 0}/{effectiveTargets.monthly}
        </span>
      </section>

      {showTargetModal ? (
        <div className="modal-overlay" onClick={() => !isSavingTarget && setShowTargetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set Application Targets</h3>
            <p className="modal-subtitle">Set your personal goals for daily, weekly, and monthly applications. Defaults are Daily 1, Weekly 7, Monthly 30.</p>
            <form className="form" onSubmit={onSaveTargets}>
              <div className="form-row">
                <label className="form-label">Daily target</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={targetForm.daily}
                  onChange={(e) => setTargetForm((p) => ({ ...p, daily: e.target.value }))}
                  placeholder="Default: 1"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Weekly target</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={targetForm.weekly}
                  onChange={(e) => setTargetForm((p) => ({ ...p, weekly: e.target.value }))}
                  placeholder="Default: 7"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Monthly target</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={targetForm.monthly}
                  onChange={(e) => setTargetForm((p) => ({ ...p, monthly: e.target.value }))}
                  placeholder="Default: 30"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isSavingTarget && setShowTargetModal(false)} disabled={isSavingTarget}>
                  Cancel
                </button>
                <button type="submit" disabled={isSavingTarget}>
                  {isSavingTarget ? "Saving..." : "Save Targets"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <section className="chart-grid chart-grid-trend">
        <div className="card card-chart-trend" style={{ paddingBottom: 24 }}>
          <div className="chart-header">
            <div className="chart-title-group">
              <h2>Applications Trend</h2>
              <p className="chart-subtitle">Daily applications</p>
            </div>
            <div className="chart-filter">
              {weeklyInsights ? (
                <span className="delta-pill">
                  {weeklyInsights.diff === 0
                    ? "Same as last week"
                    : `${weeklyInsights.diff > 0 ? "+" : "−"}${Math.abs(weeklyInsights.diff)} vs last week`}
                </span>
              ) : null}
              <span className="delta-pill">
                Daily Target Achieved: {targetHeaderMetrics.dailyHits}/{targetHeaderMetrics.daysInMonth} · Monthly Target Behind: {targetHeaderMetrics.monthlyBehind}
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
          <ResponsiveContainer width="100%" height={520}>
            <ComposedChart data={trendData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.trendLine} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.trendLine} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.barGradientTop} />
                  <stop offset="100%" stopColor={CHART_COLORS.barGradientBottom} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={CHART_COLORS.axis}
                tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                tickLine={false}
                ticks={dailyTrendTicks.length > 0 ? dailyTrendTicks : undefined}
                interval={0}
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
                  const data = props.payload[0].payload;
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
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CHART_COLORS.trendLine }}>Applications: {data.total}</p>
                    </div>
                  );
                }}
                cursor={{ fill: "rgba(96, 165, 250, 0.08)" }}
              />
              {showTodayLine ? (
                <ReferenceLine x={todayLabel} stroke={CHART_COLORS.textSecondary} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "Today", fill: CHART_COLORS.textSecondary, fontSize: 10 }} />
              ) : null}
              <Area
                type="monotone"
                dataKey="total"
                stroke="none"
                fill="url(#trendAreaGradient)"
              />
              <Bar dataKey="total" fillOpacity={0.85} radius={[5, 5, 0, 0]} label={{ position: "top", fill: CHART_COLORS.textSecondary, fontSize: 11, fontWeight: 400, dy: -4 }}>
                {trendData.map((row, i) => (
                  <Cell key={row.day ?? i} fill={WEEK_COLORS[row.weekIndex % WEEK_COLORS.length]} />
                ))}
              </Bar>
              
              <Line
                type="monotone"
                dataKey="total"
                stroke={CHART_COLORS.trendLine}
                strokeWidth={1.6}
                dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.trendLine, opacity: 0.9 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.tooltipBg, fill: CHART_COLORS.trendLine }}
              />
              <Line
                type="monotone"
                dataKey="avg7"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={1.2}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="rejected"
                stroke={CHART_COLORS.responseBar}
                strokeWidth={1.4}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.tooltipBg, fill: CHART_COLORS.responseBar }}
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
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
              }}
            >
              {dailyMotivation ? (
                <span
                  style={{
                    color: CHART_COLORS.textSecondary,
                    flex: "0 1 auto",
                    maxWidth: "48%",
                    minWidth: 0,
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                  }}
                >
                  {dailyMotivation.quote} — {dailyMotivation.author}
                </span>
              ) : null}
              <div
                style={{
                  display: "flex",
                  marginLeft: "auto",
                  justifyContent: "flex-end",
                  gap: 10,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: CHART_COLORS.trendLine }}>
                  {weeklyInsights.status === "equal"
                    ? "Same pace as last week"
                    : `You are ${Math.abs(weeklyInsights.diff)} applications ${weeklyInsights.status} vs last week`}
                </span>
                {weeklyInsights.peakLabel ? (
                  <span style={{ color: "#6ee7b7" }}>
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

      <section className="chart-grid chart-grid-two chart-grid-70-30" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 3fr)" }}>
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
                    y={effectiveTargets.daily}
                    stroke="rgba(52, 211, 153, 0.85)"
                    strokeDasharray="4 4"
                    label={{ value: `Target ${effectiveTargets.daily}`, fill: CHART_COLORS.textSecondary, fontSize: 10 }}
                  />
                  <Tooltip content={<MtdTooltip />} cursor={{ fill: "rgba(96, 165, 250, 0.08)" }} />
                  <Bar dataKey="lastMonth" name="Last month" fill="rgba(96, 165, 250, 0.6)" barSize={6} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="thisMonth" name="This month" barSize={6} radius={[3, 3, 0, 0]}>
                    {mtdDailyCompare.map((row, idx) => (
                      <Cell
                        key={`mtd-this-${idx}`}
                        fill={(row.thisMonth ?? 0) >= effectiveTargets.daily ? "#34d399" : CHART_COLORS.trendLine}
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
        <div className="card card-heatmap">
          <h2>Daily Activity</h2>
          <p className="chart-subtitle">
            {monthHeatmap ? `${MONTH_NAMES[monthHeatmap.month]} ${String(monthHeatmap.year).slice(2)}` : "This month"}
          </p>
          <div className="heatmap-weekdays">
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <div key={d} className="heatmap-weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="heatmap-grid">
            {monthHeatmap?.cells.map((cell, idx) => {
              if (!cell.dayNum) return <div key={`empty-${idx}`} className="heatmap-cell heatmap-empty" />;
              if (cell.dayNum > monthHeatmap.todayDay) {
                return (
                  <div key={cell.day} className="heatmap-cell heatmap-future" title={`${cell.day}: future`}>
                    <span>{cell.dayNum}</span>
                  </div>
                );
              }
              // Fixed 5-shade scale:
              // 0 -> bright red, 1-12 -> amber, 13-24 -> yellow, 25-35 -> mint, >35 -> bright green
              let level = 0;
              if (cell.value > 35) level = 4;
              else if (cell.value >= 25) level = 3;
              else if (cell.value >= 13) level = 2;
              else if (cell.value >= 1) level = 1;
              const isToday = monthHeatmap.todayIso === cell.day;
              return (
                <div
                  key={cell.day}
                  className={`heatmap-cell heatmap-${level}${isToday ? " heatmap-today" : ""}`}
                  title={`${cell.day}: ${cell.value}`}
                >
                  <span>{cell.dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom row: Pending / Referrals / Notes */}
      <section className="chart-grid chart-grid-three dashboard-bottom-panels">
        <div className="card pending-list-card">
          <h2>Pending</h2>
          <p className="chart-subtitle">Outstanding items</p>
          <div className="dashboard-panel-body">
            <PendingPreview />
          </div>
        </div>
        <div className="card">
          <h2>Referrals</h2>
          <p className="chart-subtitle">Open referral requests</p>
          <div className="dashboard-panel-body">
            <ReferralsPreview />
          </div>
        </div>
        <div className="card">
          <h2>Notes</h2>
          <p className="chart-subtitle">Recent notes</p>
          <div className="dashboard-panel-body">
            <NotesPreview />
          </div>
        </div>
      </section>

      <section className="chart-grid chart-grid-trend">
        <div className="card">
          <h2>Weekly Applications</h2>
          <p className="chart-subtitle">Last 12 weeks</p>
          {(summary.weeklyTrend?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={summary.weeklyTrend} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="weeklyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.weeklyBar} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.weeklyBar} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="week"
                  stroke={CHART_COLORS.axis}
                  tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                  axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                  tickLine={false}
                  tickFormatter={weeklyTickFormatter}
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
                  contentStyle={{
                    background: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                  cursor={{ fill: "rgba(96, 165, 250, 0.08)" }}
                  labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                  itemStyle={{ fontSize: 13, fontWeight: 600, color: CHART_COLORS.weeklyBar }}
                  labelFormatter={formatWeek}
                  formatter={(value: number) => [`${value}`, "Applications"]}
                />
                {/* Solid fill under trend line */}
                <Area type="monotone" dataKey="total" stroke="none" fill="url(#weeklyArea)" />
                {/* Smooth trend line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={CHART_COLORS.weeklyBar}
                  strokeWidth={2.0}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.tooltipBg, fill: CHART_COLORS.weeklyBar }}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    fill={CHART_COLORS.textSecondary}
                    fontSize={11}
                    dy={-6}
                  />
                </Line>
                {/* Single annotation for highest week */}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No applications in the last 12 weeks</div>
          )}
        </div>
      </section>

    </>
  );
}
