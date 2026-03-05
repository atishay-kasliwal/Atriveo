import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Spinner from "../components/Spinner";
import { formatTableDate, getLocalISODate } from "../lib/formatDate";
import {
  createReferral,
  createJob,
  deleteReferral,
  getReferrals,
  getReferralsTrend,
  updateReferral,
  type ReferralsTrendData,
} from "../lib/api";

const LIMIT = 25;
const REFERRAL_SHEET_STATUSES = ["Requested"] as const;
const JOB_STATUSES = ["Yes", "No"] as const;
const ALL_STATUS_OPTIONS = [...REFERRAL_SHEET_STATUSES, ...JOB_STATUSES] as const;
const CREATE_REFERRAL_INITIAL = {
  company: "",
  request_log: "",
  request_date: getLocalISODate(),
  request_link: "",
  referred_by_name: "",
  comment: "",
  keyword_matching: "Medium",
};

const CHART_COLORS = {
  requestedLine: "#2563eb",
  receivedBar: "#0ea5a4",
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

function textOrDash(value: unknown): string {
  const raw = String(value ?? "").trim();
  return raw || "—";
}

export default function ReferralsPage() {
  const [openData, setOpenData] = useState<Array<Record<string, unknown>>>([]);
  const [appliedData, setAppliedData] = useState<Array<Record<string, unknown>>>([]);
  const [page, setPage] = useState(1);
  const [appliedPage, setAppliedPage] = useState(1);
  const [error, setError] = useState("");
  const [isLoadingOpen, setIsLoadingOpen] = useState(true);
  const [isLoadingApplied, setIsLoadingApplied] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(CREATE_REFERRAL_INITIAL);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editReferredByName, setEditReferredByName] = useState("");
  const [showCreateRecordModal, setShowCreateRecordModal] = useState(false);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [createRecordError, setCreateRecordError] = useState("");
  const [createRecordForm, setCreateRecordForm] = useState({
    company: "",
    request_log: "",
    request_date: getLocalISODate(),
    request_link: "",
    referred_by_name: "",
    comment: "",
  });
  const [trendData, setTrendData] = useState<ReferralsTrendData>([]);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);

  const loadOpen = useCallback(async () => {
    try {
      setError("");
      setIsLoadingOpen(true);
      const res = await getReferrals({ page, limit: LIMIT, filter: "open" });
      setOpenData(res.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setOpenData([]);
    } finally {
      setIsLoadingOpen(false);
    }
  }, [page]);

  const loadApplied = useCallback(async () => {
    try {
      setError("");
      setIsLoadingApplied(true);
      const res = await getReferrals({ page: appliedPage, limit: LIMIT, filter: "applied" });
      setAppliedData(res.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setAppliedData([]);
    } finally {
      setIsLoadingApplied(false);
    }
  }, [appliedPage]);

  const loadTrend = useCallback(async () => {
    try {
      setIsLoadingTrend(true);
      const res = await getReferralsTrend(30);
      setTrendData(res.data ?? []);
    } catch (e) {
      console.error("Failed to load referrals trend:", e);
      setTrendData([]);
    } finally {
      setIsLoadingTrend(false);
    }
  }, []);

  useEffect(() => {
    loadOpen();
  }, [loadOpen]);

  useEffect(() => {
    loadApplied();
  }, [loadApplied]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    const onRefresh = () => {
      loadOpen();
      loadApplied();
      loadTrend();
    };
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [loadOpen, loadApplied, loadTrend]);

  const chartData = useMemo(
    () =>
      trendData.map((row) => ({
        ...row,
        dayLabel: formatDayShort(row.day),
        referralReceived: row.received,
      })),
    [trendData],
  );

  const chartInsights = useMemo(() => {
    if (!chartData.length) {
      return {
        peakRequested: null as { day: string; value: number } | null,
        receivedDays: 0,
      };
    }
    const maxRequested = Math.max(...chartData.map((d) => d.requested), 0);
    const peakDay = chartData.find((d) => d.requested === maxRequested) ?? null;
    const receivedDays = chartData.filter((d) => d.referralReceived > 0).length;
    return {
      peakRequested: peakDay ? { day: peakDay.dayLabel, value: maxRequested } : null,
      receivedDays,
    };
  }, [chartData]);

  function openEdit(r: Record<string, unknown>) {
    setEditing(r);
    setEditStatus(String(r.referral_received ?? ""));
    setEditReferredByName(String(r.referred_by_name ?? ""));
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id) return;
    const newStatus = editStatus.trim();
    try {
      setIsSaving(true);
      await updateReferral(String(editing.id), {
        referral_received: newStatus || null,
        referred_by_name: editReferredByName.trim() || null,
      });
      const movesToJobs = JOB_STATUSES.includes(newStatus as (typeof JOB_STATUSES)[number]);
      if (movesToJobs) {
        let jobLink: string | undefined;
        try {
          const link = (editing.request_link as string)?.trim();
          if (link && new URL(link).href) jobLink = link;
        } catch {
          /* omit invalid URL */
        }
        await createJob({
          company: String(editing.company ?? "").trim(),
          role: (editing.request_log as string)?.trim() || "(From referral)",
          job_link: jobLink,
          keyword_matching: String((editing as any).keyword_matching ?? "Medium"),
          referral_status: newStatus,
          notes: (editing.comment as string)?.trim() || undefined,
        });
      }
      setEditing(null);
      await Promise.all([loadOpen(), loadApplied()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  const hasNext = openData.length === LIMIT;
  const hasPrev = page > 1;
  const hasNextApplied = appliedData.length === LIMIT;
  const hasPrevApplied = appliedPage > 1;
  const movesToJobs = JOB_STATUSES.includes(editStatus as (typeof JOB_STATUSES)[number]);

  async function onDelete(row: Record<string, unknown>) {
    const id = row.id as number | string | undefined;
    if (id === undefined || id === null) return;
    const company = String(row.company ?? "").trim();
    const position = String(row.request_log ?? "").trim();
    const label = [company, position].filter(Boolean).join(" — ");
    const confirmed = window.confirm(
      `Delete this referral${label ? ` (${label})` : ""}? This action cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      setError("");
      setDeletingId(id);
      await deleteReferral(id);
      await Promise.all([loadOpen(), loadApplied()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  function openCreateRecordModal() {
    setCreateRecordError("");
    setCreateRecordForm({
      company: "",
      request_log: "",
      request_date: getLocalISODate(),
      request_link: "",
      referred_by_name: "",
      comment: "",
    });
    setShowCreateRecordModal(true);
  }

  async function onCreateRecord(e: React.FormEvent) {
    e.preventDefault();
    const company = createRecordForm.company.trim();
    if (!company) {
      setCreateRecordError("Company is required.");
      return;
    }
    try {
      setCreateRecordError("");
      setIsCreatingRecord(true);
      await createReferral({
        company,
        request_log: createRecordForm.request_log.trim() || null,
        request_date: createRecordForm.request_date || null,
        request_link: createRecordForm.request_link.trim() || null,
        referral_received: "Yes",
        keyword_matching: "Medium",
        referred_by_name: createRecordForm.referred_by_name.trim() || null,
        comment: createRecordForm.comment.trim() || null,
      });
      setShowCreateRecordModal(false);
      await Promise.all([loadOpen(), loadApplied()]);
    } catch (err) {
      setCreateRecordError((err as Error).message);
    } finally {
      setIsCreatingRecord(false);
    }
  }

  function openCreateReferral() {
    setError("");
    setCreateForm({
      ...CREATE_REFERRAL_INITIAL,
      request_date: getLocalISODate(),
    });
    setShowCreateModal(true);
  }

  function closeCreateReferral() {
    if (isCreating) return;
    setShowCreateModal(false);
  }

  async function onCreateReferralRequest(e: React.FormEvent) {
    e.preventDefault();
    const company = createForm.company.trim();
    const requestLog = createForm.request_log.trim();
    if (!company || !requestLog) return;
    try {
      setError("");
      setIsCreating(true);
      await createReferral({
        company,
        request_log: requestLog,
        request_date: createForm.request_date || getLocalISODate(),
        request_link: createForm.request_link.trim() || undefined,
        referral_received: "Requested",
        referred_by_name: createForm.referred_by_name.trim() || undefined,
        keyword_matching: createForm.keyword_matching || "Medium",
        comment: createForm.comment.trim() || undefined,
      });
      setShowCreateModal(false);
      await Promise.all([loadOpen(), loadApplied(), loadTrend()]);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      {/* Referrals trend: Requested (line) vs Referral received (bars) */}
      <div className="card card-chart-trend trend-uniform-card" style={{ marginBottom: "24px" }}>
        <div className="trend-uniform-head">
          <h2>Referrals Momentum</h2>
          <p>Last 30 days • Requested vs Referral received</p>
        </div>
        <div className="trend-uniform-body">
          {isLoadingTrend ? (
            <div className="trend-uniform-loading">
              <Spinner />
            </div>
          ) : !chartData.length ? (
            <div className="chart-empty">No referral activity in the last 30 days.</div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal vertical={false} />
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
                  label={{
                    value: "Count",
                    angle: -90,
                    position: "insideLeft",
                    fill: CHART_COLORS.textSecondary,
                    fontSize: 11,
                    style: { textAnchor: "middle" },
                  }}
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
                    if (name === "referralReceived") return [`${value}`, "Referral received"];
                    if (name === "requested") return [`${value}`, "Requested"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                  labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                  itemStyle={{ fontSize: 13, fontWeight: 600 }}
                />
                <Bar
                  dataKey="referralReceived"
                  fill={CHART_COLORS.receivedBar}
                  radius={[4, 4, 0, 0]}
                  minPointSize={2}
                  label={{
                    position: "top",
                    fill: CHART_COLORS.textSecondary,
                    fontSize: 9,
                    fontWeight: 400,
                    formatter: (value: number) => (value > 0 ? String(value) : ""),
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="requested"
                  stroke={CHART_COLORS.requestedLine}
                  strokeWidth={2}
                  dot={{ r: 2, fill: CHART_COLORS.requestedLine, strokeWidth: 0, opacity: 0.85 }}
                  activeDot={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="trend-uniform-foot">
          <span className="trend-uniform-foot-item trend-uniform-foot-item--applied">
            {chartInsights.peakRequested
              ? `Peak: ${chartInsights.peakRequested.value} requests on ${chartInsights.peakRequested.day}`
              : "Peak: -"}
          </span>
          <span className="trend-uniform-foot-item trend-uniform-foot-item--rejected">
            • {chartInsights.receivedDays} day{chartInsights.receivedDays !== 1 ? "s" : ""} with referral received
          </span>
        </div>
      </div>

      <div className="card">
        <div className="referrals-head">
          <h2>Open Referrals</h2>
          <button type="button" className="action-btn" onClick={openCreateReferral}>
            + Referral Request
          </button>
        </div>
        {isLoadingOpen ? (
          <Spinner />
        ) : openData.length === 0 ? (
          <div className="empty-state">No referrals with status Requested.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="referrals-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Referral date</th>
                    <th>Company / Position</th>
                    <th>Status</th>
                    <th>Referral Name</th>
                    <th>Notes</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openData.map((r, idx) => (
                    <tr key={String(r.id)} className="tr-hover">
                      <td className="table-col-no">{(page - 1) * LIMIT + idx + 1}</td>
                      <td>{formatTableDate((r as any).updated_date || r.request_date)}</td>
                      <td>
                        <div className="job-main referral-job-main">
                          <div className="job-company" title={textOrDash(r.company)}>{textOrDash(r.company)}</div>
                          <div className="job-role referral-job-role" title={textOrDash(r.request_log)}>{textOrDash(r.request_log)}</div>
                        </div>
                      </td>
                      <td>{textOrDash(r.referral_received)}</td>
                      <td className="referrals-col-name" title={textOrDash(r.referred_by_name)}>{textOrDash(r.referred_by_name)}</td>
                      <td className="referrals-col-notes" title={textOrDash(r.comment)}>{textOrDash(r.comment)}</td>
                      <td>
                        {r.request_link ? (
                          <a href={String(r.request_link)} target="_blank" rel="noopener noreferrer" className="table-link">
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="referrals-row-actions">
                          <button type="button" className="action-btn" onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => onDelete(r)}
                            disabled={deletingId === r.id}
                            aria-label="Delete referral"
                          >
                            {deletingId === r.id ? "…" : "🗑️"}
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

      <div className="card" style={{ marginTop: "24px" }}>
        <div className="referral-records-head">
          <h2>Referral Records</h2>
          <button type="button" className="section-header-btn" onClick={openCreateRecordModal}>
            Add Record
          </button>
        </div>
        {isLoadingApplied ? (
          <Spinner />
        ) : appliedData.length === 0 ? (
          <div className="empty-state">No referral records yet.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="referrals-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Updated</th>
                    <th>Company / Position</th>
                    <th>Status</th>
                    <th>Referral Name</th>
                    <th>Notes</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appliedData.map((r, idx) => (
                    <tr key={String(r.id)} className="tr-hover data-referral">
                      <td className="table-col-no">{(appliedPage - 1) * LIMIT + idx + 1}</td>
                      <td>{formatTableDate((r as any).updated_date || r.request_date)}</td>
                      <td>
                        <div className="job-main referral-job-main">
                          <div className="job-company" title={textOrDash(r.company)}>{textOrDash(r.company)}</div>
                          <div className="job-role referral-job-role" title={textOrDash(r.request_log)}>{textOrDash(r.request_log)}</div>
                        </div>
                      </td>
                      <td>{textOrDash(r.referral_received)}</td>
                      <td className="referrals-col-name" title={textOrDash(r.referred_by_name)}>{textOrDash(r.referred_by_name)}</td>
                      <td className="referrals-col-notes" title={textOrDash(r.comment)}>{textOrDash(r.comment)}</td>
                      <td>
                        {r.request_link ? (
                          <a href={String(r.request_link)} target="_blank" rel="noopener noreferrer" className="table-link">
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="referrals-row-actions">
                          <button type="button" className="action-btn" onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => onDelete(r)}
                            disabled={deletingId === r.id}
                            aria-label="Delete referral"
                          >
                            {deletingId === r.id ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button type="button" disabled={!hasPrevApplied} onClick={() => setAppliedPage((p) => p - 1)}>
                Prev
              </button>
              <span>Page {appliedPage}</span>
              <button type="button" disabled={!hasNextApplied} onClick={() => setAppliedPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => !isSaving && setEditing(null)}>
          <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Referral</h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              {String(editing.company)} — {String(editing.request_log || "—")}
            </p>
            <form className="form form--two-col" onSubmit={onSaveEdit}>
              <div className="form-row">
                <label className="form-label">Referred by name</label>
                <input
                  type="text"
                  placeholder="Name of person who referred you"
                  value={editReferredByName}
                  onChange={(e) => setEditReferredByName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="form-select">
                  {ALL_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {movesToJobs && (
                <p className="referral-hint form-span-2">
                  Saving as &quot;{editStatus}&quot; will create a job and move this row to Referral Records.
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isSaving && setEditing(null)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateRecordModal && (
        <div className="modal-overlay" onClick={() => !isCreatingRecord && setShowCreateRecordModal(false)}>
          <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Add Referral Record</h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              This creates a referral record directly with status &quot;Yes&quot;.
            </p>
            {createRecordError ? <div className="auth-error">{createRecordError}</div> : null}
            <form className="form form--two-col" onSubmit={onCreateRecord}>
              <div className="form-row">
                <label className="form-label">Company</label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={createRecordForm.company}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, company: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="form-row">
                <label className="form-label">Position / Request log</label>
                <input
                  type="text"
                  placeholder="Software Engineer"
                  value={createRecordForm.request_log}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_log: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  value={createRecordForm.request_date}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_date: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Request link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={createRecordForm.request_link}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_link: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Referred by</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={createRecordForm.referred_by_name}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, referred_by_name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Notes</label>
                <textarea
                  placeholder="Optional notes"
                  value={createRecordForm.comment}
                  onChange={(e) => setCreateRecordForm((p) => ({ ...p, comment: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => !isCreatingRecord && setShowCreateRecordModal(false)}
                  disabled={isCreatingRecord}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingRecord}>
                  {isCreatingRecord ? "Saving..." : "Add Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateReferral}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <h3>New Referral Request</h3>
            <form className="form form--quickadd" onSubmit={onCreateReferralRequest}>
              <div className="qa-left">
                <input
                  placeholder="Company *"
                  value={createForm.company}
                  onChange={(e) => setCreateForm((p) => ({ ...p, company: e.target.value }))}
                  autoFocus
                />
                <input
                  placeholder="Position / Request log *"
                  value={createForm.request_log}
                  onChange={(e) => setCreateForm((p) => ({ ...p, request_log: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral Date</label>
                  <input
                    type="date"
                    value={createForm.request_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, request_date: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Referred by name (optional)"
                  value={createForm.referred_by_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, referred_by_name: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  type="url"
                  placeholder="Referral link (optional)"
                  value={createForm.request_link}
                  onChange={(e) => setCreateForm((p) => ({ ...p, request_link: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    className="form-select"
                    value={createForm.keyword_matching}
                    onChange={(e) => setCreateForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  rows={5}
                  value={createForm.comment}
                  onChange={(e) => setCreateForm((p) => ({ ...p, comment: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={closeCreateReferral} disabled={isCreating}>
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || !createForm.company.trim() || !createForm.request_log.trim()}>
                  {isCreating ? "Saving..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
