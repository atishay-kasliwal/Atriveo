import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useConfirmDialog from "../components/ui/useConfirmDialog";
import { getLocalISODate } from "../lib/formatDate";
import {
  createReferral,
  deleteReferral,
  getReferrals,
  updateReferral,
} from "../lib/api";
import EditReferralModal from "./referrals/components/EditReferralModal";
import CreateReferralModal from "./referrals/components/CreateReferralModal";
import { CREATE_REFERRAL_INITIAL } from "./referrals/constants";
import type { CreateReferralForm } from "./referrals/types";
import { getStatusMeta } from "./jobs/utils/tableMeta";

type ReferralRow = Record<string, unknown>;

type DerivedStatus = "Pending" | "Interviewing" | "Offer" | "Archived";

type DisplayRow = {
  id: number | string;
  name: string;
  initials: string;
  source: string;
  role: string;
  company: string;
  status: DerivedStatus;
  pillLabel: string;
  pillCls: string;
  date: string;
  raw: ReferralRow;
};

const PAGE_SIZE = 10;

function deriveStatus(row: ReferralRow): DerivedStatus {
  const appStatus = String((row as Record<string, unknown>).application_status ?? "").trim().toLowerCase();
  const received = String(row.referral_received ?? "").trim().toLowerCase();
  if (appStatus === "rejected" || received === "no") return "Archived";
  if (appStatus === "open") return "Offer";
  if (appStatus === "under consideration" || appStatus === "applied" || received === "yes") return "Interviewing";
  return "Pending";
}

function pillFor(row: ReferralRow): { label: string; cls: string } {
  const appStatus = String((row as Record<string, unknown>).application_status ?? "").trim();
  if (appStatus) return getStatusMeta(appStatus);
  const received = String(row.referral_received ?? "").trim().toLowerCase();
  if (received === "yes") return { label: "Received", cls: "status-chip status-chip--applied" };
  if (received === "requested") return { label: "Requested", cls: "status-chip status-chip--review" };
  if (received === "no") return { label: "Declined", cls: "status-chip status-chip--rejected" };
  return { label: "Pending", cls: "status-chip status-chip--applied" };
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "??";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function prettifySource(source: unknown): string {
  const raw = String(source ?? "").trim().toLowerCase();
  if (!raw) return "via Direct";
  if (raw === "manual") return "via Manual";
  if (raw === "import-csv") return "via CSV";
  if (raw === "extension") return "via Extension";
  if (raw === "job-sync") return "via Application";
  if (raw.includes("linkedin")) return "via LinkedIn";
  if (raw.includes("email")) return "via Email";
  if (raw.includes("network")) return "via Network";
  return `via ${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

function formatDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = String(value);
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toIsoDateInput(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapRow(row: ReferralRow): DisplayRow {
  const name = String(row.referred_by_name ?? "").trim() || "Unknown";
  const pill = pillFor(row);
  return {
    id: (row.id as number | string | undefined) ?? `ref-${String(row.company ?? "")}-${String(row.request_log ?? "")}`,
    name,
    initials: getInitials(name),
    source: prettifySource(row.source),
    role: String(row.request_log ?? "").trim() || "—",
    company: String(row.company ?? "").trim() || "—",
    status: deriveStatus(row),
    pillLabel: pill.label,
    pillCls: pill.cls,
    date: formatDate(row.updated_date ?? row.request_date),
    raw: row,
  };
}

export default function MyReferralsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [page, setPage] = useState(1);
  const [sortDesc, setSortDesc] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Set<DerivedStatus>>(() => new Set());

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateReferralForm>(CREATE_REFERRAL_INITIAL);

  const [editing, setEditing] = useState<ReferralRow | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editReferredByName, setEditReferredByName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { confirm, confirmDialog } = useConfirmDialog();

  const loadAll = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      const res = await getReferrals({ page: 1, limit: 100 });
      setRows(res.data ?? []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab, sortDesc, statusFilters]);

  useEffect(() => {
    function onDocClick() {
      setIsFilterOpen(false);
    }
    if (isFilterOpen) {
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }
    return undefined;
  }, [isFilterOpen]);

  useEffect(() => {
    const onRefresh = () => loadAll();
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [loadAll]);

  const allDisplay = useMemo(() => rows.map(mapRow), [rows]);

  const counts = useMemo(() => {
    let active = 0;
    let interviewing = 0;
    let offers = 0;
    let archived = 0;
    for (const row of allDisplay) {
      if (row.status === "Archived") archived += 1;
      else active += 1;
      if (row.status === "Interviewing") interviewing += 1;
      if (row.status === "Offer") offers += 1;
    }
    return { active, interviewing, offers, archived };
  }, [allDisplay]);

  const insights = useMemo(() => {
    const SPARK_DAYS = 14;
    const dayMs = 86400000;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(todayStart.getTime() - 6 * dayMs);
    const buckets = {
      active: new Array<number>(SPARK_DAYS).fill(0),
      interviewing: new Array<number>(SPARK_DAYS).fill(0),
      offers: new Array<number>(SPARK_DAYS).fill(0),
      archived: new Array<number>(SPARK_DAYS).fill(0),
    };
    let activeThisWeek = 0;
    let interviewingToday = 0;
    let offersToday = 0;
    let archivedThisWeek = 0;
    for (const row of allDisplay) {
      const raw = String(row.raw.updated_date ?? row.raw.request_date ?? "");
      if (!raw) continue;
      const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
      if (Number.isNaN(parsed.getTime())) continue;
      const diff = Math.floor((todayStart.getTime() - new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()) / dayMs);
      const inSpark = diff >= 0 && diff < SPARK_DAYS;
      const inWeek = parsed >= weekStart;
      const isToday = diff === 0;
      const target = row.status === "Archived"
        ? "archived"
        : row.status === "Offer"
          ? "offers"
          : row.status === "Interviewing"
            ? "interviewing"
            : "active";
      if (inSpark) buckets[target][SPARK_DAYS - 1 - diff] += 1;
      if (target !== "archived" && inWeek) activeThisWeek += 1;
      if (target === "interviewing" && isToday) interviewingToday += 1;
      if (target === "offers" && isToday) offersToday += 1;
      if (target === "archived" && inWeek) archivedThisWeek += 1;
    }
    return {
      sparks: buckets,
      activeThisWeek,
      interviewingToday,
      offersToday,
      archivedThisWeek,
    };
  }, [allDisplay]);

  function buildSparkPath(values: number[]): string {
    if (!values.length) return "";
    const w = 100;
    const h = 30;
    const max = Math.max(1, ...values);
    const stepX = w / Math.max(1, values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = h - (v / max) * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const filteredRows = useMemo(() => {
    const matchesTab = (r: DisplayRow) =>
      activeTab === "archive" ? r.status === "Archived" : r.status !== "Archived";
    const matchesSearch = (r: DisplayRow) => {
      if (!debouncedSearch) return true;
      const haystack = `${r.name} ${r.role} ${r.company}`.toLowerCase();
      return haystack.includes(debouncedSearch);
    };
    const matchesStatus = (r: DisplayRow) => {
      if (statusFilters.size === 0) return true;
      return statusFilters.has(r.status);
    };
    const list = allDisplay.filter((r) => matchesTab(r) && matchesSearch(r) && matchesStatus(r));
    list.sort((a, b) => {
      const aTime = new Date(String(a.raw.updated_date ?? a.raw.request_date ?? 0)).getTime();
      const bTime = new Date(String(b.raw.updated_date ?? b.raw.request_date ?? 0)).getTime();
      return sortDesc ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [allDisplay, activeTab, debouncedSearch, sortDesc, statusFilters]);

  function toggleStatusFilter(status: DerivedStatus) {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function clearStatusFilters() {
    setStatusFilters(new Set());
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  const totalActive = allDisplay.filter((r) => r.status !== "Archived").length;
  const totalArchive = allDisplay.filter((r) => r.status === "Archived").length;
  const headerCount = activeTab === "archive" ? totalArchive : totalActive;

  function openCreate() {
    setError("");
    setCreateForm({ ...CREATE_REFERRAL_INITIAL, request_date: getLocalISODate() });
    setShowCreateModal(true);
  }

  function closeCreate() {
    if (isCreating) return;
    setShowCreateModal(false);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const company = createForm.company.trim();
    const requestLog = createForm.request_log.trim();
    if (!company || !requestLog) return;
    try {
      setIsCreating(true);
      setError("");
      await createReferral({
        company,
        request_log: requestLog,
        request_date: createForm.request_date || getLocalISODate(),
        request_link: createForm.request_link.trim() || undefined,
        referral_received: "Requested",
        referred_by_name: createForm.referred_by_name.trim() || undefined,
        keyword_matching: createForm.keyword_matching || "Medium",
        comment: createForm.comment.trim() || undefined,
        source: createForm.source.trim() || undefined,
      });
      setShowCreateModal(false);
      await loadAll();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(row: ReferralRow) {
    setEditing(row);
    setEditStatus(String(row.referral_received ?? ""));
    setEditReferredByName(String(row.referred_by_name ?? ""));
    setEditCompany(String(row.company ?? ""));
    setEditRole(String(row.request_log ?? ""));
    setEditDate(toIsoDateInput(row.request_date));
  }

  function openLinkedApplication(row: ReferralRow) {
    const linkedId = (row as Record<string, unknown>).linked_job_id;
    const company = String(row.company ?? "").trim();
    const params = new URLSearchParams();
    if (linkedId != null && linkedId !== "") params.set("openId", String(linkedId));
    if (company) params.set("search", company);
    const qs = params.toString();
    navigate(`/dashboard/jobs${qs ? `?${qs}` : ""}`);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id) return;
    try {
      setIsSaving(true);
      await updateReferral(String(editing.id), {
        referral_received: editStatus.trim() || null,
        referred_by_name: editReferredByName.trim() || null,
        company: editCompany.trim() || undefined,
        request_log: editRole.trim() || undefined,
        request_date: editDate.trim() || undefined,
      });
      setEditing(null);
      await loadAll();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete(row: DisplayRow) {
    const label = [row.company, row.role].filter(Boolean).join(" — ");
    const ok = await confirm({
      title: "Delete Referral",
      message: `You're going to delete this referral${label ? ` (${label})` : ""}. This cannot be undone.`,
      confirmText: "Confirm Delete",
      cancelText: "No, Keep it",
    });
    if (!ok) return;
    try {
      setPendingDeleteId(row.id);
      await deleteReferral(row.id);
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <section className="my-ref-page">
      <header className="my-ref-header">
        <div>
          <h1 className="my-ref-title">
            My Referrals <span className="my-ref-title-count">({headerCount})</span>
          </h1>
        </div>
        <button type="button" className="jobs-search-btn my-ref-add-btn" onClick={openCreate}>
          + Add referral
        </button>
      </header>

      {error ? <div className="error my-ref-error">{error}</div> : null}

      <div className="my-ref-content">
        <section className="my-ref-card">
        <div className="my-ref-card-toolbar">
          <div className="my-ref-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "active"}
              className={`my-ref-tab ${activeTab === "active" ? "is-active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active <span className="my-ref-tab-count">{totalActive}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "archive"}
              className={`my-ref-tab ${activeTab === "archive" ? "is-active" : ""}`}
              onClick={() => setActiveTab("archive")}
            >
              Archive <span className="my-ref-tab-count">{totalArchive}</span>
            </button>
          </div>

          <div className="my-ref-toolbar-actions">
            <label className="my-ref-search">
              <span className="my-ref-search-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                placeholder="Search name, company, role..."
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search referrals"
              />
            </label>
            <div className="my-ref-filter-wrap">
              <button
                type="button"
                className={`my-ref-toolbar-btn${statusFilters.size > 0 ? " is-active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterOpen((prev) => !prev);
                }}
                aria-expanded={isFilterOpen}
              >
                Filter
                {statusFilters.size > 0 ? (
                  <span className="my-ref-filter-badge">{statusFilters.size}</span>
                ) : null}
              </button>
              {isFilterOpen ? (
                <div className="my-ref-filter-popover" onClick={(e) => e.stopPropagation()}>
                  <p className="my-ref-filter-title">Status</p>
                  {(["Pending", "Interviewing", "Offer", "Archived"] as DerivedStatus[]).map((status) => (
                    <label key={status} className="my-ref-filter-option">
                      <input
                        type="checkbox"
                        checked={statusFilters.has(status)}
                        onChange={() => toggleStatusFilter(status)}
                      />
                      <span>{status}</span>
                    </label>
                  ))}
                  <div className="my-ref-filter-footer">
                    <button
                      type="button"
                      className="my-ref-filter-clear"
                      onClick={clearStatusFilters}
                      disabled={statusFilters.size === 0}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="my-ref-filter-done"
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="my-ref-toolbar-btn"
              onClick={() => setSortDesc((prev) => !prev)}
              title={sortDesc ? "Newest first" : "Oldest first"}
            >
              Sort {sortDesc ? "↓" : "↑"}
            </button>
          </div>
        </div>

        <div className="my-ref-table-wrap">
          <table className="my-ref-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
                <th>Date</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {isLoading && paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="my-ref-empty">Loading referrals…</td>
                </tr>
              ) : null}
              {!isLoading && paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="my-ref-empty">
                    {activeTab === "archive" ? "No archived referrals yet." : "No active referrals yet."}
                  </td>
                </tr>
              ) : null}
              {paged.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    <div className="my-ref-person">
                      <span className="my-ref-avatar" aria-hidden="true">
                        {row.initials}
                      </span>
                      <div className="my-ref-person-meta">
                        <strong>{row.name}</strong>
                        <span>{row.source}</span>
                      </div>
                    </div>
                  </td>
                  <td className="my-ref-cell-strong">
                    <button
                      type="button"
                      className="my-ref-link-cell"
                      onClick={() => openLinkedApplication(row.raw)}
                      title="Open application"
                    >
                      {row.role}
                    </button>
                  </td>
                  <td className="my-ref-cell-strong">
                    <button
                      type="button"
                      className="my-ref-link-cell"
                      onClick={() => openLinkedApplication(row.raw)}
                      title="Open application"
                    >
                      {row.company}
                    </button>
                  </td>
                  <td>
                    <span className={row.pillCls}>{row.pillLabel}</span>
                  </td>
                  <td className="my-ref-cell-muted">{row.date}</td>
                  <td className="my-ref-action-cell">
                    <div className="my-ref-row-actions">
                      <button
                        type="button"
                        className="my-ref-row-action my-ref-row-action--edit"
                        aria-label={`Edit referral for ${row.company}`}
                        title="Edit"
                        onClick={() => openEdit(row.raw)}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M11.5 2.5l2 2-7.5 7.5H4v-2L11.5 2.5z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="my-ref-row-action my-ref-row-action--delete"
                        aria-label={`Delete referral for ${row.company}`}
                        title="Delete"
                        disabled={pendingDeleteId === row.id}
                        onClick={() => onDelete(row)}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M3.5 4.5h9m-7 0v-1a1 1 0 011-1h3a1 1 0 011 1v1m-5 0v8a1 1 0 001 1h4a1 1 0 001-1v-8M7 7v5M9 7v5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="my-ref-footer">
          <span className="my-ref-footer-count">
            {filteredRows.length === 0
              ? "Showing 0 of 0"
              : `Showing ${showingFrom}-${showingTo} of ${filteredRows.length}`}
          </span>
          <div className="my-ref-pagination">
            <button
              type="button"
              className="my-ref-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="my-ref-page-current">Page {safePage}</span>
            <button
              type="button"
              className="my-ref-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <aside className="my-ref-kpis" aria-label="Referral metrics">
        <article className="my-ref-kpi my-ref-kpi--active">
          <div className="my-ref-kpi-head">
            <p className="my-ref-kpi-label">Active referrals</p>
            <span className="my-ref-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.34-8 4v2h10v-2c0-1.06.74-2.21 2-3.16-1.1-.5-2.62-.84-4-.84Zm8 0c-3.31 0-8 1.34-8 4v2h16v-2c0-2.66-4.69-4-8-4Z" fill="currentColor"/>
              </svg>
            </span>
          </div>
          <p className="my-ref-kpi-value">{counts.active}</p>
          <p className="my-ref-kpi-sub">In progress</p>
          {insights.activeThisWeek > 0 ? (
            <span className="my-ref-kpi-delta">↗ +{insights.activeThisWeek} this week</span>
          ) : null}
          <svg className="my-ref-kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
            <path d={buildSparkPath(insights.sparks.active)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>
        <article className="my-ref-kpi my-ref-kpi--interview">
          <div className="my-ref-kpi-head">
            <p className="my-ref-kpi-label">Interviewing</p>
            <span className="my-ref-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
          </div>
          <p className="my-ref-kpi-value">{counts.interviewing}</p>
          <p className="my-ref-kpi-sub">Live conversations</p>
          {insights.interviewingToday > 0 ? (
            <span className="my-ref-kpi-delta">↗ +{insights.interviewingToday} today</span>
          ) : null}
          <svg className="my-ref-kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
            <path d={buildSparkPath(insights.sparks.interviewing)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>
        <article className="my-ref-kpi my-ref-kpi--offer">
          <div className="my-ref-kpi-head">
            <p className="my-ref-kpi-label">Offers</p>
            <span className="my-ref-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2 14 8l6 1-4.5 4.2L17 20l-5-3-5 3 1.5-6.8L4 9l6-1 2-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
          </div>
          <p className="my-ref-kpi-value">{counts.offers}</p>
          <p className="my-ref-kpi-sub">Pending decision</p>
          {insights.offersToday > 0 ? (
            <span className="my-ref-kpi-delta">↗ +{insights.offersToday} today</span>
          ) : null}
          <svg className="my-ref-kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
            <path d={buildSparkPath(insights.sparks.offers)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>
        <article className="my-ref-kpi my-ref-kpi--archive">
          <div className="my-ref-kpi-head">
            <p className="my-ref-kpi-label">Archived</p>
            <span className="my-ref-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 5h18v4H3Zm2 4h14v11H5Zm5 4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
          </div>
          <p className="my-ref-kpi-value">{counts.archived}</p>
          <p className="my-ref-kpi-sub">Closed referrals</p>
          {insights.archivedThisWeek > 0 ? (
            <span className="my-ref-kpi-delta">↗ +{insights.archivedThisWeek} this week</span>
          ) : null}
          <svg className="my-ref-kpi-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
            <path d={buildSparkPath(insights.sparks.archived)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </article>
      </aside>
      </div>

      <CreateReferralModal
        showCreateModal={showCreateModal}
        isCreating={isCreating}
        createForm={createForm}
        setCreateForm={setCreateForm}
        closeCreateReferral={closeCreate}
        onCreateReferralRequest={onCreate}
      />

      <EditReferralModal
        editing={editing}
        isSaving={isSaving}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editReferredByName={editReferredByName}
        setEditReferredByName={setEditReferredByName}
        editCompany={editCompany}
        setEditCompany={setEditCompany}
        editRole={editRole}
        setEditRole={setEditRole}
        editDate={editDate}
        setEditDate={setEditDate}
        setEditing={setEditing}
        onSaveEdit={onSaveEdit}
      />

      {confirmDialog}
    </section>
  );
}
