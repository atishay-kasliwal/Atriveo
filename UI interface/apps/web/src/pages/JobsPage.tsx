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
import { formatTableDateTime, formatTableTime } from "../lib/formatDate";
import { deleteJob, getJobs, getJobsTrend, updateJob, type JobsTrendData } from "../lib/api";

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
  return raw === "yes" ? "Yes" : "No";
}

type SortField = "date_saved" | "applied_at" | "company" | "role" | "referral_status" | "job_link";
type SortOrder = "asc" | "desc";

const BASE_SORT_CONFIG: { key: SortField; label: string }[] = [
  { key: "date_saved", label: "Date" },
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

// Executive-level chart design: muted colors, clean typography, minimal noise
const CHART_COLORS = {
  applied: "#6ee7b7", // muted green (low saturation)
  rejected: "#f59e0b", // muted amber (low saturation)
  grid: "rgba(255,255,255,0.12)", // 12% opacity horizontal gridlines
  tooltipBg: "#18181b",
  tooltipBorder: "rgba(255,255,255,0.12)",
  axis: "#71717a", // subtle axis color
  text: "#e4e4e7", // primary text
  textSecondary: "#a1a1aa", // secondary text (tick labels)
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
    response_status: "",
    application_status: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [archivingId, setArchivingId] = useState<number | string | null>(null);

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
    } catch (e) {
      setError((e as Error).message);
      setData([]);
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    const onRefresh = () => {
      load();
      loadTrend();
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [load, loadTrend]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setCompany(searchInput.trim());
    setPage(1);
  }

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "date_saved" || field === "applied_at" ? "desc" : "asc"); // datetime: newest first; others: A→Z
    }
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
        response_status: editForm.response_status.trim() || undefined,
        application_status: editForm.application_status.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setEditing(null);
      await load();
    } catch (e) {
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
    const rejectionDays = data.filter((d) => d.rejected > 0);

    return {
      data,
      insights: {
        maxApplied: maxAppliedDay ? { day: maxAppliedDay.dayLabel, value: maxApplied, index: data.indexOf(maxAppliedDay) } : null,
        rejectionDays: rejectionDays.map((d) => ({ day: d.dayLabel, value: d.rejected, index: data.indexOf(d) })),
      },
    };
  }, [trendData]);

  const hasNext = data.length === LIMIT;
  const hasPrev = page > 1;

  const sortConfig = useMemo(() => {
    const dateLabel = statusFilter === "rejected" ? "Archive date" : "Date";
    return BASE_SORT_CONFIG.map((cfg) =>
      cfg.key === "date_saved" ? { ...cfg, label: dateLabel } : cfg,
    );
  }, [statusFilter]);

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
    } catch (e) {
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
    } catch (e) {
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

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      {/* Application Momentum Chart - Single Unified View (only for active jobs) */}
      {statusFilter !== "rejected" && (
        <div className="card card-chart-trend" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: 600, color: CHART_COLORS.text }}>
            Application Momentum
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: CHART_COLORS.textSecondary }}>
            Last 30 days • Applications with rejection context
          </p>
        </div>
        {isLoadingTrend ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
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
                axisLine={false}
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
                cursor={{ fill: "rgba(245, 158, 11, 0.08)" }}
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
              {/* Rejections - Primary signal (bars) */}
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
                  // Highlight days with rejection activity
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
              {/* Applications - Secondary signal (line with small markers) */}
              <Line
                type="monotone"
                dataKey="applied"
                stroke={CHART_COLORS.applied}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: CHART_COLORS.applied,
                  strokeWidth: 0,
                  opacity: 0.8,
                }}
                activeDot={{
                  r: 5,
                  fill: CHART_COLORS.applied,
                  strokeWidth: 2,
                  stroke: CHART_COLORS.tooltipBg,
                }}
                connectNulls={false}
                strokeDasharray="0"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {/* Subtle annotations below chart */}
        {chartData.insights.maxApplied && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${CHART_COLORS.grid}`, fontSize: "0.75rem", color: CHART_COLORS.textSecondary }}>
            <span style={{ color: CHART_COLORS.applied, opacity: 0.8 }}>
              Peak: {chartData.insights.maxApplied.value} applications on {chartData.insights.maxApplied.day}
            </span>
            {chartData.insights.rejectionDays.length > 0 && (
              <span style={{ marginLeft: 16, color: CHART_COLORS.rejected, opacity: 0.7 }}>
                • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
        </div>
      )}

      {/* Rejected Jobs Chart - Last 30 Days (only for archive tab) */}
      {statusFilter === "rejected" && (
        <div className="card card-chart-trend" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: 600, color: CHART_COLORS.text }}>
            Rejected Jobs Trend
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: CHART_COLORS.textSecondary }}>
            Last 30 days • Daily rejected applications
          </p>
        </div>
        {isLoadingTrend ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
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
                axisLine={false}
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
                cursor={{ fill: "rgba(245, 158, 11, 0.08)" }}
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
        {/* Subtle annotations below chart */}
        {chartData.insights.maxRejected && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${CHART_COLORS.grid}`, fontSize: "0.75rem", color: CHART_COLORS.textSecondary }}>
            <span style={{ color: CHART_COLORS.rejected, opacity: 0.8 }}>
              Peak: {chartData.insights.maxRejected.value} rejections on {chartData.insights.maxRejected.day}
            </span>
            {chartData.insights.rejectionDays.length > 0 && (
              <span style={{ marginLeft: 16, color: CHART_COLORS.textSecondary, opacity: 0.7 }}>
                • {chartData.insights.rejectionDays.length} day{chartData.insights.rejectionDays.length !== 1 ? "s" : ""} with rejection{chartData.insights.rejectionDays.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
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
                          handleSort("date_saved");
                        }}
                        title={sortBy === "date_saved" ? `${sortOrder === "asc" ? "A→Z" : "Z→A"} (click to reverse)` : "Sort by Date"}
                      >
                        {sortConfig.find((c) => c.key === "date_saved")?.label ?? "Date"}
                        {sortBy === "date_saved" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
                    <th>
                      <div className="th-stack">
                        <button
                          type="button"
                          className="th-sort"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSort("company");
                          }}
                          title="Sort by Company"
                        >
                          Company
                          {sortBy === "company" ? (
                            <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="th-sort th-sort-sub"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSort("role");
                          }}
                          title="Sort by Position"
                        >
                          Position
                          {sortBy === "role" ? (
                            <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                          ) : null}
                        </button>
                      </div>
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
                    <th>Keyword Match</th>
                    <th>OA</th>
                    <th>OA Last Date</th>
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
                    <th>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSort("applied_at");
                        }}
                        title="Sort by Applied At"
                      >
                        Applied At
                        {sortBy === "applied_at" ? (
                          <span className="th-sort-icon" aria-hidden>{sortOrder === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </button>
                    </th>
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
                          statusFilter === "rejected"
                            ? ((j as any).archive_date ?? j.date_saved)
                            : j.date_saved,
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
                      <td>{formatTableTime((j as any).applied_at)}</td>
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
              <span>Page {page}</span>
              <button type="button" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => !isSaving && setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Job</h3>
            <form className="form" onSubmit={onSaveEdit}>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={editForm.date_saved}
                  onChange={(e) => setEditForm((p) => ({ ...p, date_saved: e.target.value }))}
                />
              </div>
              <input
                placeholder="Position *"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
              />
              <input
                placeholder="Company *"
                value={editForm.company}
                onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
              />
              <input
                placeholder="Location"
                value={editForm.location_raw}
                onChange={(e) => setEditForm((p) => ({ ...p, location_raw: e.target.value }))}
              />
              <input
                placeholder="Job link (URL)"
                value={editForm.job_link}
                onChange={(e) => setEditForm((p) => ({ ...p, job_link: e.target.value }))}
              />
              <input
                placeholder="Job/Application ID (optional)"
                value={editForm.job_application_id}
                onChange={(e) => setEditForm((p) => ({ ...p, job_application_id: e.target.value }))}
              />
              <div className="form-row">
                <label className="form-label">OA Last Date (optional)</label>
                <input
                  type="date"
                  value={editForm.oa_deadline_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                />
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
              <div className="form-row">
                <label className="form-label">Online Assessment (OA)</label>
                <select
                  value={editForm.oa_status}
                  onChange={(e) => setEditForm((p) => ({ ...p, oa_status: e.target.value }))}
                  className="form-select"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
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
              {editForm.referral_status === "Yes" && (
                <p className="referral-hint">
                  Ensure this company has an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page.
                </p>
              )}
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
    </>
  );
}
