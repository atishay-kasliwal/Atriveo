import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Spinner from "../components/Spinner";
import TargetSignalsCarousel from "../components/network/TargetSignalsCarousel";
import {
  createJob,
  getNetworkToday,
  getNetworkTrend,
  type NetworkTodayFriend,
  type NetworkTrendFriend,
} from "../lib/api";
import { formatTableDateTime, getLocalISODate } from "../lib/formatDate";
import { buildNetworkTickerFacts } from "../lib/networkTicker";

const ENTERPRISE_CHART_COLORS = [
  "#2563EB",
  "#3B82F6",
  "#0EA5E9",
  "#14B8A6",
  "#64748B",
  "#7C8FB5",
  "#5C739B",
  "#4A678F",
  "#7A8FB4",
  "#6B7FA3",
];
const NETWORK_TREND_COLORS = [
  ENTERPRISE_CHART_COLORS[0],
  ENTERPRISE_CHART_COLORS[1],
  ENTERPRISE_CHART_COLORS[2],
  ENTERPRISE_CHART_COLORS[3],
  ENTERPRISE_CHART_COLORS[5],
  ENTERPRISE_CHART_COLORS[8],
];
const MAX_NETWORK_TREND_FRIENDS = 5;
const NETWORK_CHART_THEME = {
  grid: "var(--chart-grid)",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  tooltipShadow: "var(--chart-tooltip-shadow)",
  axis: "var(--chart-axis)",
  textSecondary: "var(--chart-text-secondary)",
  textPrimary: "var(--chart-text)",
  accentSoft: "var(--accent-soft)",
};
const WEEKLY_LINE_PALETTE = [
  ENTERPRISE_CHART_COLORS[0],
  ENTERPRISE_CHART_COLORS[1],
  ENTERPRISE_CHART_COLORS[2],
  ENTERPRISE_CHART_COLORS[3],
  ENTERPRISE_CHART_COLORS[4],
];

function rgbaFromHex(hex: string, alpha: number): string {
  const normalized = String(hex || "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(normalized);
  const full = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!short && !full) return normalized || `rgba(37, 99, 235, ${alpha})`;
  const raw = short ? short[1].split("").map((c) => `${c}${c}`).join("") : full?.[1] ?? "3385ff";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function todayBarGradientId(key: string): string {
  return `todayBarGrad-${String(key || "unknown").replace(/[^a-z0-9_-]/gi, "-")}`;
}

function weeklyShadeGradientId(key: string): string {
  return `weeklyShadeGrad-${String(key || "unknown").replace(/[^a-z0-9_-]/gi, "-")}`;
}

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
  const dayOfWeek = d.getUTCDay(); // Sun=0..Sat=6
  const daysFromMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

function formatWeekdayShort(day: string): string {
  const d = utcDateFromIsoDay(day);
  if (!d || Number.isNaN(d.getTime())) return formatDayShort(day);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(d);
}

function formatDayShort(day: string) {
  const parts = String(day).split("-");
  if (parts.length !== 3) return day;
  return `${parts[1]}/${parts[2]}`;
}

function formatFirstNameLastInitial(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return String(name || "");
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return `${parts[0]} ${lastInitial}`;
}

function NetworkInsightBarTooltip({
  active,
  payload,
  metricLabel,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: { label?: string; color?: string };
  }>;
  metricLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const name = String(row?.payload?.label ?? "");
  const value = Number(row?.value ?? 0);
  const color = String(row?.payload?.color ?? "var(--chart-text-secondary)");

  return (
    <div
      style={{
        background: NETWORK_CHART_THEME.tooltipBg,
        border: `1px solid ${NETWORK_CHART_THEME.tooltipBorder}`,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 180,
        boxShadow: NETWORK_CHART_THEME.tooltipShadow,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, color, fontWeight: 700 }}>{name}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--chart-text-secondary)" }}>
        {metricLabel}: <strong>{value}</strong>
      </p>
    </div>
  );
}

function NetworkWeeklyTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .map((p) => ({
      name: String(p.name ?? ""),
      value: Number(p.value ?? 0),
      color: String(p.color ?? "var(--chart-text-secondary)"),
    }))
    .filter((r) => r.name)
    .sort((a, b) => b.value - a.value);

  return (
    <div
      style={{
        background: NETWORK_CHART_THEME.tooltipBg,
        border: `1px solid ${NETWORK_CHART_THEME.tooltipBorder}`,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 190,
        boxShadow: NETWORK_CHART_THEME.tooltipShadow,
      }}
    >
      <p style={{ margin: "0 0 8px", color: "var(--chart-text)", fontSize: 12, fontWeight: 700 }}>{String(label ?? "")}</p>
      {rows.map((row) => (
        <p key={row.name} style={{ margin: "0 0 6px", color: row.color, fontSize: 12 }}>
          {row.name}: <strong>{row.value}</strong>
        </p>
      ))}
    </div>
  );
}

function toDateInput(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return getLocalISODate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return getLocalISODate();
  return d.toISOString().slice(0, 10);
}

function normalizeOaStatus(value: unknown): "Yes" | "No" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "pending" || raw === "completed" || raw === "complete" || raw === "done" || raw === "missed" || raw === "missing" || raw === "overdue") return "Yes";
  return "No";
}

function emojiForTickerFact(text: string): string {
  if (text.startsWith("Weekly Leader:")) return "★";
  if (text.startsWith("Runner-Up:")) return "◆";
  if (text.startsWith("Lead:")) return "▲";
  if (text.startsWith("Leading Today:")) return "●";
  if (text.startsWith("Close Race:")) return "◈";
  if (text.startsWith("Most Daily Wins:")) return "♛";
  if (text.startsWith("Team Total:")) return "▦";
  if (text.startsWith("Most Consistent:")) return "◎";
  if (text.startsWith("Top Single Day:")) return "✦";
  return "•";
}

function augmentDemoNetworkData(
  trendRows: NetworkTrendFriend[],
  todayRows: NetworkTodayFriend[],
): { trend: NetworkTrendFriend[]; today: NetworkTodayFriend[] } {
  const companies = ["Google", "Amazon", "Meta", "Microsoft", "Apple", "Netflix", "NVIDIA", "Databricks", "Stripe", "Uber"];
  const roles = ["Software Engineer", "Frontend Engineer", "Backend Engineer", "Data Scientist", "ML Engineer", "Product Engineer"];
  const now = Date.now();
  const todayIso = getLocalISODate();

  const trend = trendRows.map((friend, idx) => {
    const bumpBase = 1 + (idx % 3);
    const boostedTrend = (friend.trend ?? []).map((point, pointIdx) => {
      const isRecent = point.day >= isoDayAddDays(todayIso, -6);
      const boost = isRecent ? ((pointIdx + idx) % 3 === 0 ? bumpBase + 1 : bumpBase) : 0;
      return {
        ...point,
        total: Number(point.total ?? 0) + boost,
      };
    });
    return {
      ...friend,
      trend: boostedTrend,
    };
  });

  const today = todayRows.map((friend, idx) => {
    const existing = Array.isArray(friend.jobs) ? friend.jobs : [];
    const extraCount = existing.length >= 2 ? 1 : 2;
    const extraJobs = Array.from({ length: extraCount }, (_, j) => {
      const company = companies[(idx * 2 + j) % companies.length];
      const role = roles[(idx + j) % roles.length];
      const ts = new Date(now - (idx * 31 + j * 13) * 60000).toISOString();
      return {
        id: 900000 + idx * 10 + j,
        company,
        role,
        date_saved: ts,
        application_status: "Applied",
        referral_status: j % 2 === 0 ? "Requested" : "No",
        oa_status: "No",
        oa_deadline_date: null,
        job_application_id: "-",
        job_link: `https://careers.example.com/${encodeURIComponent(company.toLowerCase())}/${(idx + j + 100).toString(36)}`,
      };
    });
    return {
      ...friend,
      jobs: [...existing, ...extraJobs],
    };
  });

  return { trend, today };
}

export default function NetworkPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const useTargetDemoFallback = params?.get("demoTargets") === "1" || params?.get("demoNetwork") === "1";
  const useNetworkDemoAugment = params?.get("demoNetwork") === "1";
  const [trendData, setTrendData] = useState<NetworkTrendFriend[]>([]);
  const [todayData, setTodayData] = useState<NetworkTodayFriend[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(false);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [isPrefillSaving, setIsPrefillSaving] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [prefillFromName, setPrefillFromName] = useState("");
  const [prefillForm, setPrefillForm] = useState({
    company: "",
    role: "",
    date_saved: getLocalISODate(),
    job_link: "",
    job_application_id: "",
    oa_deadline_date: "",
    location_raw: "",
    oa_status: "No",
    referral_status: "",
    keyword_matching: "Medium",
    notes: "",
  });
  const load = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      const [trendRes, todayRes] = await Promise.all([getNetworkTrend(10), getNetworkToday()]);
      const augmented = useNetworkDemoAugment
        ? augmentDemoNetworkData(trendRes.data ?? [], todayRes.data ?? [])
        : { trend: trendRes.data ?? [], today: todayRes.data ?? [] };
      setTrendData(augmented.trend);
      setTodayData(augmented.today);
    } catch (e) {
      setError((e as Error).message);
      setTrendData([]);
      setTodayData([]);
    } finally {
      setIsLoading(false);
    }
  }, [useNetworkDemoAugment]);

  useEffect(() => {
    load();
  }, [load]);

  function openFriendManager() {
    window.dispatchEvent(new CustomEvent("open-friend-manager"));
  }

  function openPrefillFromFriend(
    friendName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
    },
  ) {
    setPrefillFromName(friendName);
    setPrefillError("");
    setPrefillForm({
      company: String(job.company ?? ""),
      role: String(job.role ?? ""),
      date_saved: toDateInput(job.date_saved),
      job_link: String(job.job_link ?? ""),
      job_application_id: String(job.job_application_id ?? "-"),
      oa_deadline_date: toDateInput(job.oa_deadline_date),
      location_raw: "",
      oa_status: normalizeOaStatus(job.oa_status),
      referral_status: String(job.referral_status ?? ""),
      keyword_matching: "Medium",
      notes: `Copied from ${friendName}${job.application_status ? ` (${job.application_status})` : ""}`.trim(),
    });
    setShowPrefillModal(true);
  }

  function onSelectFriendJob(
    friendDisplayName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
    },
  ) {
    openPrefillFromFriend(friendDisplayName, job);
  }

  async function onCreateFromPrefill(e: React.FormEvent) {
    e.preventDefault();
    if (!prefillForm.company.trim() || !prefillForm.role.trim()) return;
    try {
      setIsPrefillSaving(true);
      setPrefillError("");
      await createJob({
        company: prefillForm.company.trim(),
        role: prefillForm.role.trim(),
        date_saved: prefillForm.date_saved || getLocalISODate(),
        job_link: prefillForm.job_link.trim() || undefined,
        job_application_id: prefillForm.job_application_id.trim() || undefined,
        oa_deadline_date: prefillForm.oa_deadline_date || undefined,
        location_raw: prefillForm.location_raw.trim() || undefined,
        oa_status: prefillForm.oa_status || "No",
        referral_status: prefillForm.referral_status.trim() || undefined,
        keyword_matching: prefillForm.keyword_matching || "Medium",
        notes: prefillForm.notes.trim() || undefined,
        application_status: "Applied",
      });
      setShowPrefillModal(false);
      setSuccess("Application added from friend suggestion.");
    } catch (err) {
      setPrefillError((err as Error).message);
    } finally {
      setIsPrefillSaving(false);
    }
  }

  function initialsFromEmail(email: string): string {
    const local = (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9]+/g, " ").trim();
    if (!local) return "U";
    const parts = local.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0].slice(0, 2) || "U").toUpperCase();
  }

  function initialsFromNameOrEmail(name: string | undefined, email: string): string {
    const raw = String(name || "").trim();
    if (raw) {
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
      return (parts[0].slice(0, 2) || "U").toUpperCase();
    }
    return initialsFromEmail(email);
  }

  const insightCharts = useMemo(() => {
    const todayIso = getLocalISODate();
    const ranked = trendData
      .map((friend) => ({
        ...friend,
        total: friend.trend.reduce((sum, point) => sum + Number(point.total ?? 0), 0),
        avgPerDay: friend.trend.length ? friend.trend.reduce((sum, point) => sum + Number(point.total ?? 0), 0) / friend.trend.length : 0,
      }))
      .sort((a, b) => b.avgPerDay - a.avgPerDay);
    const selfEntry = ranked.find((entry) => entry.is_self);
    const others = ranked.filter((entry) => !entry.is_self);
    const selectedBase = selfEntry
      ? [selfEntry, ...others.slice(0, Math.max(0, MAX_NETWORK_TREND_FRIENDS - 1))]
      : others.slice(0, MAX_NETWORK_TREND_FRIENDS);
    const selected = selectedBase.map((friend, idx) => ({
      ...friend,
      key: `friend_${friend.friend_id}`,
      label: friend.is_self ? "You" : String(friend.friend_name || friend.friend_email),
      color: NETWORK_TREND_COLORS[idx % NETWORK_TREND_COLORS.length],
      initials: initialsFromNameOrEmail(friend.friend_name, friend.friend_email),
    }));
    const weekStart = weekStartIsoUtc(todayIso);
    const last7Days = Array.from({ length: 7 }, (_, i) => isoDayAddDays(weekStart, i));

    const todayRows = selected
      .map((friend) => ({
        key: friend.key,
        initials: friend.initials,
        label: friend.label,
        color: friend.color,
        total: Number(friend.trend.find((point) => point.day === todayIso)?.total ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const leaderCount = todayRows.length ? todayRows[0].total : 0;
    const todayAverage = todayRows.length ? todayRows.reduce((sum, row) => sum + row.total, 0) / todayRows.length : 0;
    const todayMax = todayRows.length ? todayRows[0].total : 0;
    const leaders = leaderCount > 0 ? todayRows.filter((row) => row.total === leaderCount) : [];
    const isTieLeader = leaders.length > 1;
    const hasSingleLeader = leaders.length === 1;
    const todayRowsWithLeader = todayRows.map((row) => ({
      ...row,
      isLeader: leaderCount > 0 && row.total === leaderCount,
      deltaFromAvg: row.total - todayAverage,
    }));

    const dayWinnerCount = new Map<string, number>();
    last7Days.forEach((day) => {
      const values = selected.map((friend) => Number(friend.trend.find((p) => p.day === day)?.total ?? 0));
      const maxValue = values.reduce((m, v) => Math.max(m, v), 0);
      if (maxValue <= 0) return;
      selected.forEach((friend) => {
        const value = Number(friend.trend.find((p) => p.day === day)?.total ?? 0);
        if (value === maxValue) {
          dayWinnerCount.set(friend.key, (dayWinnerCount.get(friend.key) ?? 0) + 1);
        }
      });
    });

    const weeklyLeaderboardRows = selected
      .map((friend) => {
        const displayName = formatFirstNameLastInitial(String(friend.label || ""));
        const dayValues = last7Days.map((day) => Number(friend.trend.find((p) => p.day === day)?.total ?? 0));
        const total = dayValues.reduce((sum, value) => sum + value, 0);
        const peak = dayValues.reduce((m, v) => Math.max(m, v), 0);
        const rawWins = dayWinnerCount.get(friend.key) ?? 0;
        const safeDailyWins = Math.max(0, Math.min(7, Number(rawWins || 0)));
        return {
          key: friend.key,
          label: friend.label,
          displayName,
          isSelf: Boolean(friend.is_self),
          dayValues,
          peak,
          total,
          dailyWins: safeDailyWins,
        };
      })
      .sort((a, b) => b.total - a.total);
    const leaderTotal7d = weeklyLeaderboardRows.length ? weeklyLeaderboardRows[0].total : 0;
    const weeklyLeaderboard = weeklyLeaderboardRows.map((row, index) => ({
      ...row,
      rank: index + 1,
      isLeader: index === 0,
      isSecond: index === 1,
      isThird: index === 2,
      behindLeader: Math.max(0, leaderTotal7d - row.total),
      lineColor: WEEKLY_LINE_PALETTE[index % WEEKLY_LINE_PALETTE.length],
    }));
    const selfWeekly = weeklyLeaderboard.find((row) => row.isSelf);
    const leaderWeekly = weeklyLeaderboard[0];
    const weeklyShadeKeys = [
      ...(selfWeekly ? [selfWeekly.key] : []),
      ...(leaderWeekly && leaderWeekly.key !== selfWeekly?.key ? [leaderWeekly.key] : []),
    ];
    const weeklyColorByKey = new Map(weeklyLeaderboard.map((row) => [row.key, row.lineColor]));
    const todayRowsAligned = todayRowsWithLeader.map((row) => ({
      ...row,
      color: weeklyColorByKey.get(row.key) ?? row.color,
    }));
    const weeklyDailyRows = last7Days.map((day, dayIndex) => {
      const row: Record<string, string | number> = { day, label: formatWeekdayShort(day) };
      weeklyLeaderboard.forEach((friend) => {
        row[friend.key] = Number(friend.dayValues[dayIndex] ?? 0);
      });
      return row;
    });
    const weeklySeriesRows: Array<Record<string, string | number>> = [
      {
        day: "__start__",
        label: "0",
        ...Object.fromEntries(weeklyLeaderboard.map((friend) => [friend.key, 0])),
      },
      ...weeklyDailyRows,
    ];
    const todayDow = utcDateFromIsoDay(todayIso)?.getUTCDay() ?? 1; // default Monday
    const todayWeekIndex = Math.max(0, Math.min(6, (todayDow + 6) % 7));
    const passedDayLabels = weeklyDailyRows.slice(0, todayWeekIndex + 1).map((row) => String(row.label ?? ""));
    const historicalDots = weeklyDailyRows
      .slice(0, todayWeekIndex + 1)
      .flatMap((row) =>
        weeklyLeaderboard.map((friend) => ({
          dayLabel: String(row.label ?? ""),
          y: Number(row[friend.key] ?? 0),
          color: friend.lineColor,
          key: `${friend.key}-${String(row.day ?? row.label ?? "")}`,
        })),
      );
    const weeklyEndLabels = (() => {
      if (!weeklyDailyRows.length) return [] as Array<{ key: string; label: string; shortLabel: string; lineColor: string; y: number; dy: number; isLeader: boolean; dayValue: number }>;
      const last = weeklyDailyRows[weeklyDailyRows.length - 1] as Record<string, string | number>;
      const rows = weeklyLeaderboard
        .map((friend) => ({
          key: friend.key,
          label: friend.label,
          shortLabel: formatFirstNameLastInitial(String(friend.label || "")),
          lineColor: friend.lineColor,
          isLeader: friend.isLeader,
          dayValue: Number(last[friend.key] ?? 0),
          y: Number(last[friend.key] ?? 0),
          dy: -10,
        }))
        .sort((a, b) => b.y - a.y);
      const closeThreshold = 7;
      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1];
        const curr = rows[i];
        if (Math.abs(prev.y - curr.y) <= closeThreshold) {
          // Only nudge labels when two lines are truly close; otherwise keep default placement.
          if (prev.dy === -10) prev.dy = -15;
          curr.dy = -5;
        }
      }
      return rows.filter((row) => row.dayValue > 0);
    })();

    return {
      selected,
      todayRows: todayRowsAligned,
      todayLeader: {
        leaderCount,
        names: leaders.map((row) => row.label),
        hasSingleLeader,
        isTieLeader,
      },
      todayStats: {
        average: todayAverage,
        max: todayMax,
      },
      weeklyLeaderboard,
      weeklyShadeKeys,
      weeklyDailyRows,
      weeklySeriesRows,
      weeklyEndLabels,
      passedDayLabels,
      historicalDots,
    };
  }, [trendData]);
  const tickerFacts = useMemo(() => {
    return buildNetworkTickerFacts({
      todayRows: insightCharts.todayRows.map((row) => ({
        label: row.label,
        total: row.total,
      })),
      weeklyLeaderboard: insightCharts.weeklyLeaderboard.map((row) => ({
        displayName: row.displayName,
        total: row.total,
        dailyWins: row.dailyWins,
        dayValues: row.dayValues,
      })),
    });
  }, [insightCharts]);
  const tickerFactsLoop = useMemo(() => {
    const base = tickerFacts.length ? tickerFacts : [{ text: "Weekly leaderboard update", tone: "blue" as const }];
    const expanded: Array<{ text: string; tone: "gold" | "blue" }> = [];
    while (expanded.map((f) => f.text).join(" • ").length < 360) {
      expanded.push(...base);
    }
    return expanded;
  }, [tickerFacts]);

  const todayWithJobs = useMemo(() => {
    const rows = todayData.filter((f) => (f.jobs?.length ?? 0) > 0);
    const latestTs = (friend: {
      jobs: Array<{ date_saved: string | null; id: number }>;
    }) => {
      return friend.jobs.reduce((max, job) => {
        const ts = Date.parse(String(job.date_saved ?? ""));
        if (Number.isNaN(ts)) return max;
        return Math.max(max, ts);
      }, 0);
    };
    rows.sort((a, b) => {
      const lastDiff = latestTs(b) - latestTs(a);
      if (lastDiff !== 0) return lastDiff;
      const diff = (b.jobs?.length ?? 0) - (a.jobs?.length ?? 0);
      if (diff !== 0) return diff;
      const an = String(a.friend_name || a.friend_email || "").toLowerCase();
      const bn = String(b.friend_name || b.friend_email || "").toLowerCase();
      return an.localeCompare(bn);
    });
    return rows;
  }, [todayData]);
  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      {success ? (
        <div className="network-success-banner" role="status" aria-live="polite">
          <span>{success}</span>
          <button type="button" className="network-success-close" aria-label="Dismiss message" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      ) : null}

      <div className="network-stack">
      <div className="network-ticker-overlay network-ticker-overlay--above" aria-label="Network updates ticker">
        <div className="network-ticker-track">
          <div className="network-ticker-tag">LEADERBOARD</div>
          <div className="network-ticker-marquee-wrap">
            <div className="network-ticker-marquee">
              <div className="network-ticker-group">
                {tickerFactsLoop.map((fact, idx) => (
                  <span className={`network-ticker-item network-ticker-item--${fact.tone}`} key={`ticker-item-${idx}`}>
                    <span className="network-ticker-emoji" aria-hidden="true">
                      {emojiForTickerFact(fact.text)}
                    </span>
                    {fact.text.includes(":") ? (
                      <>
                        <strong className="network-ticker-label">{fact.text.split(":")[0]}:</strong>
                        <span className="network-ticker-value">{fact.text.slice(fact.text.indexOf(":") + 1).trim()}</span>
                      </>
                    ) : (
                      <span className="network-ticker-value">{fact.text}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="network-add-friends-btn" onClick={openFriendManager}>
          + Add Friends
        </button>
      </div>
      <section>
        <div className={`card network-shell-card ${insightsOpen ? "is-open" : "is-closed"}`}>
          <button type="button" className="network-main-head" onClick={() => setInsightsOpen((p) => !p)}>
            <h2>Network Insights</h2>
            <div className="network-main-right">
              <span className="pending-meta">Today + Weekly</span>
              <span className={`network-section-arrow ${insightsOpen ? "open" : ""}`}>▴</span>
            </div>
          </button>

          {!insightsOpen ? null : isLoading ? (
            <Spinner />
          ) : (
            <div className="network-card-content">
              {insightCharts.selected.length === 0 ? (
                <div className="empty-state">No accepted friends yet. Add friends to see trend insights.</div>
              ) : (
                <div className="network-combined-card">
                  <div className="network-trend-grid network-insights-grid">
                    <div className="network-trend-card network-insight-card network-weekly-card">
                      <div className="chart-header network-insight-card-head">
                        <div className="chart-title-group">
                          <h2>Today&apos;s Application Count</h2>
                        </div>
                      </div>
                      <div className="network-mini-chart network-split-chart">
                        <div className="network-chart-stage">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={insightCharts.todayRows} margin={{ top: 16, right: 14, left: 2, bottom: 4 }} barCategoryGap="18%">
                              <defs>
                                {insightCharts.todayRows.map((row) => {
                                  const gradId = todayBarGradientId(row.key);
                                  return (
                                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.96 : 0.86)} />
                                      <stop offset="100%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.74 : 0.45)} />
                                    </linearGradient>
                                  );
                                })}
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={NETWORK_CHART_THEME.grid} vertical={false} />
                              <XAxis
                                dataKey="label"
                                stroke={NETWORK_CHART_THEME.axis}
                                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 12, fontWeight: 500 }}
                                axisLine={{ stroke: NETWORK_CHART_THEME.axis, strokeWidth: 1 }}
                                tickLine={false}
                                interval={0}
                                height={28}
                                padding={{ left: 6, right: 6 }}
                                tickFormatter={(value) => formatFirstNameLastInitial(String(value ?? ""))}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={NETWORK_CHART_THEME.axis}
                                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 10, fontWeight: 400 }}
                                tickLine={false}
                                axisLine={false}
                                width={34}
                                domain={[0, (dataMax: number) => Math.max(4, Math.ceil(Number(dataMax || 0) * 1.18 + 1))]}
                              />
                              {insightCharts.todayStats.average > 0 ? (
                                <ReferenceLine
                                  y={insightCharts.todayStats.average}
                                  stroke={NETWORK_CHART_THEME.accentSoft}
                                  strokeDasharray="5 5"
                                  strokeWidth={1.2}
                                  ifOverflow="extendDomain"
                                  label={(props: { viewBox?: { x?: number; y?: number; width?: number } }) => {
                                    const x = Number(props.viewBox?.x ?? 0) + Number(props.viewBox?.width ?? 0) / 2;
                                    const y = Number(props.viewBox?.y ?? 0) - 6;
                                    return (
                                      <text x={x} y={y} textAnchor="middle" fill={NETWORK_CHART_THEME.accentSoft} fontSize={11} fontWeight={700}>
                                        {`Avg ${insightCharts.todayStats.average.toFixed(1)}`}
                                      </text>
                                    );
                                  }}
                                />
                              ) : null}
                              <Tooltip content={<NetworkInsightBarTooltip metricLabel="Applications today" />} cursor={false} />
                              <Bar
                                dataKey="total"
                                fillOpacity={0.96}
                                radius={[8, 8, 0, 0]}
                                maxBarSize={56}
                                activeBar={false}
                              >
                                <LabelList
                                  dataKey="total"
                                  content={(props: {
                                    x?: number;
                                    y?: number;
                                    width?: number;
                                    value?: number | string;
                                    payload?: { isLeader?: boolean; color?: string };
                                  }) => {
                                    const x = Number(props.x ?? 0);
                                    const y = Number(props.y ?? 0);
                                    const width = Number(props.width ?? 0);
                                    const value = Number(props.value ?? 0);
                                    const isLeader = Boolean(props.payload?.isLeader);
                                    const payloadColor = String(props.payload?.color ?? "#2563eb");
                                    if (!(value > 0) || width <= 0) return null;
                                    const centerX = x + width / 2;
                                    const valueColor = isLeader ? payloadColor : rgbaFromHex(payloadColor, 0.9);
                                    return (
                                      <g>
                                        {insightCharts.todayLeader.hasSingleLeader && isLeader ? (
                                          <text x={centerX} y={y - 22} textAnchor="middle" fill={payloadColor} fontSize={14}>
                                            {"\u{1F451}"}
                                          </text>
                                        ) : null}
                                        <text
                                          x={centerX}
                                          y={y - 6}
                                          textAnchor="middle"
                                          fill={valueColor}
                                          fontSize={14}
                                          fontWeight={700}
                                        >
                                          {String(value)}
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                                {insightCharts.todayRows.map((row) => (
                                  <Cell
                                    key={`today-${row.key}`}
                                    fill={`url(#${todayBarGradientId(row.key)})`}
                                    fillOpacity={1}
                                    stroke={row.total > 0 ? (row.isLeader ? "rgba(255,255,255,0.62)" : rgbaFromHex(row.color, 0.56)) : "rgba(255,255,255,0.12)"}
                                    strokeWidth={row.isLeader ? 1.5 : 1}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="network-trend-card network-insight-card">
                      <div className="chart-header network-insight-card-head">
                        <div className="chart-title-group">
                          <h2>Last 7 Days by Friend</h2>
                        </div>
                      </div>
                      <div className="network-weekly-line-layout">
                        <div className="network-weekly-line-stage network-chart-stage">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={insightCharts.weeklySeriesRows} margin={{ top: 24, right: 22, left: 0, bottom: 2 }}>
                              <defs>
                                {insightCharts.weeklyShadeKeys.map((key) => {
                                  const row = insightCharts.weeklyLeaderboard.find((friend) => friend.key === key);
                                  if (!row) return null;
                                  const gradId = weeklyShadeGradientId(row.key);
                                  return (
                                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={rgbaFromHex(row.lineColor, row.isSelf ? 0.72 : 0.62)} />
                                      <stop offset="45%" stopColor={rgbaFromHex(row.lineColor, row.isSelf ? 0.36 : 0.3)} />
                                      <stop offset="100%" stopColor={rgbaFromHex(row.lineColor, 0.08)} />
                                    </linearGradient>
                                  );
                                })}
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={NETWORK_CHART_THEME.grid} vertical={false} />
                              <XAxis
                                dataKey="label"
                                stroke={NETWORK_CHART_THEME.axis}
                                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 10, fontWeight: 400 }}
                                axisLine={{ stroke: NETWORK_CHART_THEME.axis, strokeWidth: 1 }}
                                tickLine={false}
                                interval={0}
                                height={24}
                                padding={{ left: 0, right: 18 }}
                                tickFormatter={(value) => (String(value) === "" ? "" : String(value))}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={NETWORK_CHART_THEME.axis}
                                tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 11, fontWeight: 400 }}
                                tickLine={false}
                                axisLine={false}
                                width={34}
                                domain={[0, (dataMax: number) => Math.max(8, Math.ceil(Number(dataMax || 0) + 4))]}
                              />
                              {insightCharts.passedDayLabels.map((label) => (
                                <ReferenceLine
                                  key={`passed-day-${label}`}
                                  x={label}
                                  stroke={NETWORK_CHART_THEME.grid}
                                  strokeDasharray="2 4"
                                  strokeWidth={1}
                                />
                              ))}
                              <Tooltip content={<NetworkWeeklyTooltip />} cursor={false} />
                              {insightCharts.weeklyShadeKeys.map((key) => {
                                const row = insightCharts.weeklyLeaderboard.find((friend) => friend.key === key);
                                if (!row) return null;
                                return (
                                  <Area
                                    key={`shade-${row.key}`}
                                    type="monotone"
                                    dataKey={row.key}
                                    stroke="none"
                                    fill={`url(#${weeklyShadeGradientId(row.key)})`}
                                    fillOpacity={row.isSelf ? 0.22 : 0.16}
                                    baseValue={0}
                                    isAnimationActive={false}
                                  />
                                );
                              })}
                              {insightCharts.weeklyLeaderboard.map((friend) => (
                                <Line
                                  key={`line-${friend.key}`}
                                  type="monotone"
                                  dataKey={friend.key}
                                  name={friend.label}
                                  stroke={friend.lineColor}
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={false}
                                  isAnimationActive
                                />
                              ))}
                              {insightCharts.historicalDots.map((dot) => (
                                <ReferenceDot
                                  key={`hist-dot-${dot.key}`}
                                  x={dot.dayLabel}
                                  y={dot.y}
                                  r={2.5}
                                  fill={dot.color}
                                  stroke="color-mix(in srgb, var(--bg-base) 70%, transparent)"
                                  strokeWidth={1}
                                />
                              ))}
                              {insightCharts.weeklyDailyRows.length > 0
                                ? (() => {
                                    const last = insightCharts.weeklyDailyRows[insightCharts.weeklyDailyRows.length - 1] as Record<string, string | number>;
                                    const lastLabel = String(last.label ?? "");
                                    return insightCharts.weeklyEndLabels.map((row) => (
                                      <ReferenceDot
                                        key={`end-${row.key}`}
                                        x={lastLabel}
                                        y={row.y}
                                        r={0}
                                        ifOverflow="extendDomain"
                                        label={(props: { x?: number; y?: number; viewBox?: { x?: number; y?: number } }) => {
                                          const px = Number(props.viewBox?.x ?? props.x ?? 0);
                                          const py = Number(props.viewBox?.y ?? props.y ?? 0) + row.dy;
                                          const text = `${row.shortLabel} ${row.dayValue}`;
                                          const x = px - 10;
                                          return (
                                            <g>
                                              <text
                                                x={x}
                                                y={py + 3}
                                                textAnchor="end"
                                                fill={row.lineColor}
                                                fontSize={10}
                                                fontWeight={row.isLeader ? 700 : 600}
                                              >
                                                {text}
                                              </text>
                                            </g>
                                          );
                                        }}
                                      />
                                    ));
                                  })()
                                : null}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="network-trend-card network-insight-card network-weekly-mini-board">
                      <div className="chart-header network-insight-card-head">
                        <div className="chart-title-group">
                          <h2>Weekly Board</h2>
                        </div>
                      </div>
                      {insightCharts.weeklyLeaderboard.length ? (
                        <div className="network-board-mascot">
                          <div className="network-board-mascot-avatar" aria-hidden="true">
                            {insightCharts.weeklyLeaderboard[0].displayName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="network-board-mascot-copy">
                            <p className="network-board-mascot-title">Current Champion</p>
                            <p className="network-board-mascot-name">
                              {insightCharts.weeklyLeaderboard[0].displayName} · {insightCharts.weeklyLeaderboard[0].total}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div className="network-mini-board-list">
                        {insightCharts.weeklyLeaderboard.map((row) => (
                          <div key={`mini-board-${row.key}`} className={`network-mini-board-row${row.isLeader ? " is-leader" : ""}`}>
                            <span className="network-mini-board-rank">{row.rank}</span>
                            <span className="network-mini-board-name">{row.displayName}</span>
                            <strong className="network-mini-board-total">{row.total}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <TargetSignalsCarousel
                    todayData={todayData}
                    useDemoFallback={useTargetDemoFallback}
                    onAddApplication={({ friendName, job }) => onSelectFriendJob(friendName, job)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className={`card network-shell-card ${todayOpen ? "is-open" : "is-closed"}`}>
          <button type="button" className="network-main-head" onClick={() => setTodayOpen((p) => !p)}>
            <h2>Today&apos;s Applications</h2>
            <div className="network-main-right">
              <span className="pending-meta">Friends with activity today</span>
                <span className={`network-section-arrow ${todayOpen ? "open" : ""}`}>▴</span>
            </div>
          </button>

          {!todayOpen ? null : isLoading ? (
            <Spinner />
          ) : (
            <div className="network-card-content">
              {todayWithJobs.length === 0 ? (
                <div className="empty-state">No friend applications recorded today.</div>
              ) : (
                <div className="network-today-grid">
                  {todayWithJobs.map((friend) => (
                    <div key={String(friend.friend_id)} className="network-today-card network-today-item">
                      <div className="network-today-summary">
                        <strong>{String(friend.friend_name || friend.friend_email)}</strong>
                        <span className="network-today-summary-right">
                          <span className="pending-meta">{friend.jobs.length} today</span>
                        </span>
                      </div>
                      <div className="table-wrap">
                        <table className="network-today-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Company / Position</th>
                              <th>Date</th>
                              <th>OA</th>
                              <th>OA Deadline</th>
                              <th>Job/App ID</th>
                              <th>Link</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {friend.jobs.map((job, idx) => (
                              <tr
                                key={String(job.id)}
                                className="network-job-row"
                                onClick={() =>
                                  onSelectFriendJob(String(friend.friend_name || friend.friend_email), {
                                    company: job.company ?? null,
                                    role: job.role ?? null,
                                    date_saved: job.date_saved ?? null,
                                    job_link: job.job_link ?? null,
                                    job_application_id: job.job_application_id ?? null,
                                    oa_deadline_date: job.oa_deadline_date ?? null,
                                    oa_status: job.oa_status ?? null,
                                    referral_status: job.referral_status ?? null,
                                    application_status: job.application_status ?? null,
                                  })
                                }
                              >
                                <td className="network-cell-index">{idx + 1}</td>
                                <td className="network-cell-company-role">
                                  <div className="job-main">
                                    <div className="job-company" title={String(job.company ?? "—")}>
                                      {String(job.company ?? "—")}
                                    </div>
                                    <div className="job-role" title={String(job.role ?? "—")}>
                                      {String(job.role ?? "—")}
                                    </div>
                                  </div>
                                </td>
                                <td className="network-cell-date">{formatTableDateTime(job.date_saved)}</td>
                                <td>{normalizeOaStatus(job.oa_status)}</td>
                                <td>{String(job.oa_deadline_date ?? "-") || "-"}</td>
                                <td>{String(job.job_application_id ?? "-") || "-"}</td>
                                <td>
                                  {job.job_link ? (
                                    <a
                                      href={String(job.job_link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="network-link-chip"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Open
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="action-btn network-add-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectFriendJob(String(friend.friend_name || friend.friend_email), {
                                        company: job.company ?? null,
                                        role: job.role ?? null,
                                        date_saved: job.date_saved ?? null,
                                        job_link: job.job_link ?? null,
                                        job_application_id: job.job_application_id ?? null,
                                        oa_deadline_date: job.oa_deadline_date ?? null,
                                        oa_status: job.oa_status ?? null,
                                        referral_status: job.referral_status ?? null,
                                        application_status: job.application_status ?? null,
                                      });
                                    }}
                                  >
                                    Add Application
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      </div>

      {showPrefillModal ? (
        <div className="modal-overlay" onClick={() => !isPrefillSaving && setShowPrefillModal(false)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <h3>Add Application</h3>
            <p className="modal-subtitle">Prefilled from {prefillFromName}. Edit anything before saving.</p>
            {prefillError ? <div className="auth-error">{prefillError}</div> : null}
            <form className="form form--quickadd" onSubmit={onCreateFromPrefill}>
              <div className="qa-left">
                <input
                  placeholder="Position *"
                  value={prefillForm.role}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, role: e.target.value }))}
                  autoFocus
                />
                <div className="form-row">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={prefillForm.date_saved}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, date_saved: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={prefillForm.location_raw}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, location_raw: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral</label>
                  <select
                    value={prefillForm.referral_status}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, referral_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">—</option>
                    <option value="Requested">Requested</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={prefillForm.notes}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  placeholder="Company *"
                  value={prefillForm.company}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, company: e.target.value }))}
                />
                <input
                  placeholder="Job link (URL)"
                  type="url"
                  value={prefillForm.job_link}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, job_link: e.target.value }))}
                />
                <input
                  placeholder="Job/Application ID (optional)"
                  value={prefillForm.job_application_id}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, job_application_id: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">OA Deadline (optional)</label>
                  <input
                    type="date"
                    value={prefillForm.oa_deadline_date}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Online Assessment (OA)</label>
                  <select
                    value={prefillForm.oa_status}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, oa_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    value={prefillForm.keyword_matching}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isPrefillSaving && setShowPrefillModal(false)} disabled={isPrefillSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isPrefillSaving || !prefillForm.company.trim() || !prefillForm.role.trim()}>
                  {isPrefillSaving ? "Saving..." : "Add Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
