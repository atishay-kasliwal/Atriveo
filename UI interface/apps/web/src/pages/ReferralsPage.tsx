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
import { formatTableDate } from "../lib/formatDate";
import {
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

const CHART_COLORS = {
  requestedLine: "#60a5fa", // bluish line for Requested
  receivedBar: "#f59e0b", // amber bar for Referral received
  grid: "rgba(255,255,255,0.12)",
  tooltipBg: "#18181b",
  tooltipBorder: "rgba(255,255,255,0.12)",
  axis: "#71717a",
  text: "#e4e4e7",
  textSecondary: "#a1a1aa",
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
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editReferredByName, setEditReferredByName] = useState("");
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

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      {/* Referrals trend: Requested (line) vs Referral received (bars) */}
      <div className="card card-chart-trend" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: 600, color: CHART_COLORS.text }}>
            Referrals Momentum
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: CHART_COLORS.textSecondary }}>
            Last 30 days • Requested vs Referral received
          </p>
        </div>
        {isLoadingTrend ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
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
                axisLine={false}
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
                cursor={{ fill: "rgba(96, 165, 250, 0.08)" }}
                formatter={(value: number, name: string) => {
                  if (name === "referralReceived") return [`${value}`, "Referral received"];
                  if (name === "requested") return [`${value}`, "Requested"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
                labelStyle={{ color: CHART_COLORS.text, fontSize: 11, fontWeight: 500, marginBottom: 6 }}
                itemStyle={{ fontSize: 13, fontWeight: 600 }}
              />
              {/* Bars: Referral received (status Yes) */}
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
              {/* Line: Requested referrals */}
              <Line
                type="monotone"
                dataKey="requested"
                stroke={CHART_COLORS.requestedLine}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.requestedLine, strokeWidth: 0, opacity: 0.85 }}
                activeDot={{ r: 5, fill: CHART_COLORS.requestedLine, strokeWidth: 2, stroke: CHART_COLORS.tooltipBg }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h2>Open Referrals</h2>
        {isLoadingOpen ? (
          <Spinner />
        ) : openData.length === 0 ? (
          <div className="empty-state">No referrals with status Requested.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Referral date</th>
                    <th>Company</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Referred by</th>
                    <th>Notes</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openData.map((r) => (
                    <tr key={String(r.id)} className="tr-hover">
                      <td>{formatTableDate((r as any).updated_date || r.request_date)}</td>
                      <td>{String(r.company ?? "—")}</td>
                      <td>{String(r.request_log ?? "—")}</td>
                      <td>{String(r.referral_received ?? "—")}</td>
                      <td>{String(r.referred_by_name ?? "—")}</td>
                      <td>{String(r.comment ?? "—")}</td>
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
                        <div style={{ display: "flex", gap: "0.5rem" }}>
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
        <h2>Referral Records</h2>
        {isLoadingApplied ? (
          <Spinner />
        ) : appliedData.length === 0 ? (
          <div className="empty-state">No referral records yet.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Updated</th>
                    <th>Company</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Referred by</th>
                    <th>Notes</th>
                    <th>Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appliedData.map((r) => (
                    <tr key={String(r.id)} className="tr-hover data-referral">
                      <td>{formatTableDate((r as any).updated_date || r.request_date)}</td>
                      <td>{String(r.company ?? "—")}</td>
                      <td>{String(r.request_log ?? "—")}</td>
                      <td>{String(r.referral_received ?? "—")}</td>
                      <td>{String(r.referred_by_name ?? "—")}</td>
                      <td>{String(r.comment ?? "—")}</td>
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
                        <div style={{ display: "flex", gap: "0.5rem" }}>
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
    </>
  );
}
