import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import useConfirmDialog from "../components/ui/useConfirmDialog";
import {
  createReferral,
  deleteJob,
  deleteOaArchive,
  getDashboardSummary,
  getJobs,
  getJobsTrend,
  getOaArchive,
  getReferrals,
  getTargetProgress,
  updateJob,
  updateOaArchive,
  type JobsTrendData,
} from "../lib/api";
import { formatTableDate, formatTableDateTime, getLocalISODate } from "../lib/formatDate";
import {
  ANALYTICS_EVENTS,
  trackErrorEvent,
  trackFeatureEvent,
  trackProductEvent,
} from "../analytics/events";
import {
  APPLICATION_PIPELINE_STAGES,
  BASE_SORT_CONFIG,
  CARD_LIMIT,
  LIMIT,
} from "./jobs/constants";
import ActiveJobsBoard from "./jobs/components/ActiveJobsBoard";
import AddReferralModal from "./jobs/components/activeBoard/AddReferralModal";
import EditJobModal from "./jobs/components/EditJobModal";
import EditOaModal from "./jobs/components/EditOaModal";
import JobsTable from "./jobs/components/JobsTable";
import OaArchiveTable from "./jobs/components/OaArchiveTable";
import JobsTrendCharts from "./jobs/components/JobsTrendCharts";
import type {
  SortField,
  SortOrder,
  ToolbarBooleanFilter,
  ToolbarStageFilter,
  ToolbarStatusFilter,
  ToolbarTimeRange,
} from "./jobs/types";
import {
  capitalizeFirst,
  formatDayShort,
  getOaResultLabel,
  normalizeOaStatus,
  normalizeReferralStatus,
} from "./jobs/utils/formatters";
import { buildPaginationItems } from "./jobs/utils/pagination";
import { compareJobs } from "./jobs/utils/sort";
import { getKeywordMeta, getStatusMeta } from "./jobs/utils/tableMeta";

type DashboardStage = (typeof APPLICATION_PIPELINE_STAGES)[number];

type ActiveCard = {
  id: number | string;
  company: string;
  role: string;
  appliedDate: string;
  appliedDateTime: string;
  referredBy: string;
  jobId: string;
  keywordMatch: string;
  progress: number;
  jobLink: string;
  raw: Record<string, unknown>;
};

type ActiveReferralRow = {
  id: number | string;
  name: string;
  company: string;
  role: string;
};

type ActiveWeeklyCount = {
  week: string;
  count: number;
};

type ActiveDailyCount = {
  day: string;
  count: number;
  iso: string;
};

type ActiveInsightsState = {
  weeklyCounts: ActiveWeeklyCount[];
  totalApplications: number;
  averagePerWeek: string;
  peakWeekLabel: string;
  currentWeekDailyCounts: ActiveDailyCount[];
  thisWeekTotal: number;
  previousWeekTotal: number;
  bestDay: string;
  targetCount: number;
  targetProgressPercent: number;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isDashboardStage(value: string): value is DashboardStage {
  return (APPLICATION_PIPELINE_STAGES as readonly string[]).includes(value);
}

function deriveDashboardStage(job: Record<string, unknown>): DashboardStage {
  const fromApi = String((job as any).dashboard_stage ?? "").trim();
  if (isDashboardStage(fromApi)) return fromApi;

  const applicationStatus = String(job.application_status ?? "").trim().toLowerCase();
  const responseStatus = String(job.response_status ?? "").trim().toLowerCase();
  const oaStatus = String((job as any).oa_status ?? "").trim().toLowerCase();

  if (["rejected", "archive", "archived"].includes(applicationStatus)) return "Archive";
  if (applicationStatus === "offer" || responseStatus === "offer") return "Offer";
  if (applicationStatus === "interview" || responseStatus === "interview") return "Interview";
  if (oaStatus === "yes") return "OA";
  return "Applied";
}

function getStageProgress(stage: DashboardStage): number {
  const idx = APPLICATION_PIPELINE_STAGES.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

function parseLocalIsoDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getMondayStart(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const delta = (day + 6) % 7;
  copy.setDate(copy.getDate() - delta);
  return copy;
}

function formatWeekLabel(isoDay: string): string {
  return formatDayShort(isoDay);
}

function buildDefaultWeeklyCounts(anchorIso: string): ActiveWeeklyCount[] {
  const anchor = parseLocalIsoDate(anchorIso) ?? new Date();
  const weekStart = getMondayStart(anchor);
  const weekly: ActiveWeeklyCount[] = [];
  for (let i = 4; i >= 0; i -= 1) {
    const weekDate = new Date(weekStart);
    weekDate.setDate(weekStart.getDate() - i * 7);
    const iso = getLocalISODate(weekDate);
    weekly.push({ week: formatWeekLabel(iso), count: 0 });
  }
  return weekly;
}

function buildCurrentWeekDailyCounts(
  dailyTrend: Array<{ day: string; total: number }>,
  anchorIso: string,
): ActiveDailyCount[] {
  const dayMap = new Map<string, number>();
  for (const row of dailyTrend) {
    dayMap.set(String(row.day), Number(row.total ?? 0));
  }

  const anchor = parseLocalIsoDate(anchorIso) ?? new Date();
  const weekStart = getMondayStart(anchor);

  return WEEKDAY_LABELS.map((label, idx) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + idx);
    const iso = getLocalISODate(date);
    return {
      day: label,
      count: dayMap.get(iso) ?? 0,
      iso,
    };
  });
}

function initialInsightsState(): ActiveInsightsState {
  return {
    weeklyCounts: [],
    totalApplications: 0,
    averagePerWeek: "0.0",
    peakWeekLabel: "— (0)",
    currentWeekDailyCounts: [],
    thisWeekTotal: 0,
    previousWeekTotal: 0,
    bestDay: "Mon",
    targetCount: 12,
    targetProgressPercent: 0,
  };
}

export default function JobsPage({ statusFilter }: { statusFilter?: string } = {}) {
  const location = useLocation();
  const urlSearchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get("search") ?? "").trim();
  }, [location.search]);

  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [searchInput, setSearchInput] = useState(urlSearchQuery);
  const [sortBy, setSortBy] = useState<SortField>("applied_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [trendData, setTrendData] = useState<JobsTrendData>([]);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({
    date_saved: "",
    role: "",
    company: "",
    location_raw: "",
    job_link: "",
    job_application_id: "",
    oa_deadline_date: "",
    keyword_matching: "Medium",
    oa_status: "No",
    referral_status: "",
    referred_by_name: "",
    response_status: "",
    application_status: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [archivingId, setArchivingId] = useState<number | string | null>(null);
  const [oaArchiveData, setOaArchiveData] = useState<Array<Record<string, unknown>>>([]);
  const [oaArchiveLoading, setOaArchiveLoading] = useState(false);
  const [oaArchiveError, setOaArchiveError] = useState("");
  const [oaEditing, setOaEditing] = useState<Record<string, unknown> | null>(null);
  const [oaEditForm, setOaEditForm] = useState({
    role: "",
    company: "",
    location_raw: "",
    job_link: "",
    job_application_id: "",
    oa_deadline_date: "",
    keyword_matching: "Medium",
    oa_status: "No",
    referral_status: "",
    response_status: "",
    application_status: "",
    notes: "",
    date_saved: "",
    oa_result: "Completed",
    oa_result_date: "",
    oa_completed_date: "",
  });
  const [isOaSaving, setIsOaSaving] = useState(false);
  const [oaDeletingId, setOaDeletingId] = useState<number | string | null>(null);

  const { confirm, confirmDialog } = useConfirmDialog();

  const [cardSearch, setCardSearch] = useState("");
  const [debouncedCardSearch, setDebouncedCardSearch] = useState("");
  const [cardTimeRange, setCardTimeRange] = useState<ToolbarTimeRange>("7");
  const [cardReferralFilter, setCardReferralFilter] = useState<ToolbarBooleanFilter>("all");
  const [cardOaFilter, setCardOaFilter] = useState<ToolbarBooleanFilter>("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<ToolbarStatusFilter>("active");
  const [cardStageFilter, setCardStageFilter] = useState<ToolbarStageFilter>("All");
  const [cardPage, setCardPage] = useState(1);
  const [referralSearch, setReferralSearch] = useState("");
  const [debouncedReferralSearch, setDebouncedReferralSearch] = useState("");
  const [activeSmartView, setActiveSmartView] = useState<"default" | "interview" | "referral" | null>("default");

  const [activeCards, setActiveCards] = useState<ActiveCard[]>([]);
  const [activeCardsTotal, setActiveCardsTotal] = useState(0);
  const [isLoadingActiveCards, setIsLoadingActiveCards] = useState(true);
  const [activeCardsError, setActiveCardsError] = useState("");

  const [activeReferrals, setActiveReferrals] = useState<ActiveReferralRow[]>([]);
  const [activeReferralTotal, setActiveReferralTotal] = useState(0);
  const [isLoadingActiveReferrals, setIsLoadingActiveReferrals] = useState(true);
  const [activeReferralsError, setActiveReferralsError] = useState("");

  const [activeInsights, setActiveInsights] = useState<ActiveInsightsState>(() => initialInsightsState());
  const [isLoadingActiveInsights, setIsLoadingActiveInsights] = useState(true);
  const [activeInsightsError, setActiveInsightsError] = useState("");

  const [showAddReferralModal, setShowAddReferralModal] = useState(false);
  const [isAddingReferral, setIsAddingReferral] = useState(false);
  const [addReferralError, setAddReferralError] = useState("");
  const [addReferralForm, setAddReferralForm] = useState({
    name: "",
    company: "",
    role: "",
  });

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeCardsRequestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = cardSearch.trim();
    if (!trimmed) {
      setDebouncedCardSearch("");
      return;
    }
    if (trimmed.length < 3) {
      setDebouncedCardSearch("");
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedCardSearch(trimmed);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [cardSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedReferralSearch(referralSearch.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [referralSearch]);

  useEffect(() => {
    setCardPage(1);
  }, [debouncedCardSearch, cardTimeRange, cardReferralFilter, cardOaFilter, cardStatusFilter, cardStageFilter]);

  useEffect(() => {
    function onSlashFocusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isEditingContext = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      if (isEditingContext) return;
      const slashPressed = event.key === "/";
      const commandKPressed = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!slashPressed && !commandKPressed) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    window.addEventListener("keydown", onSlashFocusSearch);
    return () => window.removeEventListener("keydown", onSlashFocusSearch);
  }, []);

  function applyDefaultCardFilters() {
    setCardSearch("");
    setCardTimeRange("7");
    setCardReferralFilter("all");
    setCardOaFilter("all");
    setCardStatusFilter("active");
    setCardStageFilter("All");
    setCardPage(1);
    setActiveSmartView("default");
  }

  function applyInterviewScenario() {
    setCardSearch("");
    setCardTimeRange("30");
    setCardReferralFilter("all");
    setCardOaFilter("yes");
    setCardStatusFilter("active");
    setCardStageFilter("Interview");
    setCardPage(1);
    setActiveSmartView("interview");
  }

  function applyReferralScenario() {
    setCardSearch("");
    setCardTimeRange("14");
    setCardReferralFilter("yes");
    setCardOaFilter("all");
    setCardStatusFilter("active");
    setCardStageFilter("All");
    setCardPage(1);
    setActiveSmartView("referral");
  }

  function clearCardFilters() {
    setCardSearch("");
    setCardTimeRange("all");
    setCardReferralFilter("all");
    setCardOaFilter("all");
    setCardStatusFilter("all");
    setCardStageFilter("All");
    setCardPage(1);
    setActiveSmartView(null);
  }

  const mapJobToActiveCard = useCallback((job: Record<string, unknown>): ActiveCard => {
    const stage = deriveDashboardStage(job);
    const progress = getStageProgress(stage);

    const keywordRaw = String((job as any).keyword_matching ?? "").trim();
    let keywordMatch = "-";
    if (keywordRaw) {
      const numeric = Number(keywordRaw);
      keywordMatch = Number.isFinite(numeric) ? `${Math.round(numeric)}%` : keywordRaw;
    }

    const appliedValue = (job as any).applied_at ?? job.date_saved;
    const appliedDateTime = formatTableDateTime(appliedValue);
    const appliedDate = formatTableDate(appliedValue);

    return {
      id: (job.id as number | string | undefined) ?? `${String(job.company ?? "job")}-${String(job.role ?? "role")}`,
      company: String(job.company ?? "-") || "-",
      role: String(job.role ?? "-") || "-",
      appliedDate,
      appliedDateTime,
      referredBy: String((job as any).referred_by_name ?? "").trim() || "No referral",
      jobId: String((job as any).job_application_id ?? "-") || "-",
      keywordMatch,
      progress,
      jobLink: String((job as any).job_link ?? "").trim(),
      raw: job,
    };
  }, []);

  const loadActiveCards = useCallback(async () => {
    if (statusFilter === "rejected") return;
    const requestId = activeCardsRequestIdRef.current + 1;
    activeCardsRequestIdRef.current = requestId;
    try {
      setActiveCardsError("");
      setIsLoadingActiveCards(true);
      const selectedStage = cardStageFilter === "All" ? undefined : cardStageFilter;
      const selectedStatus = selectedStage === "Archive" ? "archive" : "active";
      const res = await getJobs({
        page: cardPage,
        limit: CARD_LIMIT,
        search: debouncedCardSearch || undefined,
        status: selectedStatus,
        stage: selectedStage,
        sort: "applied_at",
        order: "desc",
      });
      if (requestId !== activeCardsRequestIdRef.current) return;
      const mapped = (res.data ?? []).map((row) => mapJobToActiveCard(row));
      const total = Number(res.total ?? 0);
      setActiveCards(mapped);
      setActiveCardsTotal(total);

      const maxPage = Math.max(1, Math.ceil(total / CARD_LIMIT));
      if (cardPage > maxPage) setCardPage(maxPage);
    } catch (err) {
      if (requestId !== activeCardsRequestIdRef.current) return;
      setActiveCardsError((err as Error).message);
      setActiveCards([]);
      setActiveCardsTotal(0);
    } finally {
      if (requestId !== activeCardsRequestIdRef.current) return;
      setIsLoadingActiveCards(false);
    }
  }, [
    statusFilter,
    cardPage,
    debouncedCardSearch,
    cardStageFilter,
    mapJobToActiveCard,
  ]);

  const loadActiveReferrals = useCallback(async () => {
    if (statusFilter === "rejected") return;
    try {
      setActiveReferralsError("");
      setIsLoadingActiveReferrals(true);
      const res = await getReferrals({
        page: 1,
        limit: 12,
        search: debouncedReferralSearch || undefined,
      });
      const rows = (res.data ?? []).map((row) => ({
        id: (row.id as number | string | undefined) ?? `ref-${String(row.company ?? "")}-${String(row.request_log ?? "")}`,
        name: String((row as any).referred_by_name ?? "").trim() || "Unknown",
        company: String(row.company ?? "-") || "-",
        role: String((row as any).request_log ?? "-") || "-",
      }));
      setActiveReferrals(rows);
      setActiveReferralTotal(Number((res as any).total ?? rows.length));
    } catch (err) {
      setActiveReferralsError((err as Error).message);
      setActiveReferrals([]);
      setActiveReferralTotal(0);
    } finally {
      setIsLoadingActiveReferrals(false);
    }
  }, [statusFilter, debouncedReferralSearch]);

  const loadActiveInsights = useCallback(async () => {
    if (statusFilter === "rejected") return;
    try {
      setActiveInsightsError("");
      setIsLoadingActiveInsights(true);

      const [summary, targets] = await Promise.all([getDashboardSummary(60), getTargetProgress()]);
      const anchorDay = String(targets.anchorDay ?? getLocalISODate());

      const weeklyRaw = Array.isArray(summary.weeklyTrend) ? summary.weeklyTrend : [];
      const latestFive = weeklyRaw.slice(-5);
      const weeklyCounts: ActiveWeeklyCount[] = latestFive.length
        ? latestFive.map((row) => ({
            week: formatWeekLabel(String(row.week ?? "")),
            count: Number(row.total ?? 0),
          }))
        : buildDefaultWeeklyCounts(anchorDay);

      const totalApplications = weeklyCounts.reduce((sum, row) => sum + row.count, 0);
      const averagePerWeek = (totalApplications / Math.max(1, weeklyCounts.length)).toFixed(1);
      const peakWeek = weeklyCounts.reduce(
        (peak, row) => (row.count > peak.count ? row : peak),
        weeklyCounts[0] ?? { week: "—", count: 0 },
      );

      const currentWeekDailyCounts = buildCurrentWeekDailyCounts(summary.dailyTrend ?? [], anchorDay);
      const thisWeekTotal = currentWeekDailyCounts.reduce((sum, row) => sum + row.count, 0);
      const previousWeekTotal = weeklyCounts.length > 1 ? weeklyCounts[weeklyCounts.length - 2].count : 0;
      const bestDay = currentWeekDailyCounts.reduce(
        (peak, row) => (row.count > peak.count ? row : peak),
        currentWeekDailyCounts[0] ?? { day: "Mon", count: 0, iso: anchorDay },
      );

      const requestedTarget = Number((targets as any)?.weekly?.target);
      const targetCount = Number.isFinite(requestedTarget) && requestedTarget > 0 ? requestedTarget : 12;
      const targetProgressPercent = targetCount > 0 ? Math.round((thisWeekTotal / targetCount) * 100) : 0;

      setActiveInsights({
        weeklyCounts,
        totalApplications,
        averagePerWeek,
        peakWeekLabel: `${peakWeek.week} (${peakWeek.count})`,
        currentWeekDailyCounts,
        thisWeekTotal,
        previousWeekTotal,
        bestDay: bestDay.day,
        targetCount,
        targetProgressPercent,
      });
    } catch (err) {
      setActiveInsightsError((err as Error).message);
      setActiveInsights(initialInsightsState());
    } finally {
      setIsLoadingActiveInsights(false);
    }
  }, [statusFilter]);

  const load = useCallback(async () => {
    if (statusFilter !== "rejected") return;
    try {
      setError("");
      setIsLoading(true);
      const res = await getJobs({
        page,
        limit: LIMIT,
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        status: statusFilter ?? "active",
      });
      setData(res.data ?? []);
      setTotalRows(Number(res.total ?? 0));
    } catch (e) {
      setError((e as Error).message);
      setData([]);
      setTotalRows(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, sortBy, sortOrder, statusFilter]);

  const loadTrend = useCallback(async () => {
    if (statusFilter !== "rejected") return;
    try {
      setIsLoadingTrend(true);
      const res = await getJobsTrend(30);
      setTrendData(res.data ?? []);
    } catch (e) {
      console.error("Failed to load trend data:", e);
      setTrendData([]);
    } finally {
      setIsLoadingTrend(false);
    }
  }, [statusFilter]);

  const loadOaArchive = useCallback(async () => {
    if (statusFilter !== "rejected") return;
    try {
      setOaArchiveError("");
      setOaArchiveLoading(true);
      const res = await getOaArchive();
      setOaArchiveData(res.data ?? []);
    } catch (e) {
      setOaArchiveError((e as Error).message);
      setOaArchiveData([]);
    } finally {
      setOaArchiveLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (statusFilter !== "rejected") {
      loadActiveCards();
    }
  }, [statusFilter, loadActiveCards]);

  useEffect(() => {
    if (statusFilter !== "rejected") {
      loadActiveReferrals();
    }
  }, [statusFilter, loadActiveReferrals]);

  useEffect(() => {
    if (statusFilter !== "rejected") {
      loadActiveInsights();
    }
  }, [statusFilter, loadActiveInsights]);

  useEffect(() => {
    if (statusFilter === "rejected") {
      load();
      loadTrend();
      loadOaArchive();
    } else {
      setData([]);
      setOaArchiveData([]);
      setOaArchiveError("");
    }
  }, [statusFilter, load, loadTrend, loadOaArchive]);

  useEffect(() => {
    const onRefresh = () => {
      if (statusFilter === "rejected") {
        load();
        loadTrend();
        loadOaArchive();
      } else {
        loadActiveCards();
        loadActiveReferrals();
        loadActiveInsights();
      }
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [
    statusFilter,
    load,
    loadTrend,
    loadOaArchive,
    loadActiveCards,
    loadActiveReferrals,
    loadActiveInsights,
  ]);

  useEffect(() => {
    trackFeatureEvent(ANALYTICS_EVENTS.filter_used, {
      source: "jobs_page",
      filter_type: "status",
      filter_value: statusFilter ?? "active",
    });
  }, [statusFilter]);

  useEffect(() => {
    if (statusFilter !== "rejected") return;
    setSearchInput(urlSearchQuery);
    setSearchQuery(urlSearchQuery);
    setPage(1);
  }, [urlSearchQuery, statusFilter]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = searchInput.trim();
    trackFeatureEvent(ANALYTICS_EVENTS.search_used, {
      source: "jobs_page",
      search_scope: "global",
      query_length: query.length,
    });
    trackFeatureEvent(ANALYTICS_EVENTS.filter_used, {
      source: "jobs_page",
      filter_type: "search",
      value_length: query.length,
      has_value: query.length > 0,
    });
    setSearchQuery(query);
    setPage(1);
  }

  function handleSort(field: SortField) {
    const nextOrder: SortOrder =
      field === sortBy
        ? sortOrder === "asc"
          ? "desc"
          : "asc"
        : field === "date_saved" || field === "applied_at"
          ? "desc"
          : "asc";

    if (field === sortBy) {
      setSortOrder(nextOrder);
    } else {
      setSortBy(field);
      setSortOrder(nextOrder);
    }

    trackFeatureEvent(ANALYTICS_EVENTS.sort_changed, {
      source: "jobs_table",
      sort_field: field,
      sort_order: nextOrder,
    });
    setPage(1);
  }

  function openEdit(job: Record<string, unknown>) {
    setEditing(job);
    const rawDate = String(job.date_saved ?? "");
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : rawDate && rawDate.length >= 10
        ? rawDate.slice(0, 10)
        : "";
    setEditForm({
      date_saved: dateOnly,
      role: String(job.role ?? ""),
      company: String(job.company ?? ""),
      location_raw: String(job.location_raw ?? ""),
      job_link: String(job.job_link ?? ""),
      job_application_id: String((job as any).job_application_id ?? ""),
      oa_deadline_date: String((job as any).oa_deadline_date ?? ""),
      keyword_matching:
        String((job as any).keyword_matching ?? "Medium").trim().toLowerCase() === "week"
          ? "Weak"
          : String((job as any).keyword_matching ?? "Medium"),
      oa_status: normalizeOaStatus((job as any).oa_status),
      referral_status: normalizeReferralStatus(job.referral_status),
      referred_by_name: String((job as any).referred_by_name ?? ""),
      response_status: String(job.response_status ?? ""),
      application_status: String(job.application_status ?? "Applied"),
      notes: String(job.notes ?? ""),
    });
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const editId = editing?.id;
    if (typeof editId !== "number" && typeof editId !== "string") return;
    try {
      setIsSaving(true);
      await updateJob(editId, {
        date_saved: editForm.date_saved || undefined,
        role: editForm.role.trim() || undefined,
        company: editForm.company.trim() || undefined,
        location_raw: editForm.location_raw.trim() || undefined,
        job_link: editForm.job_link.trim() || undefined,
        job_application_id: editForm.job_application_id.trim() || undefined,
        oa_deadline_date: editForm.oa_deadline_date || undefined,
        keyword_matching: editForm.keyword_matching || undefined,
        oa_status: editForm.oa_status || undefined,
        referral_status: editForm.referral_status.trim() || undefined,
        referred_by_name: editForm.referred_by_name.trim() || undefined,
        response_status: editForm.response_status.trim() || undefined,
        application_status: editForm.application_status.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setEditing(null);

      if (statusFilter === "rejected") {
        await load();
      } else {
        await Promise.all([loadActiveCards(), loadActiveReferrals(), loadActiveInsights()]);
      }

      trackProductEvent(ANALYTICS_EVENTS.application_updated, {
        source: "jobs_edit_modal",
        update_type: "form_save",
      });
    } catch (e) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "jobs_edit_modal",
        error_type: "application_update_failed",
      });
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  const sortedData = useMemo(() => {
    if (!data.length) return data;
    const useArchiveDate = statusFilter === "rejected";
    return [...data].sort((a, b) => compareJobs(a, b, sortBy, sortOrder, useArchiveDate));
  }, [data, sortBy, sortOrder, statusFilter]);

  const chartData = useMemo(() => {
    const trendRows = trendData.map((row) => ({
      ...row,
      dayLabel: formatDayShort(row.day),
      fullDate: row.day,
      hasRejection: row.rejected > 0,
    }));

    const maxApplied = Math.max(...trendRows.map((d) => d.applied), 0);
    const maxAppliedDay = trendRows.find((d) => d.applied === maxApplied);
    const maxRejected = Math.max(...trendRows.map((d) => d.rejected), 0);
    const maxRejectedDay = trendRows.find((d) => d.rejected === maxRejected);
    const rejectionDays = trendRows.filter((d) => d.rejected > 0);

    return {
      data: trendRows,
      insights: {
        maxApplied: maxAppliedDay ? { day: maxAppliedDay.dayLabel, value: maxApplied, index: trendRows.indexOf(maxAppliedDay) } : null,
        maxRejected: maxRejectedDay ? { day: maxRejectedDay.dayLabel, value: maxRejected, index: trendRows.indexOf(maxRejectedDay) } : null,
        rejectionDays: rejectionDays.map((d) => ({ day: d.dayLabel, value: d.rejected, index: trendRows.indexOf(d) })),
      },
    };
  }, [trendData]);

  const hasNext = page * LIMIT < totalRows;
  const hasPrev = page > 1;
  const totalPages = Math.max(1, Math.ceil(totalRows / LIMIT));

  const totalCardPages = Math.max(1, Math.ceil(activeCardsTotal / CARD_LIMIT));
  const safeCardPage = Math.min(cardPage, totalCardPages);
  const cardStartIndex = (safeCardPage - 1) * CARD_LIMIT;
  const hasCardPrev = safeCardPage > 1;
  const hasCardNext = safeCardPage < totalCardPages;
  const cardPaginationItems = useMemo(
    () => buildPaginationItems(safeCardPage, totalCardPages),
    [safeCardPage, totalCardPages],
  );

  useEffect(() => {
    if (cardPage !== safeCardPage) setCardPage(safeCardPage);
  }, [cardPage, safeCardPage]);

  async function onDelete(job: Record<string, unknown>) {
    const id = job.id as number | string | undefined;
    if (id === undefined || id === null) return;
    const company = String(job.company ?? "").trim();
    const role = String(job.role ?? "").trim();
    const label = [company, role].filter(Boolean).join(" — ");
    const confirmed = await confirm({
      title: "Delete Application",
      message: `You're going to delete this application${label ? ` (${label})` : ""}. This cannot be undone.`,
      confirmText: "Confirm Delete",
      cancelText: "No, Keep it",
    });
    if (!confirmed) return;
    try {
      setError("");
      setDeletingId(id);
      await deleteJob(id);
      if (editing && (editing.id as number | string | undefined) === id) {
        setEditing(null);
      }
      if (statusFilter === "rejected") {
        await load();
      } else {
        await Promise.all([loadActiveCards(), loadActiveInsights()]);
      }
      trackProductEvent(ANALYTICS_EVENTS.application_deleted, {
        source: "jobs_table",
      });
    } catch (e) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "jobs_table",
        error_type: "application_delete_failed",
      });
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function onDeleteFromEditModal() {
    if (!editing) return;
    await onDelete(editing);
  }

  async function onArchive(job: Record<string, unknown>) {
    const id = job.id as number | string | undefined;
    if (id === undefined || id === null) return;
    const company = String(job.company ?? "").trim();
    const role = String(job.role ?? "").trim();
    const label = [company, role].filter(Boolean).join(" — ");
    const confirmed = await confirm({
      title: "Archive Application",
      message: `Move this application${label ? ` (${label})` : ""} to Archive?`,
      confirmText: "Confirm Archive",
      cancelText: "No, Keep it",
    });
    if (!confirmed) return;
    try {
      setError("");
      setArchivingId(id);
      await updateJob(id, { application_status: "Rejected" });
      if (statusFilter === "rejected") {
        await load();
      } else {
        await Promise.all([loadActiveCards(), loadActiveInsights()]);
      }
      trackProductEvent(ANALYTICS_EVENTS.application_updated, {
        source: "jobs_table",
        update_type: "status_change",
        next_status: "rejected",
      });
    } catch (e) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "jobs_table",
        error_type: "application_archive_failed",
      });
      setError((e as Error).message);
    } finally {
      setArchivingId(null);
    }
  }

  function openCardLink(card: ActiveCard) {
    const href = card.jobLink.trim();
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function openCardEdit(card: ActiveCard) {
    openEdit(card.raw);
  }

  function openAddReferralModal() {
    setAddReferralError("");
    setAddReferralForm({ name: "", company: "", role: "" });
    setShowAddReferralModal(true);
  }

  function closeAddReferralModal() {
    if (isAddingReferral) return;
    setShowAddReferralModal(false);
  }

  async function onCreateReferralFromPanel(e: React.FormEvent) {
    e.preventDefault();
    const company = addReferralForm.company.trim();
    if (!company) {
      setAddReferralError("Company is required.");
      return;
    }

    try {
      setAddReferralError("");
      setIsAddingReferral(true);
      await createReferral({
        company,
        request_log: addReferralForm.role.trim() || undefined,
        request_date: getLocalISODate(),
        referral_received: "Requested",
        keyword_matching: "Medium",
        referred_by_name: addReferralForm.name.trim() || undefined,
      });
      setShowAddReferralModal(false);
      await Promise.all([loadActiveReferrals(), loadActiveCards()]);
    } catch (err) {
      setAddReferralError((err as Error).message);
    } finally {
      setIsAddingReferral(false);
    }
  }

  if (statusFilter !== "rejected") {
    return (
      <>
        <ActiveJobsBoard
          cardsError={activeCardsError}
          confirmDialog={confirmDialog}
          searchInputRef={searchInputRef}
          cardSearch={cardSearch}
          setCardSearch={setCardSearch}
          cardTimeRange={cardTimeRange}
          setCardTimeRange={setCardTimeRange}
          cardReferralFilter={cardReferralFilter}
          setCardReferralFilter={setCardReferralFilter}
          cardOaFilter={cardOaFilter}
          setCardOaFilter={setCardOaFilter}
          cardStatusFilter={cardStatusFilter}
          setCardStatusFilter={setCardStatusFilter}
          cardStageFilter={cardStageFilter}
          setCardStageFilter={setCardStageFilter}
          setCardPage={setCardPage}
          referralSearch={referralSearch}
          setReferralSearch={setReferralSearch}
          activeSmartView={activeSmartView}
          setActiveSmartView={setActiveSmartView}
          applyDefaultCardFilters={applyDefaultCardFilters}
          applyInterviewScenario={applyInterviewScenario}
          applyReferralScenario={applyReferralScenario}
          clearCardFilters={clearCardFilters}
          isLoadingCards={isLoadingActiveCards}
          filteredReferralRows={activeReferrals}
          isLoadingReferrals={isLoadingActiveReferrals}
          referralError={activeReferralsError}
          totalReferralCount={activeReferralTotal}
          onAddReferral={openAddReferralModal}
          filteredSampleCardsLength={activeCardsTotal}
          pagedSampleCards={activeCards}
          cardStartIndex={cardStartIndex}
          hasCardPrev={hasCardPrev}
          hasCardNext={hasCardNext}
          cardPaginationItems={cardPaginationItems}
          safeCardPage={safeCardPage}
          totalCardPages={totalCardPages}
          archivingId={archivingId}
          openCardLink={openCardLink}
          openCardEdit={openCardEdit}
          onArchiveCard={(card) => onArchive(card.raw)}
          weeklyCounts={activeInsights.weeklyCounts}
          totalApplications={activeInsights.totalApplications}
          averagePerWeek={activeInsights.averagePerWeek}
          peakWeekLabel={activeInsights.peakWeekLabel}
          isLoadingKpi={isLoadingActiveInsights}
          kpiError={activeInsightsError}
          currentWeekDailyCounts={activeInsights.currentWeekDailyCounts}
          thisWeekTotal={activeInsights.thisWeekTotal}
          previousWeekTotal={activeInsights.previousWeekTotal}
          bestDay={activeInsights.bestDay}
          targetCount={activeInsights.targetCount}
          targetProgressPercent={activeInsights.targetProgressPercent}
          isLoadingSummary={isLoadingActiveInsights}
          summaryError={activeInsightsError}
        />

        <EditJobModal
          editing={editing}
          isSaving={isSaving}
          isDeleting={deletingId != null && editing != null && deletingId === (editing.id as number | string | undefined)}
          editForm={editForm}
          setEditing={setEditing}
          setEditForm={setEditForm}
          onSaveEdit={onSaveEdit}
          onDeleteEdit={onDeleteFromEditModal}
        />

        <AddReferralModal
          open={showAddReferralModal}
          isSaving={isAddingReferral}
          error={addReferralError}
          form={addReferralForm}
          setForm={setAddReferralForm}
          onClose={closeAddReferralModal}
          onSubmit={onCreateReferralFromPanel}
        />
      </>
    );
  }

  function openOaEdit(row: Record<string, unknown>) {
    setOaEditing(row);
    setOaEditForm({
      role: String(row.role ?? ""),
      company: String(row.company ?? ""),
      location_raw: String(row.location_raw ?? ""),
      job_link: String(row.job_link ?? ""),
      job_application_id: String(row.job_application_id ?? ""),
      oa_deadline_date: String(row.oa_deadline_date ?? ""),
      keyword_matching:
        String(row.keyword_matching ?? "Medium").trim().toLowerCase() === "week"
          ? "Weak"
          : String(row.keyword_matching ?? "Medium"),
      oa_status: normalizeOaStatus(row.oa_status),
      referral_status: normalizeReferralStatus(row.referral_status),
      response_status: String(row.response_status ?? ""),
      application_status: String(row.application_status ?? "Applied"),
      notes: String(row.notes ?? ""),
      date_saved: String(row.date_saved ?? "").slice(0, 10),
      oa_result: getOaResultLabel(row),
      oa_result_date: String((row as any).oa_result_date ?? row.oa_completed_date ?? "").slice(0, 10),
      oa_completed_date: String(row.oa_completed_date ?? "").slice(0, 10),
    });
  }

  async function onSaveOaEdit(e: React.FormEvent) {
    e.preventDefault();
    const oaEditId = oaEditing?.id;
    if (typeof oaEditId !== "number" && typeof oaEditId !== "string") return;
    try {
      setIsOaSaving(true);
      setOaArchiveError("");
      await updateOaArchive(oaEditId, {
        role: oaEditForm.role.trim() || null,
        company: oaEditForm.company.trim() || null,
        location_raw: oaEditForm.location_raw.trim() || null,
        job_link: oaEditForm.job_link.trim() || null,
        job_application_id: oaEditForm.job_application_id.trim() || null,
        oa_deadline_date: oaEditForm.oa_deadline_date || null,
        keyword_matching: oaEditForm.keyword_matching || null,
        oa_status: oaEditForm.oa_status || null,
        referral_status: oaEditForm.referral_status.trim() || null,
        response_status: oaEditForm.response_status.trim() || null,
        application_status: oaEditForm.application_status.trim() || null,
        notes: oaEditForm.notes.trim() || null,
        date_saved: oaEditForm.date_saved || null,
        oa_result: oaEditForm.oa_result || null,
        oa_result_date: oaEditForm.oa_result_date || null,
        oa_completed_date: oaEditForm.oa_completed_date || null,
      });
      setOaEditing(null);
      await loadOaArchive();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setOaArchiveError((e as Error).message);
    } finally {
      setIsOaSaving(false);
    }
  }

  async function onDeleteOaRecord(row: Record<string, unknown>) {
    const id = row.id as number | string | undefined;
    if (id == null) return;
    const company = String(row.company ?? "").trim();
    const role = String(row.role ?? "").trim();
    const label = [company, role].filter(Boolean).join(" — ");
    const confirmed = await confirm({
      title: "Delete OA Record",
      message: `You're going to delete this OA archive record${label ? ` (${label})` : ""}. This cannot be undone.`,
      confirmText: "Confirm Delete",
      cancelText: "No, Keep it",
    });
    if (!confirmed) return;
    try {
      setOaDeletingId(id);
      setOaArchiveError("");
      await deleteOaArchive(id);
      await loadOaArchive();
    } catch (e) {
      setOaArchiveError((e as Error).message);
    } finally {
      setOaDeletingId(null);
    }
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      <JobsTrendCharts
        statusFilter={statusFilter}
        isLoadingTrend={isLoadingTrend}
        chartData={chartData}
      />

      <JobsTable
        isLoading={isLoading}
        data={data}
        sortedData={sortedData}
        page={page}
        limit={LIMIT}
        totalPages={totalPages}
        totalRows={totalRows}
        hasPrev={hasPrev}
        hasNext={hasNext}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortConfig={BASE_SORT_CONFIG}
        searchInput={searchInput}
        statusFilter={statusFilter}
        archivingId={archivingId}
        deletingId={deletingId}
        setSearchInput={setSearchInput}
        setPage={setPage}
        onSearch={onSearch}
        handleSort={handleSort}
        openEdit={openEdit}
        onArchive={onArchive}
        onDelete={onDelete}
        getStatusMeta={getStatusMeta}
        getKeywordMeta={getKeywordMeta}
        capitalizeFirst={capitalizeFirst}
        normalizeReferralStatus={normalizeReferralStatus}
        normalizeOaStatus={normalizeOaStatus}
      />

      <OaArchiveTable
        statusFilter={statusFilter}
        oaArchiveError={oaArchiveError}
        oaArchiveLoading={oaArchiveLoading}
        oaArchiveData={oaArchiveData}
        oaDeletingId={oaDeletingId}
        openOaEdit={openOaEdit}
        onDeleteOaRecord={onDeleteOaRecord}
        capitalizeFirst={capitalizeFirst}
        normalizeOaStatus={normalizeOaStatus}
      />

      <EditJobModal
        editing={editing}
        isSaving={isSaving}
        isDeleting={deletingId != null && editing != null && deletingId === (editing.id as number | string | undefined)}
        editForm={editForm}
        setEditing={setEditing}
        setEditForm={setEditForm}
        onSaveEdit={onSaveEdit}
        onDeleteEdit={onDeleteFromEditModal}
      />

      <EditOaModal
        oaEditing={oaEditing}
        isOaSaving={isOaSaving}
        oaEditForm={oaEditForm}
        setOaEditing={setOaEditing}
        setOaEditForm={setOaEditForm}
        onSaveOaEdit={onSaveOaEdit}
      />
      {confirmDialog}
    </>
  );
}
