import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Spinner from "../components/Spinner";
import ManageSharedFieldsModal from "../components/network/ManageSharedFieldsModal";
import TargetSignalsCarousel from "../components/network/TargetSignalsCarousel";
import WeeklyCompetitionChart from "../components/network/WeeklyCompetitionChart";
import { BADGES, BADGE_CATEGORY_LABEL, BADGE_TIERS, type BadgeCategory } from "../constants/badges";
import {
  createJob,
  getNetworkFieldVisibility,
  getNetworkToday,
  getNetworkTrend,
  getTargetProgress,
  updateNetworkFieldVisibility,
  type NetworkFieldVisibility,
  type NetworkTodayFriend,
  type NetworkTrendFriend,
  type TargetProgress,
} from "../lib/api";
import { formatTableDateTime, getLocalISODate } from "../lib/formatDate";
import { buildNetworkTickerFacts } from "../lib/networkTicker";
import {
  ANALYTICS_EVENTS,
  trackErrorEvent,
  trackFeatureEvent,
  trackFunnelStep,
  trackLifecycleMilestone,
  trackProductEvent,
} from "../analytics/events";
import { getEarnedBadgeIds, getEarnedBadges } from "../lib/badgeLogic";

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
const MAX_NETWORK_BOARD_ENTRIES = 11; // You + up to 10 friends
const MAX_NETWORK_TODAY_BARS = 5;
const NETWORK_CHART_THEME = {
  grid: "var(--network-chart-grid, var(--chart-grid))",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  tooltipShadow: "var(--chart-tooltip-shadow)",
  axis: "var(--chart-axis)",
  textSecondary: "var(--chart-text-secondary)",
  textPrimary: "var(--chart-text)",
  accentSoft: "var(--accent-soft)",
  accentDim: "var(--accent-dim)",
  textMain: "var(--chart-text)",
};
const WEEKLY_LINE_PALETTE = [
  ENTERPRISE_CHART_COLORS[0],
  ENTERPRISE_CHART_COLORS[1],
  ENTERPRISE_CHART_COLORS[2],
  ENTERPRISE_CHART_COLORS[3],
  ENTERPRISE_CHART_COLORS[4],
];

const REQUIRED_VISIBILITY_KEYS: Array<keyof NetworkFieldVisibility> = [
  "share_company",
  "share_role",
  "share_applied_at",
  "share_job_application_id",
];

const NETWORK_VISIBILITY_FIELDS: Array<{ key: keyof NetworkFieldVisibility; label: string }> = [
  { key: "share_company", label: "Company" },
  { key: "share_role", label: "Role" },
  { key: "share_applied_at", label: "Applied Date" },
  { key: "share_oa_status", label: "OA Status" },
  { key: "share_oa_deadline", label: "OA Deadline" },
  { key: "share_referral_used", label: "Referral Used" },
  { key: "share_notes", label: "Notes" },
  { key: "share_job_application_id", label: "Job/Application ID" },
];

const OPTIONAL_SHARE_KEYS: Array<keyof NetworkFieldVisibility> = [
  "share_oa_status",
  "share_oa_deadline",
  "share_referral_used",
  "share_notes",
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
        applied_at: ts,
        application_status: "Applied",
        referral_status: j % 2 === 0 ? "Requested" : "No",
        oa_status: "No",
        oa_deadline_date: null,
        job_application_id: "-",
        job_link: `https://careers.example.com/${encodeURIComponent(company.toLowerCase())}/${(idx + j + 100).toString(36)}`,
        notes: null,
        can_view_company: true,
        can_view_role: true,
        can_view_applied_at: true,
        can_view_oa_status: true,
        can_view_oa_deadline: true,
        can_view_referral_used: true,
        can_view_notes: false,
      };
    });
    return {
      ...friend,
      jobs: [...existing, ...extraJobs],
    };
  });

  return { trend, today };
}

const networkLineGradientId = (key: string) => `networkLineGrad-${key}`;

export const renderNetworkLineGradients = (keys: string[]) => {
  if (keys.length === 0) return null;
  return `
    ${keys
      .map(
        (k) => `
      <linearGradient id="${weeklyShadeGradientId(k)}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${k === "self" ? "var(--accent)" : "var(--accent-soft)"}" stop-opacity="0.18" />
        <stop offset="100%" stop-color="${k === "self" ? "var(--accent)" : "var(--accent-soft)"}" stop-opacity="0" />
      </linearGradient>
    `
      )
      .join("")}
  `;
};

export default function NetworkPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const useTargetDemoFallback = params?.get("demoTargets") === "1" || params?.get("demoNetwork") === "1";
  const useNetworkDemoAugment = params?.get("demoNetwork") === "1";
  const [trendData, setTrendData] = useState<NetworkTrendFriend[]>([]);
  const [todayData, setTodayData] = useState<NetworkTodayFriend[]>([]);
  const [targetProgress, setTargetProgress] = useState<TargetProgress | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [isPrefillSaving, setIsPrefillSaving] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [prefillFromName, setPrefillFromName] = useState("");
  const [showFieldVisibilityModal, setShowFieldVisibilityModal] = useState(false);
  const [isSavingFieldVisibility, setIsSavingFieldVisibility] = useState(false);
  const [fieldVisibilityError, setFieldVisibilityError] = useState("");
  const [selectedWeeklyCompareKey, setSelectedWeeklyCompareKey] = useState("");
  const [showBadgeGallery, setShowBadgeGallery] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState<NetworkFieldVisibility>({
    share_company: true,
    share_role: true,
    share_applied_at: true,
    share_oa_status: true,
    share_oa_deadline: true,
    share_referral_used: true,
    share_notes: false,
    share_job_application_id: true,
  });
  const [requiredVisibilityFields, setRequiredVisibilityFields] = useState<Array<keyof NetworkFieldVisibility>>(
    REQUIRED_VISIBILITY_KEYS,
  );
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
      const [trendRes, todayRes, visibilityRes, targetRes] = await Promise.all([
        getNetworkTrend(10),
        getNetworkToday(),
        getNetworkFieldVisibility(),
        getTargetProgress().catch(() => null),
      ]);
      const augmented = useNetworkDemoAugment
        ? augmentDemoNetworkData(trendRes.data ?? [], todayRes.data ?? [])
        : { trend: trendRes.data ?? [], today: todayRes.data ?? [] };
      setTrendData(augmented.trend);
      setTodayData(augmented.today);
      if (visibilityRes?.data) {
        setFieldVisibility(visibilityRes.data);
      }
      if (visibilityRes?.required_fields?.length) {
        const fromApi = visibilityRes.required_fields.filter((field): field is keyof NetworkFieldVisibility =>
          NETWORK_VISIBILITY_FIELDS.some((item) => item.key === field),
        );
        setRequiredVisibilityFields([...new Set([...REQUIRED_VISIBILITY_KEYS, ...fromApi])]);
      }
      setTargetProgress(targetRes);
    } catch (e) {
      setError((e as Error).message);
      setTrendData([]);
      setTodayData([]);
      setTargetProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, [useNetworkDemoAugment]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [load]);

  function openFriendManager() {
    window.dispatchEvent(new CustomEvent("open-friend-manager"));
  }

  function openFieldVisibilityManager() {
    trackProductEvent(ANALYTICS_EVENTS.privacy_settings_opened, {
      source: "network_page",
    });
    setFieldVisibilityError("");
    setShowFieldVisibilityModal(true);
  }

  function setVisibilityValue(key: keyof NetworkFieldVisibility, value: boolean) {
    if (requiredVisibilityFields.includes(key)) return;
    setFieldVisibility((prev) => ({ ...prev, [key]: value }));
  }

  async function saveFieldVisibility() {
    const enabledBefore = OPTIONAL_SHARE_KEYS.filter((key) => Boolean(fieldVisibility[key])).length;
    try {
      setIsSavingFieldVisibility(true);
      setFieldVisibilityError("");
      const res = await updateNetworkFieldVisibility(fieldVisibility);
      const nextVisibility = res?.data ?? fieldVisibility;
      if (res?.data) setFieldVisibility(res.data);
      if (res?.required_fields?.length) {
        const fromApi = res.required_fields.filter((field): field is keyof NetworkFieldVisibility =>
          NETWORK_VISIBILITY_FIELDS.some((item) => item.key === field),
        );
        setRequiredVisibilityFields([...new Set([...REQUIRED_VISIBILITY_KEYS, ...fromApi])]);
      }
      const enabledAfter = OPTIONAL_SHARE_KEYS.filter((key) => Boolean(nextVisibility[key])).length;
      if (enabledAfter > enabledBefore) {
        trackProductEvent(ANALYTICS_EVENTS.share_data_enabled, {
          source: "network_privacy_settings",
          optional_fields_enabled: enabledAfter,
        });
        trackFunnelStep(ANALYTICS_EVENTS.share_data_enabled, {
          source: "network_privacy_settings",
        });
        trackLifecycleMilestone(ANALYTICS_EVENTS.first_share_enabled, {
          source: "network_privacy_settings",
          optional_fields_enabled: enabledAfter,
        });
      } else if (enabledAfter < enabledBefore) {
        trackProductEvent(ANALYTICS_EVENTS.share_data_disabled, {
          source: "network_privacy_settings",
          optional_fields_enabled: enabledAfter,
        });
      }
      trackFeatureEvent(ANALYTICS_EVENTS.filter_used, {
        source: "network_privacy_settings",
        filter_type: "shared_fields",
        enabled_count: enabledAfter,
      });
      setShowFieldVisibilityModal(false);
      await load();
      setSuccess("Shared fields updated.");
    } catch (e) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "network_shared_fields_modal",
        error_type: "save_failed",
      });
      setFieldVisibilityError((e as Error).message);
    } finally {
      setIsSavingFieldVisibility(false);
    }
  }

  function openPrefillFromFriend(
    friendName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      applied_at: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
      notes?: string | null;
    },
  ) {
    setPrefillFromName(friendName);
    setPrefillError("");
    setPrefillForm({
      company: String(job.company ?? ""),
      role: String(job.role ?? ""),
      date_saved: toDateInput(job.applied_at ?? job.date_saved),
      job_link: String(job.job_link ?? ""),
      job_application_id: String(job.job_application_id ?? ""),
      oa_deadline_date: toDateInput(job.oa_deadline_date),
      location_raw: "",
      oa_status: normalizeOaStatus(job.oa_status),
      referral_status: String(job.referral_status ?? ""),
      keyword_matching: "Medium",
      notes: String(job.notes ?? `Copied from ${friendName}${job.application_status ? ` (${job.application_status})` : ""}`).trim(),
    });
    setShowPrefillModal(true);
  }

  function onSelectFriendJob(
    friendDisplayName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      applied_at: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
      notes?: string | null;
    },
  ) {
    openPrefillFromFriend(friendDisplayName, job);
  }

  async function onCreateFromPrefill(e: React.FormEvent) {
    e.preventDefault();
    if (!prefillForm.company.trim() || !prefillForm.role.trim()) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "network_prefill_form",
        error_type: "missing_required_field",
      });
      return;
    }
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
      trackProductEvent(ANALYTICS_EVENTS.application_created, {
        source: "network_prefill_modal",
        method: "friend_prefill",
      });
      trackLifecycleMilestone(ANALYTICS_EVENTS.first_application_created, {
        source: "network_prefill_modal",
      });
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "network_prefill_form",
        error_type: "prefill_submit_failed",
      });
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
    const boardBase = selfEntry ? [selfEntry, ...others] : others;
    const selected = boardBase.slice(0, MAX_NETWORK_BOARD_ENTRIES).map((friend, idx) => ({
      ...friend,
      key: `friend_${friend.friend_id}`,
      label: friend.is_self ? "You" : String(friend.friend_name || friend.friend_email),
      color: ENTERPRISE_CHART_COLORS[idx % ENTERPRISE_CHART_COLORS.length],
      initials: initialsFromNameOrEmail(friend.friend_name, friend.friend_email),
    }));
    const weekStart = weekStartIsoUtc(todayIso);
    const last7Days = Array.from({ length: 7 }, (_, i) => isoDayAddDays(weekStart, i));

    const todayRowsAll = selected
      .map((friend) => ({
        ...friend,
        total: Number(friend.trend.find((point) => point.day === todayIso)?.total ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
    const todayRowsActive = todayRowsAll.filter((row) => row.total > 0);
    const todayRowsBase = todayRowsActive.length ? todayRowsActive : todayRowsAll;
    const todayRows = todayRowsBase.slice(0, MAX_NETWORK_TODAY_BARS);

    const leaderCount = todayRowsAll.length ? todayRowsAll[0].total : 0;
    const todayAverage = todayRows.length ? todayRows.reduce((sum, row) => sum + row.total, 0) / todayRows.length : 0;
    const todayMax = todayRowsAll.length ? todayRowsAll[0].total : 0;
    const leaders = leaderCount > 0 ? todayRowsAll.filter((row) => row.total === leaderCount) : [];
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
    const previousWeekStart = isoDayAddDays(weekStart, -7);
    const previousWeekDays = Array.from({ length: 7 }, (_, i) => isoDayAddDays(previousWeekStart, i));
    const previousWeekLeaderboard = selected
      .map((friend) => {
        const total = previousWeekDays.reduce(
          (sum, day) => sum + Number(friend.trend.find((point) => point.day === day)?.total ?? 0),
          0,
        );
        return {
          key: friend.key,
          isSelf: Boolean(friend.is_self),
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const hasPreviousWeekData = previousWeekLeaderboard.some((row) => row.total > 0);
    const selfCurrentRank = weeklyLeaderboard.find((row) => row.isSelf)?.rank ?? null;
    const selfPreviousRank = hasPreviousWeekData
      ? (previousWeekLeaderboard.find((row) => row.isSelf)?.rank ?? null)
      : null;
    const selfRankChange =
      selfCurrentRank && selfPreviousRank
        ? selfPreviousRank - selfCurrentRank
        : null;
    const selfWeekly = weeklyLeaderboard.find((row) => row.isSelf) ?? null;
    const topOtherWeekly = weeklyLeaderboard.find((row) => !row.isSelf) ?? null;
    const weeklyTrendFriendsRaw =
      selfWeekly && topOtherWeekly
        ? [selfWeekly, topOtherWeekly]
        : weeklyLeaderboard.slice(0, Math.min(2, weeklyLeaderboard.length));
    const weeklyTrendFriends = weeklyTrendFriendsRaw.map((friend, idx) => ({
      ...friend,
      lineColor: idx === 0 ? ENTERPRISE_CHART_COLORS[0] : ENTERPRISE_CHART_COLORS[2],
    }));
    const weeklyShadeKeys = weeklyTrendFriends.map((friend) => friend.key);
    const weeklyColorByKey = new Map(weeklyLeaderboard.map((row) => [row.key, row.lineColor]));
    const todayRowsAligned = todayRowsWithLeader.map((row) => ({
      ...row,
      color: row.isLeader ? ENTERPRISE_CHART_COLORS[0] : weeklyColorByKey.get(row.key) ?? row.color,
    }));
    const weeklyDailyRows = last7Days.map((day, dayIndex) => {
      const row: Record<string, string | number> = { day, label: formatWeekdayShort(day) };
      weeklyTrendFriends.forEach((friend) => {
        row[friend.key] = Number(friend.dayValues[dayIndex] ?? 0);
      });
      return row;
    });
    const weeklySeriesRows: Array<Record<string, string | number>> = [
      {
        day: "__start__",
        label: "0",
        ...Object.fromEntries(weeklyTrendFriends.map((friend) => [friend.key, 0])),
      },
      ...weeklyDailyRows,
    ];
    const todayDow = utcDateFromIsoDay(todayIso)?.getUTCDay() ?? 1; // default Monday
    const todayWeekIndex = Math.max(0, Math.min(6, (todayDow + 6) % 7));
    const passedDayLabels = weeklyDailyRows.slice(0, todayWeekIndex).map((row) => String(row.label ?? ""));
    const historicalDots = weeklyDailyRows
      .slice(0, todayWeekIndex + 1)
      .flatMap((row) =>
        weeklyTrendFriends.map((friend) => ({
          dayLabel: String(row.label ?? ""),
          y: Number(row[friend.key] ?? 0),
          color: friend.lineColor,
          key: `${friend.key}-${String(row.day ?? row.label ?? "")}`,
        })),
      );
    const weeklyEndLabels = (() => {
      if (!weeklyDailyRows.length) return [] as Array<{ key: string; label: string; shortLabel: string; lineColor: string; y: number; dy: number; isLeader: boolean; dayValue: number; dayLabel: string }>;
      const rows = weeklyTrendFriends
        .map((friend) => {
          let lastPositiveIndex = -1;
          for (let idx = weeklyDailyRows.length - 1; idx >= 0; idx -= 1) {
            const value = Number((weeklyDailyRows[idx] as Record<string, string | number>)[friend.key] ?? 0);
            if (value > 0) {
              lastPositiveIndex = idx;
              break;
            }
          }
          if (lastPositiveIndex < 0) return null;
          const sourceRow = weeklyDailyRows[lastPositiveIndex] as Record<string, string | number>;
          const dayValue = Number(sourceRow[friend.key] ?? 0);
          return {
            key: friend.key,
            label: friend.label,
            shortLabel: formatFirstNameLastInitial(String(friend.label || "")),
            lineColor: friend.lineColor,
            isLeader: friend.isLeader,
            dayValue,
            y: dayValue,
            dayLabel: String(sourceRow.label ?? ""),
            dy: -10, // Default initial offset
          };
        })
        .filter((row): row is { key: string; label: string; shortLabel: string; lineColor: string; y: number; dy: number; isLeader: boolean; dayValue: number; dayLabel: string } => Boolean(row))
        .sort((a, b) => b.y - a.y);
      
      // Algorithm to spread out converging end-labels vertically
      const closeThreshold = 1.0; // Y-values distance to consider "overlapping"
      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1];
        const curr = rows[i];
        if (Math.abs(prev.y - curr.y) <= closeThreshold) {
          // If the current line's label overlaps with the previous (higher) one, push it down
          // and push the higher one up to create vertical separation
          if (prev.dy === -10) prev.dy = -16;
          curr.dy += 12;
        }
      }
      return rows;
    })();

    return {
      selected,
      todayRows: todayRowsAligned,
      todayRowsAll,
      todayLeader: {
        leaderCount,
        names: leaders.map((row) => row.label),
        hasSingleLeader: leaders.length === 1,
        isTieLeader: leaders.length > 1,
      },
      todayStats: {
        average: todayAverage,
        max: todayMax,
        total: todayRowsAll.reduce((sum, row) => sum + row.total, 0),
        hiddenCount: Math.max(0, todayRowsActive.length - todayRowsAligned.length),
        isUserLeader: todayRowsAll.some((row) => row.is_self && row.total === leaderCount && leaderCount > 0),
      },
      weeklyLeaderboard,
      weeklySelfRankSnapshot: {
        currentRank: selfCurrentRank,
        previousRank: selfPreviousRank,
        change: selfRankChange,
      },
      weeklyTrendFriends,
      weeklyComparatorLabel: weeklyTrendFriends.find((row) => !row.isSelf)?.displayName ?? "Top friend",
      weeklyShadeKeys,
      weeklyDailyRows,
      weeklySeriesRows,
      weeklyEndLabels,
      passedDayLabels,
      historicalDots,
    };
  }, [trendData]);

  const compareFriendOptions = useMemo(
    () =>
      insightCharts.weeklyLeaderboard
        .filter((row) => !row.isSelf)
        .map((row) => ({
          key: row.key,
          label: row.displayName,
          total: row.total,
        })),
    [insightCharts.weeklyLeaderboard],
  );
  const compareSelectWidthCh = useMemo(() => {
    const longestOptionLength = compareFriendOptions.reduce((maxLen, option) => {
      const text = `${option.label} · ${option.total}`;
      return Math.max(maxLen, text.length);
    }, 0);
    // Add room for caret and inner padding while clamping for very long names.
    return Math.max(12, Math.min(30, longestOptionLength + 2));
  }, [compareFriendOptions]);

  useEffect(() => {
    if (!compareFriendOptions.length) {
      if (selectedWeeklyCompareKey) setSelectedWeeklyCompareKey("");
      return;
    }
    const stillValid = compareFriendOptions.some((option) => option.key === selectedWeeklyCompareKey);
    if (!stillValid) {
      setSelectedWeeklyCompareKey(compareFriendOptions[0].key);
    }
  }, [compareFriendOptions, selectedWeeklyCompareKey]);

  const weeklyCompetition = useMemo(() => {
    const labels = insightCharts.weeklyDailyRows.map((row) => String(row.label ?? ""));
    if (!labels.length) return null;

    const you = insightCharts.weeklyLeaderboard.find((friend) => friend.isSelf) ?? insightCharts.weeklyLeaderboard[0];
    const fallbackFriend = insightCharts.weeklyLeaderboard.find((friend) => !friend.isSelf) ?? null;
    const selectedFriend =
      insightCharts.weeklyLeaderboard.find((friend) => friend.key === selectedWeeklyCompareKey && !friend.isSelf)
      ?? fallbackFriend;
    if (!you || !selectedFriend || you.key === selectedFriend.key) return null;

    const userValues = labels.map((_, index) => Number(you.dayValues[index] ?? 0));
    const friendValues = labels.map((_, index) => Number(selectedFriend.dayValues[index] ?? 0));
    const todayIso = getLocalISODate();
    const todayRow = insightCharts.weeklyDailyRows.find((row) => String(row.day ?? "") === todayIso);
    const todayLabel = String(todayRow?.label ?? labels[labels.length - 1] ?? "");
    const goal = Number(targetProgress?.daily?.target ?? 0);
    const userTotal = userValues.reduce((sum, value) => sum + value, 0);
    const friendTotal = friendValues.reduce((sum, value) => sum + value, 0);
    const weekLead = userTotal - friendTotal;
    const todayIndex = Math.max(0, labels.indexOf(todayLabel));
    const todayLead = Number(userValues[todayIndex] ?? 0) - Number(friendValues[todayIndex] ?? 0);

    return {
      labels,
      userValues,
      friendValues,
      friendName: selectedFriend.displayName,
      friendRank: selectedFriend.rank,
      userTotal,
      friendTotal,
      weekLead,
      todayLead,
      todayLabel,
      goalTarget: goal > 0 ? goal : null,
    };
  }, [insightCharts.weeklyDailyRows, insightCharts.weeklyLeaderboard, selectedWeeklyCompareKey, targetProgress?.daily?.target]);

  const tickerFacts = useMemo(() => {
    return buildNetworkTickerFacts({
      todayRows: insightCharts.todayRowsAll.map((row) => ({
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
      jobs: Array<{ date_saved: string | null; applied_at: string | null; id: number }>;
    }) => {
      return friend.jobs.reduce((max, job) => {
        const ts = Date.parse(String(job.applied_at ?? job.date_saved ?? ""));
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

  const todayApplicationsFlat = useMemo(() => {
    const rows: Array<{
      job: (typeof todayWithJobs)[number]["jobs"][number];
      friendName: string;
      friendId: number;
    }> = [];
    todayWithJobs.forEach((friend) => {
      const friendName = String(friend.friend_name || friend.friend_email);
      friend.jobs.forEach((job) => {
        rows.push({ job, friendName, friendId: friend.friend_id });
      });
    });
    rows.sort((a, b) => {
      const tsA = Date.parse(String(a.job.applied_at ?? a.job.date_saved ?? ""));
      const tsB = Date.parse(String(b.job.applied_at ?? b.job.date_saved ?? ""));
      const diff = (Number.isNaN(tsB) ? 0 : tsB) - (Number.isNaN(tsA) ? 0 : tsA);
      if (diff !== 0) return diff;
      return a.friendName.localeCompare(b.friendName);
    });
    return rows;
  }, [todayWithJobs]);

  const weeklySelfStreak = useMemo(() => {
    const selfRow = insightCharts.weeklyLeaderboard.find((row) => row.isSelf);
    if (!selfRow || !insightCharts.weeklyDailyRows.length) return null;

    const labels = insightCharts.weeklyDailyRows.map((row) => String(row.label ?? ""));
    const values = labels.map((_, idx) => Number(selfRow.dayValues[idx] ?? 0));
    const todayIso = getLocalISODate();
    const todayIndexRaw = insightCharts.weeklyDailyRows.findIndex((row) => String(row.day ?? "") === todayIso);
    const todayIndex = todayIndexRaw >= 0 ? todayIndexRaw : Math.max(0, labels.length - 1);

    let streakCount = 0;
    for (let idx = todayIndex; idx >= 0; idx -= 1) {
      if (values[idx] > 0) streakCount += 1;
      else break;
    }

    const days = labels.map((label, idx) => ({
      label,
      isActive: idx <= todayIndex && values[idx] > 0,
      isFuture: idx > todayIndex,
    }));

    return {
      count: streakCount,
      days,
    };
  }, [insightCharts.weeklyDailyRows, insightCharts.weeklyLeaderboard]);
  const weeklyBoardLeader = insightCharts.weeklyLeaderboard[0] ?? null;
  const weeklyBoardTopThree = insightCharts.weeklyLeaderboard.slice(0, 3);
  const weeklyHeaderTotal = useMemo(() => {
    const selfRow = insightCharts.weeklyLeaderboard.find((row) => row.isSelf) ?? null;
    return Number((selfRow ?? weeklyBoardLeader)?.total ?? 0);
  }, [insightCharts.weeklyLeaderboard, weeklyBoardLeader]);
  const weeklyBoardLeadBy = useMemo(() => {
    if (!weeklyBoardTopThree.length) return 0;
    const leader = Number(weeklyBoardTopThree[0]?.total ?? 0);
    const second = Number(weeklyBoardTopThree[1]?.total ?? 0);
    return Math.max(0, leader - second);
  }, [weeklyBoardTopThree]);
  const badgeStats = useMemo(() => {
    const selfRow = insightCharts.weeklyLeaderboard.find((row) => row.isSelf) ?? null;
    return {
      weeklyApplications: Number(selfRow?.total ?? 0),
      streak: Number(weeklySelfStreak?.count ?? 0),
      rivalWins: Number(selfRow?.dailyWins ?? 0),
    };
  }, [insightCharts.weeklyLeaderboard, weeklySelfStreak]);
  const earnedBadgeIds = useMemo(() => getEarnedBadgeIds(badgeStats), [badgeStats]);
  const earnedBadges = useMemo(() => getEarnedBadges(badgeStats), [badgeStats]);
  const topEarnedBadges = useMemo(() => earnedBadges.slice(0, 3), [earnedBadges]);
  const badgeCategories = useMemo<BadgeCategory[]>(() => ["consistency", "applications", "rivalry"], []);
  const totalMedals = BADGE_TIERS.length * badgeCategories.length;
  const latestAchievement = earnedBadges.length ? earnedBadges[earnedBadges.length - 1] : null;

  useEffect(() => {
    if (!showBadgeGallery) return undefined;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowBadgeGallery(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showBadgeGallery]);

  const rivalryKeepOnePlan = useMemo(() => {
    const selfRow = insightCharts.weeklyLeaderboard.find((row) => row.isSelf) ?? null;
    if (!selfRow) return null;
    const rivalRow =
      selfRow.rank === 1
        ? insightCharts.weeklyLeaderboard.find((row) => !row.isSelf && row.rank === 2) ?? null
        : insightCharts.weeklyLeaderboard[0] ?? null;
    if (!rivalRow) return null;

    const safeLeadTarget = 3;
    const currentGap = selfRow.rank === 1 ? selfRow.total - rivalRow.total : rivalRow.total - selfRow.total;
    const isDefending = selfRow.rank === 1;
    const lockTargetTotal = isDefending ? rivalRow.total + safeLeadTarget : rivalRow.total + 1;
    const appsNeededThisWeek = Math.max(0, lockTargetTotal - selfRow.total);
    const progressGoal = Math.max(1, lockTargetTotal);
    const progressPercent = Math.max(0, Math.min(100, Math.round((selfRow.total / progressGoal) * 100)));

    return {
      title: isDefending
        ? `Need ${appsNeededThisWeek} app${appsNeededThisWeek === 1 ? "" : "s"} this week to stay ahead`
        : `Need ${appsNeededThisWeek} app${appsNeededThisWeek === 1 ? "" : "s"} this week to take #1`,
      detail: isDefending
        ? appsNeededThisWeek > 0
          ? `Build a +${safeLeadTarget} cushion over ${rivalRow.displayName}`
          : `Lead cushion is already +${currentGap} over ${rivalRow.displayName}`
        : `Close the gap on ${rivalRow.displayName} this week`,
      progressGoal,
      progressPercent,
      weekTotal: selfRow.total,
      isDefending,
    };
  }, [insightCharts.weeklyLeaderboard]);
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
        <div className="network-ticker-actions">
          <button type="button" className="network-add-friends-btn" onClick={openFriendManager}>
            + Add Friends
          </button>
          <button type="button" className="network-field-visibility-btn" onClick={openFieldVisibilityManager}>
            Shared Fields
          </button>
        </div>
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
                      <div className="chart-header network-insight-card-head network-rivalry-header">
                        <div className="chart-title-group network-rivalry-head">
                          <h2 className="network-insight-title">Performance Snapshot</h2>
                        </div>
                      </div>
                      <div className="network-mini-chart network-split-chart">
                        <div className="network-chart-stage">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={insightCharts.todayRows} margin={{ top: 14, right: 6, left: 0, bottom: 6 }} barCategoryGap="18%">
                              <defs>
                                {insightCharts.todayRows.map((row) => {
                                  const gradId = todayBarGradientId(row.key);
                                  return (
                                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.98 : 0.9)} />
                                      <stop offset="100%" stopColor={rgbaFromHex(row.color, row.isLeader ? 0.34 : 0.22)} />
                                    </linearGradient>
                                  );
                                })}
                              </defs>
      <CartesianGrid strokeDasharray="4 4" stroke={NETWORK_CHART_THEME.grid} vertical={false} opacity={0.35} />
      <XAxis
        dataKey="label"
        tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 12, fontWeight: 600 }}
        axisLine={{ stroke: NETWORK_CHART_THEME.grid }}
        tickLine={false}
        interval={0}
        height={28}
        tickMargin={8}
        minTickGap={18}
        padding={{ left: 4, right: 4 }}
        tickFormatter={(value) => formatFirstNameLastInitial(String(value ?? ""))}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fill: NETWORK_CHART_THEME.textSecondary, fontSize: 12, fontWeight: 600 }}
        tickLine={false}
        axisLine={{ stroke: NETWORK_CHART_THEME.grid }}
        width={30}
        tickMargin={6}
        domain={[0, (dataMax: number) => Math.max(4, Math.ceil(Number(dataMax || 0) * 1.15))]}
      />
      {insightCharts.todayStats.average > 0 && insightCharts.todayRows.length > 1 ? (
        <ReferenceLine
          y={insightCharts.todayStats.average}
          stroke="var(--text-muted)" /* Accessible average line color */
          strokeDasharray="6 4"
          strokeWidth={1.5}
          opacity={0.8}
          ifOverflow="extendDomain"
          label={(props: { viewBox?: { x?: number; y?: number; width?: number } }) => {
            const x = Number(props.viewBox?.x ?? 0) + Number(props.viewBox?.width ?? 0) / 2;
            const y = Number(props.viewBox?.y ?? 0) - 8;
            return (
              <text x={x} y={y} fill="var(--text-secondary)" fontSize={11} fontWeight={600} textAnchor="middle">
                Avg {insightCharts.todayStats.average}
              </text>
            );
          }}
        />
      ) : null}
                              <Tooltip content={<NetworkInsightBarTooltip metricLabel="Applications today" />} cursor={false} />
                                <Bar
                                  dataKey="total"
                                  fillOpacity={1}
                                  radius={[6, 6, 0, 0]}
                                  maxBarSize={64}
                                  isAnimationActive
                                  animationBegin={80}
                                  animationDuration={720}
                                  animationEasing="ease-out"
                                  activeBar={false}
                                >
                                  <LabelList
                                    dataKey="total"
                                    position="insideTop"
                                    offset={12}
                                    content={(props: {
                                      x?: number | string;
                                      y?: number | string;
                                      width?: number | string;
                                      height?: number | string;
                                      value?: number | string;
                                      payload?: { isLeader?: boolean; color?: string; total?: number } | null;
                                    }) => {
                                      const x = Number(props.x ?? 0);
                                      const y = Number(props.y ?? 0);
                                      const width = Number(props.width ?? 0);
                                      const height = Number(props.height ?? 0);
                                      const value = Number(props.value ?? 0);
                                      const isLeader = Boolean(props.payload?.isLeader);
                                      const payloadColor = String(props.payload?.color ?? "#2563eb");
                                      if (!(value > 0) || width <= 0) return null;
                                      
                                      const centerX = x + width / 2;
                                      // If the bar is very short, position the label slightly above it
                                      // Otherwise cleanly inside the top of the bar.
                                      const isShortBar = height < 30;
                                      const labelY = isShortBar ? y - 10 : y + 16;
                                      const textColor = isShortBar ? (isLeader ? payloadColor : rgbaFromHex(payloadColor, 0.9)) : "#ffffff";
                                      
                                      return (
                                        <g>
                                          {insightCharts.todayLeader.hasSingleLeader && isLeader ? (
                                            <text x={centerX} y={y - (isShortBar ? 26 : 14)} textAnchor="middle" fill={payloadColor} fontSize={16} filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.1))">
                                              {"\u{1F451}"}
                                            </text>
                                          ) : null}
                                          <text
                                            x={centerX}
                                            y={labelY}
                                            textAnchor="middle"
                                            fill={textColor}
                                            fontSize={14}
                                            fontWeight={700}
                                            style={{ textShadow: !isShortBar ? "0px 1px 2px rgba(0,0,0,0.3)" : "none" }}
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
                                      stroke={row.total > 0 ? (row.isLeader ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.12)"}
                                      strokeWidth={row.isLeader ? 2 : 1}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {insightCharts.todayStats.hiddenCount > 0 ? (
                        <p className="network-weekly-hint" style={{ marginTop: 8 }}>
                          Top {MAX_NETWORK_TODAY_BARS} shown. +{insightCharts.todayStats.hiddenCount} more friend
                          {insightCharts.todayStats.hiddenCount === 1 ? "" : "s"} have activity today.
                        </p>
                      ) : null}
                      <div className="network-badge-preview" aria-label="Achievements preview">
                        <div className="network-badge-preview-head">
                          <p className="network-badge-preview-title">Achievements</p>
                        </div>
                        {topEarnedBadges.length ? (
                          <div className="network-badge-preview-row">
                            {topEarnedBadges.map((badge) => {
                              const Icon = badge.Icon;
                              return (
                                <div
                                  key={badge.id}
                                  className={`network-badge-preview-item network-medal tier-${badge.tier}`}
                                  aria-label={`${badge.name}. ${badge.description}`}
                                >
                                  <span className="network-badge-preview-icon">
                                    <Icon />
                                  </span>
                                  <span className="network-badge-preview-label">{badge.name}</span>
                                  <span className="network-medal-tooltip" role="tooltip">
                                    <strong>{badge.name}</strong>
                                    <span>{badge.description}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="network-badge-preview-empty">Apply and compete this week to unlock your first badge.</p>
                        )}
                      </div>
                    </div>

                    <div className="network-trend-card network-insight-card">
                      <div className="chart-header network-insight-card-head network-rivalry-header network-rivalry-feature-header">
                        <div className="chart-title-group network-rivalry-head">
                          <h2 className="network-insight-title">🔥 Rivalry Mode</h2>
                        </div>
                        <div className="chart-filter network-compare-filter">
                          <span className="chart-filter-label">Pick rival</span>
                          <select
                            className="chart-filter-select network-compare-select"
                            aria-label="Select friend to compare weekly trend"
                            value={selectedWeeklyCompareKey}
                            onChange={(event) => setSelectedWeeklyCompareKey(event.target.value)}
                            disabled={!compareFriendOptions.length}
                            style={{ width: `${compareSelectWidthCh}ch`, maxWidth: "100%" }}
                          >
                            {compareFriendOptions.length ? (
                              compareFriendOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label} · {option.total}
                                </option>
                              ))
                            ) : (
                              <option value="">No friends available</option>
                            )}
                          </select>
                        </div>
                      </div>
                      <p className="network-rivalry-subtitle network-rivalry-subtitle--below">
                        Compete with friends to track job application momentum.
                      </p>
                      <div className="network-weekly-line-layout">
                        <div className="network-weekly-line-stage network-chart-stage">
                          {weeklyCompetition ? (
                            <WeeklyCompetitionChart
                              labels={weeklyCompetition.labels}
                              userValues={weeklyCompetition.userValues}
                              friendValues={weeklyCompetition.friendValues}
                              friendName={weeklyCompetition.friendName}
                              todayLabel={weeklyCompetition.todayLabel}
                              goalTarget={weeklyCompetition.goalTarget}
                            />
                          ) : (
                            <div className="chart-empty" style={{ minHeight: 180 }}>
                              Not enough data for weekly competition.
                            </div>
                          )}
                        </div>
                      </div>
                      {weeklyCompetition ? (
                        <div className="trend-uniform-foot network-rivalry-footer">
                          <span
                            className={`trend-uniform-foot-item ${weeklyCompetition.weekLead > 0 ? "trend-uniform-foot-item--applied" : weeklyCompetition.weekLead < 0 ? "trend-uniform-foot-item--rejected" : "trend-uniform-foot-item--muted"}`}
                          >
                            {weeklyCompetition.weekLead > 0
                              ? `You +${weeklyCompetition.weekLead} this week`
                              : weeklyCompetition.weekLead < 0
                                ? `${weeklyCompetition.friendName} +${Math.abs(weeklyCompetition.weekLead)} this week`
                                : "Week tie"}
                          </span>
                          <span
                            className={`trend-uniform-foot-item ${weeklyCompetition.todayLead > 0 ? "trend-uniform-foot-item--applied" : weeklyCompetition.todayLead < 0 ? "trend-uniform-foot-item--rejected" : "trend-uniform-foot-item--muted"}`}
                          >
                            {weeklyCompetition.todayLead > 0
                              ? `Today +${weeklyCompetition.todayLead}`
                              : weeklyCompetition.todayLead < 0
                                ? `Today -${Math.abs(weeklyCompetition.todayLead)}`
                                : "Today even"}
                          </span>
                          <span className="trend-uniform-foot-item trend-uniform-foot-item--muted">
                            Rival rank #{weeklyCompetition.friendRank}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="network-trend-card network-insight-card network-weekly-mini-board network-weekly-mini-board-stack">
                      <div className="chart-header network-insight-card-head network-rivalry-header network-weekly-mini-board-header">
                        <div className="chart-title-group network-rivalry-head">
                          <h2 className="network-insight-title">🏆 Weekly Board</h2>
                        </div>
                        <strong className="network-weekly-board-total" aria-label="Today total applications">
                          {weeklyHeaderTotal}
                        </strong>
                      </div>
                      {weeklyBoardLeader ? (
                        <div className="network-rivalry-status">
                          <p className="network-rivalry-status-title">
                            {weeklyBoardLeader.isSelf
                              ? "You're leading this week"
                              : `${weeklyBoardLeader.displayName} is leading this week`}
                          </p>
                          <p className="network-rivalry-status-copy">
                            {weeklyBoardLeadBy > 0 ? `+${weeklyBoardLeadBy} applications ahead` : "Top spot is currently tied"}
                          </p>
                          {insightCharts.weeklySelfRankSnapshot.currentRank ? (
                            <div className="network-rivalry-rank-snapshot" aria-label="Weekly rank snapshot">
                              <span className="network-rivalry-rank-pill is-current">
                                <span className="network-rivalry-rank-pill-label">This week</span>
                                <strong className="network-rivalry-rank-pill-value">
                                  #{insightCharts.weeklySelfRankSnapshot.currentRank}
                                </strong>
                              </span>
                              <span className="network-rivalry-rank-pill is-previous">
                                <span className="network-rivalry-rank-pill-label">Last week</span>
                                <strong className="network-rivalry-rank-pill-value">
                                  {insightCharts.weeklySelfRankSnapshot.previousRank
                                    ? `#${insightCharts.weeklySelfRankSnapshot.previousRank}`
                                    : "—"}
                                </strong>
                              </span>
                              {typeof insightCharts.weeklySelfRankSnapshot.change === "number" ? (
                                <span
                                  className={`network-rivalry-rank-shift ${
                                    insightCharts.weeklySelfRankSnapshot.change > 0
                                      ? "is-up"
                                      : insightCharts.weeklySelfRankSnapshot.change < 0
                                        ? "is-down"
                                        : "is-even"
                                  }`}
                                >
                                  {insightCharts.weeklySelfRankSnapshot.change > 0
                                    ? `↑${insightCharts.weeklySelfRankSnapshot.change}`
                                    : insightCharts.weeklySelfRankSnapshot.change < 0
                                      ? `↓${Math.abs(insightCharts.weeklySelfRankSnapshot.change)}`
                                      : "→0"}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {weeklyBoardTopThree.length ? (
                        <div className="network-rivalry-top3-grid" aria-label="Top 3 competitors">
                          {weeklyBoardTopThree.map((row, index) => (
                            <div
                              key={`top3-${row.key}`}
                              className={`network-rivalry-top3-card place-${index + 1}`}
                            >
                              <div className="network-rivalry-rank-badge" aria-hidden="true">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                              </div>
                              <p className="network-rivalry-top3-name">{row.displayName}</p>
                              <strong className="network-rivalry-top3-score">{row.total}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {weeklySelfStreak ? (
                        <div className="network-rivalry-streak">
                          <p className="network-streak-title">
                            <span aria-hidden="true">🔥</span>{" "}
                            {weeklySelfStreak.count} day streak
                          </p>
                          <p className="network-streak-copy">
                            {weeklySelfStreak.count > 0
                              ? "Keep applying to grow your streak"
                              : "Apply today to start your streak"}
                          </p>
                          <div className="network-streak-days" aria-label="Your weekly streak progress">
                            {weeklySelfStreak.days.map((day) => (
                              <div
                                key={`streak-${day.label}`}
                                className={`network-streak-day${day.isActive ? " is-active" : ""}${day.isFuture ? " is-future" : ""}`}
                                title={`${day.label}`}
                              >
                                <span>{day.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {rivalryKeepOnePlan ? (
                        <div className="network-rivalry-keep-panel" aria-label="How to keep number one">
                          <p className="network-rivalry-keep-kicker">
                            {rivalryKeepOnePlan.isDefending ? "Weekly lock" : "Weekly comeback"}
                          </p>
                          <p className="network-rivalry-keep-title">{rivalryKeepOnePlan.title}</p>
                          <div className="network-rivalry-keep-meter" aria-hidden="true">
                            <span style={{ width: `${rivalryKeepOnePlan.progressPercent}%` }} />
                          </div>
                          <div className="network-rivalry-keep-meta">
                            <span>
                              Week {rivalryKeepOnePlan.weekTotal}/{rivalryKeepOnePlan.progressGoal}
                            </span>
                            <span>{rivalryKeepOnePlan.detail}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="network-applications-row">
        <section className="network-applications-main">
          <div className="card network-shell-card is-open">
            <div className="network-main-head network-main-head--static">
              <h2>Today&apos;s Applications</h2>
            <div className="network-main-right">
              <span className="pending-meta">Friends with activity today</span>
            </div>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="network-card-content">
              {todayApplicationsFlat.length === 0 ? (
                <div className="network-empty-state network-empty-state--today" role="status" aria-live="polite">
                  <div className="network-empty-state-icon" aria-hidden="true">
                    ◌
                  </div>
                  <p className="network-empty-state-title">No applications logged today</p>
                  <p className="network-empty-state-copy">When friends add applications, they appear here automatically.</p>
                </div>
              ) : (
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
                        <th>Referral</th>
                        <th>Notes</th>
                        <th>Link</th>
                        <th>Action</th>
                        <th>Friend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayApplicationsFlat.map((row, idx) => {
                        const { job, friendName } = row;
                        const canViewIdentity = Boolean(job.can_view_company && job.can_view_role);
                        const canOpenLink = canViewIdentity && Boolean(job.job_link);
                        const canPrefill = canViewIdentity;
                        return (
                          <tr
                            key={`${row.friendId}-${job.id}`}
                            className="network-job-row"
                            onClick={() => {
                              if (!canPrefill) return;
                              onSelectFriendJob(friendName, {
                                company: job.company ?? null,
                                role: job.role ?? null,
                                date_saved: job.date_saved ?? null,
                                applied_at: job.applied_at ?? null,
                                job_link: job.job_link ?? null,
                                job_application_id: job.job_application_id ?? null,
                                oa_deadline_date: job.oa_deadline_date ?? null,
                                oa_status: job.oa_status ?? null,
                                referral_status: job.referral_status ?? null,
                                application_status: job.application_status ?? null,
                                notes: job.notes ?? null,
                              });
                            }}
                          >
                            <td className="network-cell-index">{idx + 1}</td>
                            <td className="network-cell-company-role">
                              {canViewIdentity ? (
                                <div className="job-main">
                                  <div className="job-company" title={String(job.company ?? "—")}>
                                    {String(job.company ?? "—")}
                                  </div>
                                  <div className="job-role" title={String(job.role ?? "—")}>
                                    {String(job.role ?? "—")}
                                  </div>
                                </div>
                              ) : (
                                <span className="network-not-shared">Not shared</span>
                              )}
                            </td>
                            <td className="network-cell-date">
                              {job.can_view_applied_at ? (
                                formatTableDateTime(job.applied_at ?? job.date_saved)
                              ) : (
                                <span className="network-not-shared">Not shared</span>
                              )}
                            </td>
                            <td className="network-cell-oa">{job.can_view_oa_status ? normalizeOaStatus(job.oa_status) : <span className="network-not-shared">Not shared</span>}</td>
                            <td className="network-cell-deadline">{job.can_view_oa_deadline ? (String(job.oa_deadline_date ?? "-") || "-") : <span className="network-not-shared">Not shared</span>}</td>
                            <td className="network-cell-jobid">{job.can_view_job_application_id ? (String(job.job_application_id ?? "-") || "-") : <span className="network-not-shared">Not shared</span>}</td>
                            <td className="network-cell-referral">{job.can_view_referral_used ? (String(job.referral_status ?? "-") || "-") : <span className="network-not-shared">Not shared</span>}</td>
                            <td className="network-cell-notes">{job.can_view_notes ? (String(job.notes ?? "-") || "-") : <span className="network-not-shared">Not shared</span>}</td>
                            <td className="network-cell-link">
                              {canOpenLink ? (
                                <a
                                  href={String(job.job_link)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="network-link-chip"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open
                                </a>
                              ) : canViewIdentity ? (
                                "—"
                              ) : (
                                <span className="network-not-shared">Not shared</span>
                              )}
                            </td>
                            <td className="network-cell-action">
                              <button
                                type="button"
                                className="action-btn network-add-btn"
                                disabled={!canPrefill}
                                title={canPrefill ? "Add this application to your list" : "Friend has not shared enough fields for prefill"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!canPrefill) return;
                                  onSelectFriendJob(friendName, {
                                    company: job.company ?? null,
                                    role: job.role ?? null,
                                    date_saved: job.date_saved ?? null,
                                    applied_at: job.applied_at ?? null,
                                    job_link: job.job_link ?? null,
                                    job_application_id: job.job_application_id ?? null,
                                    oa_deadline_date: job.oa_deadline_date ?? null,
                                    oa_status: job.oa_status ?? null,
                                    referral_status: job.referral_status ?? null,
                                    application_status: job.application_status ?? null,
                                    notes: job.notes ?? null,
                                  });
                                }}
                              >
                                Add Application
                              </button>
                            </td>
                            <td className="network-cell-friend">{friendName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
        <div className="network-signals-sidebar">
          <TargetSignalsCarousel
            todayData={todayData}
            useDemoFallback={useTargetDemoFallback}
            onAddApplication={({ friendName, job }) => onSelectFriendJob(friendName, job)}
          />
        </div>
      </div>

      </div>

      <ManageSharedFieldsModal
        open={showFieldVisibilityModal}
        saving={isSavingFieldVisibility}
        error={fieldVisibilityError}
        visibility={fieldVisibility}
        requiredFields={requiredVisibilityFields}
        onClose={() => setShowFieldVisibilityModal(false)}
        onSave={saveFieldVisibility}
        onToggle={setVisibilityValue}
      />

      {showBadgeGallery ? (
        <div className="modal-overlay network-badge-modal-overlay" onClick={() => setShowBadgeGallery(false)}>
          <div
            className="modal network-badge-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Badge gallery"
          >
            <div className="network-badge-modal-head">
              <h3>Achievements</h3>
              <button
                type="button"
                className="network-badge-modal-close"
                aria-label="Close achievements modal"
                onClick={() => setShowBadgeGallery(false)}
              >
                ×
              </button>
            </div>
            <div className="network-badge-modal-hero">
              <p className="network-badge-modal-subtitle">
                {earnedBadges.length} of {totalMedals} medals earned
              </p>
              <section className="network-badge-latest" aria-label="Latest achievement">
                <p className="network-badge-latest-kicker">Latest Achievement</p>
                {latestAchievement ? (
                  <div className={`network-badge-latest-row network-medal tier-${latestAchievement.tier} is-unlocked`}>
                    <span className="network-badge-latest-icon">
                      <latestAchievement.Icon />
                    </span>
                    <div className="network-badge-latest-copy">
                      <p className="network-badge-latest-name">{latestAchievement.name}</p>
                      <p className="network-badge-latest-desc">{latestAchievement.description}</p>
                    </div>
                  </div>
                ) : (
                  <p className="network-badge-latest-empty">No medals unlocked yet. Keep applying to unlock your first one.</p>
                )}
              </section>
            </div>
            <div className="network-badge-gallery">
              {badgeCategories.map((category) => {
                const unlockedCount = BADGE_TIERS.filter((tier) => earnedBadgeIds.has(BADGES[category][tier].id)).length;
                return (
                  <section key={category} className="network-badge-gallery-section">
                    <div className="network-badge-gallery-section-head">
                      <h4>{BADGE_CATEGORY_LABEL[category]}</h4>
                      <span>
                        {unlockedCount} / {BADGE_TIERS.length}
                      </span>
                    </div>
                    <div className="network-badge-gallery-shelf">
                      {BADGE_TIERS.map((tier) => {
                        const badge = BADGES[category][tier];
                        const Icon = badge.Icon;
                        const unlocked = earnedBadgeIds.has(badge.id);
                        return (
                          <article
                            key={badge.id}
                            className={`network-badge-gallery-item network-medal tier-${badge.tier}${unlocked ? " is-unlocked" : " is-locked"}`}
                            aria-label={`${badge.name}. ${badge.description}. ${unlocked ? "Unlocked" : "Locked"}.`}
                          >
                            <span className="network-badge-gallery-icon">
                              <Icon />
                            </span>
                            <p className="network-badge-gallery-name">{badge.name}</p>
                            <p className="network-badge-gallery-desc">{badge.description}</p>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

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
