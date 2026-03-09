import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ManageSharedFieldsModal from "../components/network/ManageSharedFieldsModal";
import TargetSignalsCarousel from "../components/network/TargetSignalsCarousel";
import { BADGE_TIERS, type BadgeCategory } from "../constants/badges";
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
import { getLocalISODate } from "../lib/formatDate";
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
import BadgeGalleryModal from "./network/components/BadgeGalleryModal";
import PrefillApplicationModal from "./network/components/PrefillApplicationModal";
import NetworkInsightsSection from "./network/components/NetworkInsightsSection";
import NetworkTodayApplicationsContent from "./network/components/NetworkTodayApplicationsContent";
import {
  ENTERPRISE_CHART_COLORS,
  MAX_NETWORK_BOARD_ENTRIES,
  MAX_NETWORK_TODAY_BARS,
  NETWORK_VISIBILITY_FIELDS,
  OPTIONAL_SHARE_KEYS,
  REQUIRED_VISIBILITY_KEYS,
  WEEKLY_LINE_PALETTE,
} from "./network/constants";
import type { PrefillForm } from "./network/types";
import {
  augmentDemoNetworkData,
  emojiForTickerFact,
  formatFirstNameLastInitial,
  formatWeekdayShort,
  isoDayAddDays,
  normalizeOaStatus,
  toDateInput,
  utcDateFromIsoDay,
  weekStartIsoUtc,
  weeklyShadeGradientId,
} from "./network/utils";

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
  const todayApplicationsSectionRef = useRef<HTMLElement | null>(null);
  const [todayApplicationsSectionHeight, setTodayApplicationsSectionHeight] = useState(0);
  const [fieldVisibility, setFieldVisibility] = useState<NetworkFieldVisibility>({
    share_company: true,
    share_role: true,
    share_applied_at: true,
    share_oa_status: true,
    share_oa_deadline: true,
    share_referral_used: true,
    share_notes: true,
    share_job_application_id: true,
  });
  const [requiredVisibilityFields, setRequiredVisibilityFields] = useState<Array<keyof NetworkFieldVisibility>>(
    REQUIRED_VISIBILITY_KEYS,
  );
  const [prefillForm, setPrefillForm] = useState<PrefillForm>({
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

  const privacyHiddenLabel = useCallback(
    (key: keyof NetworkFieldVisibility) => (fieldVisibility[key] ? "Friend not sharing" : "Not shared"),
    [fieldVisibility],
  );

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

  useEffect(() => {
    const node = todayApplicationsSectionRef.current;
    if (!node) return undefined;

    const syncHeight = () => {
      const nextHeight = Math.max(0, Math.round(node.getBoundingClientRect().height));
      setTodayApplicationsSectionHeight((previous) => (previous === nextHeight ? previous : nextHeight));
    };

    syncHeight();
    const onWindowResize = () => syncHeight();
    window.addEventListener("resize", onWindowResize);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", onWindowResize);
    }

    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

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
  const syncedSignalsSidebarStyle =
    todayApplicationsSectionHeight > 0
      ? { height: `${todayApplicationsSectionHeight}px`, maxHeight: `${todayApplicationsSectionHeight}px` }
      : undefined;
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
      <NetworkInsightsSection
        insightsOpen={insightsOpen}
        setInsightsOpen={setInsightsOpen}
        isLoading={isLoading}
        insightCharts={insightCharts}
        topEarnedBadges={topEarnedBadges}
        compareFriendOptions={compareFriendOptions}
        selectedWeeklyCompareKey={selectedWeeklyCompareKey}
        setSelectedWeeklyCompareKey={setSelectedWeeklyCompareKey}
        compareSelectWidthCh={compareSelectWidthCh}
        weeklyCompetition={weeklyCompetition}
        weeklyHeaderTotal={weeklyHeaderTotal}
        weeklyBoardLeader={weeklyBoardLeader}
        weeklyBoardLeadBy={weeklyBoardLeadBy}
        weeklyBoardTopThree={weeklyBoardTopThree}
        weeklySelfStreak={weeklySelfStreak}
        rivalryKeepOnePlan={rivalryKeepOnePlan}
      />

      <div className="network-applications-row">
        <section className="network-applications-main" ref={todayApplicationsSectionRef}>
          <div className="card network-shell-card is-open">
            <div className="network-main-head network-main-head--static">
              <h2>Today&apos;s Applications</h2>
            <div className="network-main-right">
              <span className="pending-meta">Friends with activity today</span>
            </div>
          </div>

          <NetworkTodayApplicationsContent
            isLoading={isLoading}
            todayApplicationsFlat={todayApplicationsFlat}
            privacyHiddenLabel={privacyHiddenLabel}
            onSelectFriendJob={onSelectFriendJob}
          />
          </div>
        </section>
        <div className="network-signals-sidebar" style={syncedSignalsSidebarStyle}>
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

      <BadgeGalleryModal
        show={showBadgeGallery}
        onClose={() => setShowBadgeGallery(false)}
        earnedBadges={earnedBadges}
        totalMedals={totalMedals}
        latestAchievement={latestAchievement}
        badgeCategories={badgeCategories}
        earnedBadgeIds={earnedBadgeIds}
      />

      <PrefillApplicationModal
        show={showPrefillModal}
        isSaving={isPrefillSaving}
        prefillFromName={prefillFromName}
        prefillError={prefillError}
        prefillForm={prefillForm}
        setPrefillForm={setPrefillForm}
        onClose={() => !isPrefillSaving && setShowPrefillModal(false)}
        onSubmit={onCreateFromPrefill}
      />
    </>
  );
}
