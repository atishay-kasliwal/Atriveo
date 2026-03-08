import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import useConfirmDialog from "../components/ui/useConfirmDialog";
import {
  deleteJob,
  deleteOaArchive,
  getJobs,
  getJobsTrend,
  getOaArchive,
  updateJob,
  updateOaArchive,
  type JobsTrendData,
} from "../lib/api";
import {
  ANALYTICS_EVENTS,
  trackErrorEvent,
  trackFeatureEvent,
  trackProductEvent,
} from "../analytics/events";
import {
  ACTIVE_JOBS_REFERRAL_ROWS,
  ACTIVE_JOBS_SAMPLE_CARDS,
  APPLICATION_PIPELINE_STAGES,
  BASE_SORT_CONFIG,
  CARD_LIMIT,
  LIMIT,
} from "./jobs/constants";
import ActiveJobsBoard from "./jobs/components/ActiveJobsBoard";
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
  const [cardTimeRange, setCardTimeRange] = useState<ToolbarTimeRange>("7");
  const [cardReferralFilter, setCardReferralFilter] = useState<ToolbarBooleanFilter>("yes");
  const [cardOaFilter, setCardOaFilter] = useState<ToolbarBooleanFilter>("yes");
  const [cardStatusFilter, setCardStatusFilter] = useState<ToolbarStatusFilter>("active");
  const [cardStageFilter, setCardStageFilter] = useState<ToolbarStageFilter>("All");
  const [cardPage, setCardPage] = useState(1);
  const [referralSearch, setReferralSearch] = useState("");
  const [activeSmartView, setActiveSmartView] = useState<"default" | "interview" | "referral" | null>("default");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredSampleCards = useMemo(() => {
    const query = cardSearch.trim().toLowerCase();
    const timeDays = cardTimeRange === "all" ? null : Number(cardTimeRange);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return ACTIVE_JOBS_SAMPLE_CARDS.filter((card) => {
      if (query) {
        const haystack = [
          card.company,
          card.role,
          card.owner,
          card.referredBy,
          card.jobId,
          card.statusMessage,
          card.applicationStatus,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (timeDays != null) {
        const applied = new Date(`${card.appliedOn}T00:00:00`);
        if (!Number.isNaN(applied.getTime())) {
          const diffDays = Math.floor((now.getTime() - applied.getTime()) / 86_400_000);
          if (diffDays < 0 || diffDays > timeDays) return false;
        }
      }

      if (cardReferralFilter !== "all") {
        if (cardReferralFilter === "yes" && !card.referralUsed) return false;
        if (cardReferralFilter === "no" && card.referralUsed) return false;
      }

      if (cardOaFilter !== "all") {
        const hasOa = String(card.oaStatus).toLowerCase() === "yes";
        if (cardOaFilter === "yes" && !hasOa) return false;
        if (cardOaFilter === "no" && hasOa) return false;
      }

      if (cardStatusFilter !== "all") {
        const status = String(card.applicationStatus).toLowerCase();
        if (cardStatusFilter === "active" && status === "archive") return false;
        if (cardStatusFilter === "archive" && status !== "archive") return false;
      }

      if (cardStageFilter !== "All") {
        const currentStage = APPLICATION_PIPELINE_STAGES[Math.min(card.progress, APPLICATION_PIPELINE_STAGES.length - 1)];
        if (currentStage !== cardStageFilter) return false;
      }

      return true;
    });
  }, [cardSearch, cardTimeRange, cardReferralFilter, cardOaFilter, cardStatusFilter, cardStageFilter]);

  const filteredReferralRows = useMemo(() => {
    const query = referralSearch.trim().toLowerCase();
    if (!query) return ACTIVE_JOBS_REFERRAL_ROWS;
    return ACTIVE_JOBS_REFERRAL_ROWS.filter((row) =>
      `${row.name} ${row.company} ${row.role}`.toLowerCase().includes(query),
    );
  }, [referralSearch]);

  const totalCardPages = Math.max(1, Math.ceil(filteredSampleCards.length / CARD_LIMIT));
  const safeCardPage = Math.min(cardPage, totalCardPages);
  const pagedSampleCards = useMemo(() => {
    const start = (safeCardPage - 1) * CARD_LIMIT;
    return filteredSampleCards.slice(start, start + CARD_LIMIT);
  }, [filteredSampleCards, safeCardPage]);
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
    setCardReferralFilter("yes");
    setCardOaFilter("yes");
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

  const load = useCallback(async () => {
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
  }, []);

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
    load();
  }, [load]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    if (statusFilter === "rejected") {
      loadOaArchive();
    } else {
      setOaArchiveData([]);
      setOaArchiveError("");
    }
  }, [statusFilter, loadOaArchive]);

  useEffect(() => {
    const onRefresh = () => {
      load();
      loadTrend();
      if (statusFilter === "rejected") loadOaArchive();
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [load, loadTrend, loadOaArchive, statusFilter]);

  useEffect(() => {
    trackFeatureEvent(ANALYTICS_EVENTS.filter_used, {
      source: "jobs_page",
      filter_type: "status",
      filter_value: statusFilter ?? "active",
    });
  }, [statusFilter]);

  useEffect(() => {
    setSearchInput(urlSearchQuery);
    setSearchQuery(urlSearchQuery);
    setPage(1);
  }, [urlSearchQuery]);

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
      setSortOrder(nextOrder); // datetime: newest first; others: A→Z
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
      await load();
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
    const data = trendData.map((row) => ({
      ...row,
      dayLabel: formatDayShort(row.day),
      fullDate: row.day,
      hasRejection: row.rejected > 0, // Flag for annotation
    }));

    // Find insights for annotations
    const maxApplied = Math.max(...data.map((d) => d.applied), 0);
    const maxAppliedDay = data.find((d) => d.applied === maxApplied);
    const maxRejected = Math.max(...data.map((d) => d.rejected), 0);
    const maxRejectedDay = data.find((d) => d.rejected === maxRejected);
    const rejectionDays = data.filter((d) => d.rejected > 0);

    return {
      data,
      insights: {
        maxApplied: maxAppliedDay ? { day: maxAppliedDay.dayLabel, value: maxApplied, index: data.indexOf(maxAppliedDay) } : null,
        maxRejected: maxRejectedDay ? { day: maxRejectedDay.dayLabel, value: maxRejected, index: data.indexOf(maxRejectedDay) } : null,
        rejectionDays: rejectionDays.map((d) => ({ day: d.dayLabel, value: d.rejected, index: data.indexOf(d) })),
      },
    };
  }, [trendData]);

  const hasNext = page * LIMIT < totalRows;
  const hasPrev = page > 1;
  const totalPages = Math.max(1, Math.ceil(totalRows / LIMIT));

  const sortConfig = BASE_SORT_CONFIG;

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
      await load();
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
      await load();
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

  if (statusFilter !== "rejected") {
    return (
      <ActiveJobsBoard
        error={error}
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
        filteredReferralRows={filteredReferralRows}
        filteredSampleCardsLength={filteredSampleCards.length}
        pagedSampleCards={pagedSampleCards}
        cardStartIndex={cardStartIndex}
        hasCardPrev={hasCardPrev}
        hasCardNext={hasCardNext}
        cardPaginationItems={cardPaginationItems}
        safeCardPage={safeCardPage}
        totalCardPages={totalCardPages}
      />
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
        sortConfig={sortConfig}
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
        editForm={editForm}
        setEditing={setEditing}
        setEditForm={setEditForm}
        onSaveEdit={onSaveEdit}
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
