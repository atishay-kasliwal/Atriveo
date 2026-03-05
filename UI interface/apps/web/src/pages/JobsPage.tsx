import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Spinner from "../components/Spinner";
import { formatTableDateTime } from "../lib/formatDate";
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

const LIMIT = 25;
const REFERRAL_OPTIONS = ["", "Requested", "Yes", "No"];

function normalizeReferralStatus(value: unknown): "Requested" | "Yes" | "No" | "" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "requested") return "Requested";
  if (raw === "yes") return "Yes";
  return "No";
}

function normalizeOaStatus(value: unknown): "Yes" | "No" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "pending" || raw === "completed" || raw === "complete" || raw === "done" || raw === "missed" || raw === "missing" || raw === "overdue") return "Yes";
  return "No";
}

function getOaResultLabel(row: Record<string, unknown>): "Pending" | "Completed" | "Missed" {
  const explicit = String((row as any).oa_result ?? "").trim();
  if (explicit === "Pending") return "Pending";
  if (explicit === "Missed") return "Missed";
  if (explicit === "Completed") return "Completed";
  const source = String(row.source ?? "").toLowerCase();
  if (source.includes("missed")) return "Missed";
  const deadline = String(row.oa_deadline_date ?? "").trim();
  if (deadline) {
    const d = new Date(`${deadline}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return "Missed";
    }
  }
  return "Completed";
}

type SortField = "date_saved" | "applied_at" | "company" | "role" | "referral_status" | "job_link";
type SortOrder = "asc" | "desc";

const BASE_SORT_CONFIG: { key: SortField; label: string }[] = [
  { key: "applied_at", label: "Applied At" },
  { key: "company", label: "Company" },
  { key: "role", label: "Position" },
  { key: "referral_status", label: "Referral" },
  { key: "job_link", label: "Link" },
];

function compareJobs(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  field: SortField,
  order: SortOrder,
  useArchiveDate: boolean,
): number {
  const avRaw = a[field];
  const bvRaw = b[field];
  const av =
    field === "date_saved" && useArchiveDate
      ? // prefer archive_date when present for archive view
        ((a as any).archive_date ?? avRaw)
      : avRaw;
  const bv =
    field === "date_saved" && useArchiveDate
      ? ((b as any).archive_date ?? bvRaw)
      : bvRaw;
  const empty = (v: unknown) => v == null || v === "";
  if (empty(av) && empty(bv)) return 0;
  if (empty(av)) return order === "asc" ? 1 : -1;
  if (empty(bv)) return order === "asc" ? -1 : 1;
  if (field === "date_saved" || field === "applied_at") {
    const da = new Date(String(av)).getTime();
    const db = new Date(String(bv)).getTime();
    return order === "asc" ? da - db : db - da;
  }
  const sa = String(av).toLowerCase();
  const sb = String(bv).toLowerCase();
  const cmp = sa.localeCompare(sb);
  return order === "asc" ? cmp : -cmp;
}

// Theme-aware chart tokens used only on Jobs page charts.
const CHART_COLORS = {
  applied: "#2563eb",
  rejected: "#f59e0b",
  grid: "var(--chart-grid)",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  axis: "var(--chart-axis)",
  text: "var(--chart-text)",
  textSecondary: "var(--chart-text-secondary)",
};

function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
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

export default function JobsPage({ statusFilter }: { statusFilter?: string } = {}) {
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [company, setCompany] = useState("");
  const [searchInput, setSearchInput] = useState("");
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

  const load = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      const res = await getJobs({
        page,
        limit: LIMIT,
        company: company || undefined,
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
  }, [page, company, sortBy, sortOrder, statusFilter]);

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

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = searchInput.trim();
    trackFeatureEvent(ANALYTICS_EVENTS.search_used, {
      source: "jobs_page",
      search_scope: "company",
      query_length: query.length,
    });
    trackFeatureEvent(ANALYTICS_EVENTS.filter_used, {
      source: "jobs_page",
      filter_type: "company",
      value_length: query.length,
      has_value: query.length > 0,
    });
    setCompany(query);
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
      job_application_id: String((job as any).job_application_id ?? "-"),
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
    if (!editing?.id) return;
    try {
      setIsSaving(true);
      await updateJob(editing.id, {
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
    const confirmed = window.confirm(
      `Delete this job${label ? ` (${label})` : ""}? This action cannot be undone.`,
    );
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
    const confirmed = window.confirm(
      `Archive this application${label ? ` (${label})` : ""}? It will move to Archive.`,
    );
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

  function getStatusMeta(raw: string) {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "rejected") return { label: "Rejected", cls: "status-chip status-chip--rejected" };
    if (value === "under consideration") return { label: "Under review", cls: "status-chip status-chip--review" };
    if (value === "open") return { label: "Open", cls: "status-chip status-chip--open" };
    return { label: raw || "Applied", cls: "status-chip status-chip--applied" };
  }

  function getKeywordMeta(raw: string) {
    const value = String(raw || "Medium").trim().toLowerCase();
    if (value === "strong") return { label: "Strong", cls: "" };
    if (value === "weak" || value === "week") return { label: "Weak", cls: "" };
    return { label: "Medium", cls: "" };
  }

  function capitalizeFirst(value: string) {
    if (!value) return value;
    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
    if (!oaEditing?.id) return;
    try {
      setIsOaSaving(true);
      setOaArchiveError("");
      await updateOaArchive(oaEditing.id, {
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
    const confirmed = window.confirm(
      `Delete OA archive record${label ? ` (${label})` : ""}? This action cannot be undone.`,
    );
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

      {/* Application Momentum Chart - Single Unified View (only for active jobs) */}
      {statusFilter !== "rejected" && (
        <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
          <div className="trend-uniform-head">
            <h2>Application Momentum</h2>
            <p>Last 30 days • Applications with rejection context</p>
          </div>
          <div className="trend-uniform-body">
            {isLoadingTrend ? (
              <div className="trend-uniform-loading">
                <Spinner />
              </div>
            ) : !chartData.data || chartData.data.length === 0 ? (
              <div className="chart-empty">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  data={chartData.data}
                  margin={{ top: 20, right: 24, left: 8, bottom: 24 }}
                  barCategoryGap="14%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dayLabel"
                    stroke={CHART_COLORS.axis}
                    tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                    axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                    tickLine={false}
                    height={32}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                    axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                    tickLine={false}
                    allowDecimals={false}
                    width={40}
                    label={{ value: "Count", angle: -90, position: "insideLeft", fill: CHART_COLORS.textSecondary, fontSize: 11, style: { textAnchor: "middle" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                    }}
                    cursor={false}
                    formatter={(value: number, name: string) => {
                      if (name === "applied") {
                        return [`${value}`, "Applied"];
                      }
                      if (name === "rejected") {
                        return [`${value}`, "Rejected"];
                      }
                      return [value, name];
                    }}
                    labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                    itemStyle={{ fontSize: 13, fontWeight: 600 }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar
                    dataKey="rejected"
                    fill={CHART_COLORS.rejected}
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                    label={{
                      position: "top",
                      fill: CHART_COLORS.textSecondary,
                      fontSize: 9,
                      fontWeight: 400,
                      formatter: (value: number) => (value > 0 ? String(value) : ""),
                    }}
                  >
                    {chartData.data.map((entry, index) => {
                      const hasRejection = entry.rejected > 0;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS.rejected}
                          style={hasRejection ? { opacity: 1 } : { opacity: 0.3 }}
                        />
                      );
                    })}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="applied"
                    stroke={CHART_COLORS.applied}
                    strokeWidth={2}
                    dot={{
                      r: 2,
                      fill: CHART_COLORS.applied,
                      strokeWidth: 0,
                      opacity: 0.85,
                    }}
                    activeDot={false}
                    connectNulls={false}
                    strokeDasharray="0"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="trend-uniform-foot">
            <span className="trend-uniform-foot-item trend-uniform-foot-item--applied">
              {chartData.insights.maxApplied
                ? `Peak: ${chartData.insights.maxApplied.value} applications on ${chartData.insights.maxApplied.day}`
                : "Peak: -"}
            </span>
            <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
              • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Rejected Jobs Chart - Last 30 Days (only for archive tab) */}
      {statusFilter === "rejected" && (
        <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
          <div className="trend-uniform-head">
            <h2>Rejected Jobs Trend</h2>
            <p>Last 30 days • Daily rejected applications</p>
          </div>
          <div className="trend-uniform-body">
            {isLoadingTrend ? (
              <div className="trend-uniform-loading">
                <Spinner />
              </div>
            ) : !chartData.data || chartData.data.length === 0 ? (
              <div className="chart-empty">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={chartData.data}
                  margin={{ top: 20, right: 24, left: 8, bottom: 24 }}
                  barCategoryGap="14%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dayLabel"
                    stroke={CHART_COLORS.axis}
                    tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                    axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                    tickLine={false}
                    height={32}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke={CHART_COLORS.axis}
                    tick={{ fill: CHART_COLORS.textSecondary, fontSize: 10, fontWeight: 400 }}
                    axisLine={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                    tickLine={false}
                    allowDecimals={false}
                    width={40}
                    label={{ value: "Rejected", angle: -90, position: "insideLeft", fill: CHART_COLORS.textSecondary, fontSize: 11, style: { textAnchor: "middle" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                    }}
                    cursor={false}
                    labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                    itemStyle={{ fontSize: 13, fontWeight: 600, color: CHART_COLORS.rejected }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [`${value}`, "Rejected"]}
                  />
                  <Bar
                    dataKey="rejected"
                    fill={CHART_COLORS.rejected}
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                    label={{
                      position: "top",
                      fill: CHART_COLORS.textSecondary,
                      fontSize: 9,
                      fontWeight: 400,
                      formatter: (value: number) => (value > 0 ? String(value) : ""),
                    }}
                  >
                    {chartData.data.map((entry, index) => {
                      const hasRejection = entry.rejected > 0;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS.rejected}
                          style={hasRejection ? { opacity: 1 } : { opacity: 0.3 }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="trend-uniform-foot">
            <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
              {chartData.insights.maxRejected
                ? `Peak: ${chartData.insights.maxRejected.value} rejections on ${chartData.insights.maxRejected.day}`
                : "Peak: -"}
            </span>
            <span className="trend-uniform-foot-item trend-uniform-foot-item--muted">
              • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: "24px" }}>
        <div className="jobs-header">
          <h2>Jobs</h2>
          <form className="jobs-search-row" onSubmit={onSearch}>
            <input
              className="jobs-search-input"
              type="search"
              placeholder="Search by company"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search by company"
            />
            <button type="submit" className="jobs-search-btn">Search</button>
          </form>
        </div>

        {isLoading ? (
          <Spinner />
        ) : data.length === 0 ? (
          <div className="empty-state">
            No jobs found. Add one from the Dashboard.
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSort("applied_at");
                        }}
                        title={sortBy === "applied_at" ? `${sortOrder === "asc" ? "A→Z" : "Z→A"} (click to reverse)` : "Sort by Applied At"}
                      >
                        {sortConfig.find((c) => c.key === "applied_at")?.label ?? "Applied At"}
                        {sortBy === "applied_at" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSort("company");
                        }}
                        title="Sort by Company / Position"
                      >
                        Company / Position
                        {sortBy === "company" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSort("referral_status");
                        }}
                        title="Sort by Referral"
                      >
                        Referral
                        {sortBy === "referral_status" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
                    <th>Referral Name</th>
                    <th>Keyword Match</th>
                    <th>OA</th>
                    <th>OA Deadline</th>
                    <th>Job/App ID</th>
                    <th>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSort("job_link");
                        }}
                        title="Sort by Link"
                      >
                        Link
                        {sortBy === "job_link" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
                    <th>Application Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((j, idx) => (
                    <tr
                      key={String(j.id)}
                      className={`tr-hover ${normalizeReferralStatus(j.referral_status) === "Yes" ? "data-referral" : ""} ${
                        String(j.application_status ?? "") === "Rejected" ? "data-rejected" : ""
                      } ${normalizeReferralStatus(j.referral_status) === "No" ? "data-no" : ""
                      }`}
                    >
                      <td className="jobs-col-no">{(page - 1) * LIMIT + idx + 1}</td>
                      <td>
                        {formatTableDateTime(
                          (j as any).applied_at
                            ? (j as any).applied_at
                            : (statusFilter === "rejected" ? ((j as any).archive_date ?? j.date_saved) : j.date_saved),
                        )}
                      </td>
                      <td>
                        <div className="job-main">
                        <div className="job-company">{capitalizeFirst(String(j.company ?? "-"))}</div>
                          <div className="job-role" title={String(j.role ?? "-")}>
                            {String(j.role ?? "-")}
                          </div>
                        </div>
                      </td>
                      <td>{normalizeReferralStatus(j.referral_status) || "-"}</td>
                      <td>{String((j as any).referred_by_name ?? "-") || "-"}</td>
                      <td>
                        <span className={getKeywordMeta(String((j as any).keyword_matching ?? "Medium")).cls}>
                          {getKeywordMeta(String((j as any).keyword_matching ?? "Medium")).label}
                        </span>
                      </td>
                      <td>{normalizeOaStatus((j as any).oa_status)}</td>
                      <td>{String((j as any).oa_deadline_date ?? "-") || "-"}</td>
                      <td>{String((j as any).job_application_id ?? "-")}</td>
                      <td>
                        {j.job_link ? (
                          <a
                            href={String(j.job_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-link"
                          >
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className={getStatusMeta(String(j.application_status ?? "Applied")).cls}>
                          {getStatusMeta(String(j.application_status ?? "Applied")).label}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="action-btn" onClick={() => openEdit(j)}>
                            Edit
                          </button>
                          {statusFilter !== "rejected" ? (
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => onArchive(j)}
                              disabled={archivingId === j.id}
                              title="Archive application"
                              aria-label="Archive application"
                            >
                              {archivingId === j.id ? "…" : "Archive"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => onDelete(j)}
                            disabled={deletingId === j.id}
                            aria-label="Delete job"
                          >
                            {deletingId === j.id ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button type="button" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
                Prev
              </button>
              <span>Page {page} of {totalPages} • {totalRows} total</span>
              <button type="button" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {statusFilter === "rejected" ? (
        <div className="card" style={{ padding: "24px", marginTop: "20px" }}>
          <div className="jobs-header">
            <h2>Online Assessment Records</h2>
            <p className="chart-subtitle">Completed and missed OA archive</p>
          </div>
          {oaArchiveError ? <div className="error">{oaArchiveError}</div> : null}
          {oaArchiveLoading ? (
            <Spinner />
          ) : oaArchiveData.length === 0 ? (
            <div className="empty-state">No OA records yet. Mark "OA Done" from Dashboard to add records.</div>
          ) : (
            <div className="table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Record Date</th>
                    <th>Status</th>
                    <th>Company / Position</th>
                    <th>OA Deadline</th>
                    <th>Job/App ID</th>
                    <th>OA</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {oaArchiveData.map((row, idx) => (
                    <tr key={`oa-archive-${String(row.id)}`} className="tr-hover">
                      <td className="jobs-col-no">{idx + 1}</td>
                      <td>{formatTableDateTime((row as any).oa_result_date ?? row.oa_completed_date)}</td>
                      <td>{getOaResultLabel(row)}</td>
                      <td>
                        <div className="job-main">
                          <div className="job-company">{capitalizeFirst(String(row.company ?? "-"))}</div>
                          <div className="job-role" title={String(row.role ?? "-")}>
                            {String(row.role ?? "-")}
                          </div>
                        </div>
                      </td>
                      <td>{String(row.oa_deadline_date ?? "-") || "-"}</td>
                      <td>{String(row.job_application_id ?? "-") || "-"}</td>
                      <td>{normalizeOaStatus(row.oa_status)}</td>
                      <td>
                        {row.job_link ? (
                          <a
                            href={String(row.job_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-link"
                          >
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="action-btn" onClick={() => openOaEdit(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => onDeleteOaRecord(row)}
                            disabled={oaDeletingId === row.id}
                          >
                            {oaDeletingId === row.id ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {editing && (
        <div className="modal-overlay" onClick={() => !isSaving && setEditing(null)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-x"
              aria-label="Close"
              onClick={() => !isSaving && setEditing(null)}
              disabled={isSaving}
            >
              ×
            </button>
            <h3>Edit Job</h3>
            <form className="form form--quickadd" onSubmit={onSaveEdit}>
              <div className="qa-left">
                <input
                  placeholder="Position *"
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  autoFocus
                />
                <div className="form-row">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={editForm.date_saved}
                    onChange={(e) => setEditForm((p) => ({ ...p, date_saved: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={editForm.location_raw}
                  onChange={(e) => setEditForm((p) => ({ ...p, location_raw: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral</label>
                  <select
                    value={editForm.referral_status}
                    onChange={(e) => setEditForm((p) => ({ ...p, referral_status: e.target.value }))}
                    className="form-select"
                  >
                    {REFERRAL_OPTIONS.map((opt) => (
                      <option key={opt || "empty"} value={opt}>{opt || "—"}</option>
                    ))}
                  </select>
                </div>
                {editForm.referral_status === "Requested" && (
                  <p className="referral-hint">
                    Track requested referrals on the <Link to="/referrals" className="table-link">Referrals</Link> page.
                  </p>
                )}
                {editForm.referral_status === "Yes" && (
                  <p className="referral-hint">
                    Ensure this company has an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page.
                  </p>
                )}
                <input
                  placeholder="Referral name (optional)"
                  value={editForm.referred_by_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, referred_by_name: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Application Status</label>
                  <select
                    value={editForm.application_status}
                    onChange={(e) => setEditForm((p) => ({ ...p, application_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Under consideration">Under consideration</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <input
                  placeholder="Response status"
                  value={editForm.response_status}
                  onChange={(e) => setEditForm((p) => ({ ...p, response_status: e.target.value }))}
                />
                <textarea
                  placeholder="Notes"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  placeholder="Company *"
                  value={editForm.company}
                  onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                />
                <input
                  placeholder="Job link (URL)"
                  type="url"
                  value={editForm.job_link}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_link: e.target.value }))}
                />
                <input
                  placeholder="Job/Application ID (optional)"
                  value={editForm.job_application_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_application_id: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">OA Deadline (optional)</label>
                  <input
                    type="date"
                    value={editForm.oa_deadline_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Online Assessment (OA)</label>
                  <select
                    value={editForm.oa_status}
                    onChange={(e) => setEditForm((p) => ({ ...p, oa_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    value={editForm.keyword_matching}
                    onChange={(e) => setEditForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                  <p className="form-helper">
                    {editForm.keyword_matching === "Strong"
                      ? "Almost every technical keyword matched"
                      : editForm.keyword_matching === "Medium"
                        ? "Few Keywords are not Present"
                        : "Few Keywords Matched"}
                  </p>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => setEditing(null)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !editForm.role.trim() || !editForm.company.trim()}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {oaEditing && (
        <div className="modal-overlay" onClick={() => !isOaSaving && setOaEditing(null)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-x"
              aria-label="Close"
              onClick={() => !isOaSaving && setOaEditing(null)}
              disabled={isOaSaving}
            >
              ×
            </button>
            <h3>Edit OA Record</h3>
            <form className="form form--quickadd" onSubmit={onSaveOaEdit}>
              <div className="qa-left">
                <input
                  placeholder="Position"
                  value={oaEditForm.role}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, role: e.target.value }))}
                  autoFocus
                />
                <div className="form-row">
                  <label className="form-label">Date Saved</label>
                  <input
                    type="date"
                    value={oaEditForm.date_saved}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, date_saved: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={oaEditForm.location_raw}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, location_raw: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral</label>
                  <select
                    value={oaEditForm.referral_status}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, referral_status: e.target.value }))}
                    className="form-select"
                  >
                    {REFERRAL_OPTIONS.map((opt) => (
                      <option key={`oa-ref-${opt || "empty"}`} value={opt}>{opt || "—"}</option>
                    ))}
                  </select>
                </div>
                {oaEditForm.referral_status === "Yes" && (
                  <p className="referral-hint">
                    Ensure this company has an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page.
                  </p>
                )}
                <div className="form-row">
                  <label className="form-label">Application Status</label>
                  <select
                    value={oaEditForm.application_status}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, application_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Under consideration">Under consideration</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <input
                  placeholder="Response status"
                  value={oaEditForm.response_status}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, response_status: e.target.value }))}
                />
                <textarea
                  placeholder="Notes"
                  rows={3}
                  value={oaEditForm.notes}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  placeholder="Company"
                  value={oaEditForm.company}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, company: e.target.value }))}
                />
                <input
                  placeholder="Job link (URL)"
                  type="url"
                  value={oaEditForm.job_link}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, job_link: e.target.value }))}
                />
                <input
                  placeholder="Job/Application ID"
                  value={oaEditForm.job_application_id}
                  onChange={(e) => setOaEditForm((p) => ({ ...p, job_application_id: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">OA Deadline</label>
                  <input
                    type="date"
                    value={oaEditForm.oa_deadline_date}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Online Assessment (OA)</label>
                  <select
                    value={oaEditForm.oa_status}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, oa_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    value={oaEditForm.keyword_matching}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                </div>
                <details className="form-accordion">
                  <summary>
                    <span>OA Result Details</span>
                    <span className="form-accordion-summary-meta">Status: {oaEditForm.oa_result || "—"}</span>
                  </summary>
                  <div className="form-accordion-grid">
                    <div className="form-row">
                      <label className="form-label">Record Date</label>
                      <input
                        type="date"
                        value={oaEditForm.oa_result_date}
                        onChange={(e) => setOaEditForm((p) => ({ ...p, oa_result_date: e.target.value }))}
                      />
                    </div>
                    <div className="form-row">
                      <label className="form-label">Result Status</label>
                      <select
                        value={oaEditForm.oa_result}
                        onChange={(e) => setOaEditForm((p) => ({ ...p, oa_result: e.target.value }))}
                        className="form-select"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Missed">Missed</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <label className="form-label">OA Completed Date (legacy)</label>
                      <input
                        type="date"
                        value={oaEditForm.oa_completed_date}
                        onChange={(e) => setOaEditForm((p) => ({ ...p, oa_completed_date: e.target.value }))}
                      />
                    </div>
                  </div>
                </details>
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => setOaEditing(null)} disabled={isOaSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isOaSaving}>
                  {isOaSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
