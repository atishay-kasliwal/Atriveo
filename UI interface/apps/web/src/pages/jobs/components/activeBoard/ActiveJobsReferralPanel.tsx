import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { getReferrals, updateReferral } from "../../../../lib/api";
import { getReferralInitials } from "../../utils/formatters";

type ReferralRow = { id: number | string; name: string; company: string; role: string };
type DailyCount = { day: string; count: number };

type Props = {
  referralSearch: string;
  setReferralSearch: Dispatch<SetStateAction<string>>;
  filteredReferralRows: ReferralRow[];
  isLoadingReferrals: boolean;
  referralError: string;
  totalReferralCount: number;
  onAddReferral: () => void;
  currentWeekDailyCounts: DailyCount[];
  thisWeekTotal: number;
  previousWeekTotal: number;
  bestDay: string;
  targetCount: number;
  targetProgressPercent: number;
  isLoadingSummary: boolean;
  summaryError: string;
};

type ReferralTableProps = {
  rows: ReferralRow[];
  isLoading: boolean;
  error: string;
  emptyMessage: string;
  showCount?: boolean;
  rowStart?: number;
  mergePersonCompany?: boolean;
  onEditRow?: (row: ReferralRow) => void;
  savingRowId?: number | string | null;
};

const PREVIEW_ROW_LIMIT = 12;
const MODAL_PAGE_SIZE = 20;

function mapReferralRecord(row: Record<string, unknown>): ReferralRow {
  return {
    id: (row.id as number | string | undefined) ?? `ref-${String(row.company ?? "")}-${String(row.request_log ?? "")}`,
    name: String((row as { referred_by_name?: unknown }).referred_by_name ?? "").trim() || "Unknown",
    company: String(row.company ?? "-") || "-",
    role: String((row as { request_log?: unknown }).request_log ?? "-") || "-",
  };
}

function ReferralTable({
  rows,
  isLoading,
  error,
  emptyMessage,
  showCount = false,
  rowStart = 1,
  mergePersonCompany = false,
  onEditRow,
  savingRowId = null,
}: ReferralTableProps) {
  const showActions = Boolean(showCount && onEditRow);
  const columnCount = (showCount ? (mergePersonCompany ? 3 : 4) : mergePersonCompany ? 2 : 3) + (showActions ? 1 : 0);

  return (
    <table
      className={`active-jobs-referral-table${showCount ? " active-jobs-referral-table--with-count" : ""}${
        mergePersonCompany ? " active-jobs-referral-table--panel" : ""
      }`}
    >
      <thead>
        <tr>
          {showCount ? <th>Count</th> : null}
          <th>{mergePersonCompany ? "Person" : "Name"}</th>
          {!mergePersonCompany ? <th>Company</th> : null}
          <th>Role</th>
          {showActions ? <th>Action</th> : null}
        </tr>
      </thead>
      <tbody>
        {isLoading && rows.length === 0 ? (
          <tr>
            <td className="active-jobs-referral-empty" colSpan={columnCount}>
              <div className="active-jobs-referral-loading" aria-hidden>
                <span className="active-jobs-skeleton-line is-wide" />
                <span className="active-jobs-skeleton-line is-medium" />
              </div>
            </td>
          </tr>
        ) : null}
        {rows.map((row, index) => (
          <tr key={String(row.id)}>
            {showCount ? <td className="active-jobs-referral-count-cell">{rowStart + index}</td> : null}
            <td>
              <div className="active-jobs-referral-person">
                <span className="active-jobs-referral-avatar" aria-hidden>
                  <span className="active-jobs-referral-avatar-text">{getReferralInitials(row.name)}</span>
                </span>
                <div className="active-jobs-referral-name">
                  <strong>{row.name}</strong>
                  {mergePersonCompany ? <span className="active-jobs-referral-company-sub">{row.company}</span> : null}
                </div>
              </div>
            </td>
            {!mergePersonCompany ? <td>{row.company}</td> : null}
            <td>{row.role}</td>
            {showActions ? (
              <td>
                <button
                  type="button"
                  className="active-jobs-referral-edit-btn"
                  onClick={() => onEditRow?.(row)}
                  disabled={savingRowId === row.id}
                >
                  {savingRowId === row.id ? "…" : "Edit"}
                </button>
              </td>
            ) : null}
          </tr>
        ))}
        {!isLoading && error && rows.length === 0 ? (
          <tr>
            <td className="active-jobs-referral-empty" colSpan={columnCount}>
              {error}
            </td>
          </tr>
        ) : null}
        {!isLoading && !error && rows.length === 0 ? (
          <tr>
            <td className="active-jobs-referral-empty" colSpan={columnCount}>
              {emptyMessage}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default function ActiveJobsReferralPanel({
  referralSearch,
  setReferralSearch,
  filteredReferralRows,
  isLoadingReferrals,
  referralError,
  totalReferralCount: _totalReferralCount,
  onAddReferral,
  currentWeekDailyCounts,
  thisWeekTotal,
  previousWeekTotal,
  bestDay,
  targetCount,
  targetProgressPercent,
  isLoadingSummary,
  summaryError,
}: Props) {
  const previewRows = useMemo(() => filteredReferralRows.slice(0, PREVIEW_ROW_LIMIT), [filteredReferralRows]);
  const [isAllReferralsOpen, setIsAllReferralsOpen] = useState(false);
  const [modalSearchInput, setModalSearchInput] = useState("");
  const [modalSearch, setModalSearch] = useState("");
  const [modalPage, setModalPage] = useState(1);
  const [modalRows, setModalRows] = useState<ReferralRow[]>([]);
  const [modalTotal, setModalTotal] = useState(0);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [editingReferral, setEditingReferral] = useState<ReferralRow | null>(null);
  const [editReferralForm, setEditReferralForm] = useState({ name: "", company: "", role: "" });
  const [editReferralError, setEditReferralError] = useState("");
  const [isSavingReferralEdit, setIsSavingReferralEdit] = useState(false);

  const dailyCounts = currentWeekDailyCounts.map((entry) => entry.count);
  const chartMax = Math.max(...dailyCounts, 1);
  const weekDelta = thisWeekTotal - previousWeekTotal;
  const weekDeltaSign = weekDelta >= 0 ? "+" : "-";
  const weekDeltaPercent =
    previousWeekTotal > 0 ? Math.round((Math.abs(weekDelta) / previousWeekTotal) * 100) : 0;
  const safeTargetProgressPercent = Number.isFinite(targetProgressPercent) ? targetProgressPercent : 0;
  const yAxisTop = Math.max(4, Math.ceil(chartMax / 2) * 2);
  const yAxisTicks = [yAxisTop, Math.round(yAxisTop * 0.75), Math.round(yAxisTop * 0.5), Math.round(yAxisTop * 0.25), 0];
  const highlightedDay = bestDay;
  const modalTotalPages = Math.max(1, Math.ceil(modalTotal / MODAL_PAGE_SIZE));
  const modalStart = modalTotal === 0 ? 0 : (modalPage - 1) * MODAL_PAGE_SIZE + 1;
  const modalEnd = modalTotal === 0 ? 0 : Math.min((modalPage - 1) * MODAL_PAGE_SIZE + modalRows.length, modalTotal);
  const modalRowStart = modalTotal === 0 ? 0 : (modalPage - 1) * MODAL_PAGE_SIZE + 1;

  const openAllReferrals = useCallback(() => {
    const initialSearch = referralSearch.trim();
    setModalSearchInput(initialSearch);
    setModalSearch(initialSearch);
    setModalPage(1);
    setIsAllReferralsOpen(true);
  }, [referralSearch]);

  const closeAllReferrals = useCallback(() => {
    setIsAllReferralsOpen(false);
  }, []);

  const openAddReferralFromModal = useCallback(() => {
    closeAllReferrals();
    onAddReferral();
  }, [closeAllReferrals, onAddReferral]);

  const openEditReferral = useCallback((row: ReferralRow) => {
    setEditReferralError("");
    setEditingReferral(row);
    setEditReferralForm({
      name: row.name === "Unknown" ? "" : row.name,
      company: row.company === "-" ? "" : row.company,
      role: row.role === "-" ? "" : row.role,
    });
  }, []);

  const closeEditReferral = useCallback(() => {
    if (isSavingReferralEdit) return;
    setEditingReferral(null);
    setEditReferralError("");
  }, [isSavingReferralEdit]);

  useEffect(() => {
    if (!isAllReferralsOpen) return;
    const timer = window.setTimeout(() => {
      setModalSearch(modalSearchInput.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [isAllReferralsOpen, modalSearchInput]);

  useEffect(() => {
    if (!isAllReferralsOpen) return;
    setModalPage(1);
  }, [isAllReferralsOpen, modalSearch]);

  useEffect(() => {
    if (!isAllReferralsOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAllReferrals();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [closeAllReferrals, isAllReferralsOpen]);

  const loadAllReferralsPage = useCallback(async () => {
    if (!isAllReferralsOpen) return;
    try {
      setModalError("");
      setIsModalLoading(true);
      const response = await getReferrals({
        page: modalPage,
        limit: MODAL_PAGE_SIZE,
        search: modalSearch || undefined,
      });
      const rows = (response.data ?? []).map((row) => mapReferralRecord(row));
      setModalRows(rows);
      setModalTotal(Number(response.total ?? rows.length));
    } catch (err) {
      setModalRows([]);
      setModalTotal(0);
      setModalError((err as Error).message);
    } finally {
      setIsModalLoading(false);
    }
  }, [isAllReferralsOpen, modalPage, modalSearch]);

  useEffect(() => {
    void loadAllReferralsPage();
  }, [loadAllReferralsPage]);

  const onSaveReferralEdit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!editingReferral) return;
      const company = editReferralForm.company.trim();
      if (!company) {
        setEditReferralError("Company is required.");
        return;
      }
      try {
        setEditReferralError("");
        setIsSavingReferralEdit(true);
        await updateReferral(editingReferral.id, {
          company,
          request_log: editReferralForm.role.trim() || null,
          referred_by_name: editReferralForm.name.trim() || null,
        });
        setEditingReferral(null);
        await loadAllReferralsPage();
        window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      } catch (err) {
        setEditReferralError((err as Error).message);
      } finally {
        setIsSavingReferralEdit(false);
      }
    },
    [editingReferral, editReferralForm.company, editReferralForm.name, editReferralForm.role, loadAllReferralsPage],
  );

  return (
    <>
      <section className="active-jobs-side-panel active-jobs-referral-panel">
        <div className="active-jobs-referrals-head">
          <h3>Referrals</h3>
          <div className="active-jobs-referrals-actions">
            <button type="button" className="active-jobs-referral-add-btn" onClick={onAddReferral}>
              Add referral
            </button>
          </div>
        </div>
        <label className="active-jobs-referral-search">
          <span className="active-jobs-referral-search-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={referralSearch}
            onChange={(e) => setReferralSearch(e.target.value)}
            placeholder="Search name, company, role..."
            aria-label="Search referrals"
          />
        </label>
        <div className="active-jobs-referral-table-wrap">
          <ReferralTable
            rows={previewRows}
            isLoading={isLoadingReferrals}
            error={referralError}
            emptyMessage="No matching friend or company."
            mergePersonCompany
          />
        </div>
        <div className="active-jobs-referral-footer">
          <button type="button" className="active-jobs-referral-view-btn" onClick={openAllReferrals}>
            View all
            <span className="active-jobs-referral-view-btn-icon" aria-hidden>
              <svg viewBox="0 0 16 16" fill="none" role="presentation" focusable="false">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </section>
      {isAllReferralsOpen ? (
        <div className="modal-overlay active-jobs-referral-modal-overlay" onClick={closeAllReferrals}>
          <div
            className="modal active-jobs-referral-modal"
            role="dialog"
            aria-modal="true"
            aria-label="All Referrals"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close-x" onClick={closeAllReferrals} aria-label="Close referrals modal">
              ×
            </button>
            <div className="active-jobs-referral-modal-head">
              <h3>All Referrals</h3>
              <div className="active-jobs-referral-modal-head-actions">
                <button type="button" className="active-jobs-referral-add-btn" onClick={openAddReferralFromModal}>
                  Add referral
                </button>
              </div>
            </div>
            <label className="active-jobs-referral-search active-jobs-referral-modal-search">
              <span className="active-jobs-referral-search-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
                  <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                value={modalSearchInput}
                onChange={(event) => setModalSearchInput(event.target.value)}
                placeholder="Search name, company, role..."
                aria-label="Search all referrals"
                autoFocus
              />
            </label>
            <div className="active-jobs-referral-modal-table-wrap">
              <ReferralTable
                rows={modalRows}
                isLoading={isModalLoading}
                error={modalError}
                emptyMessage="No referrals found."
                showCount
                rowStart={modalRowStart}
                onEditRow={openEditReferral}
                savingRowId={isSavingReferralEdit ? editingReferral?.id ?? null : null}
              />
            </div>
            <div className="active-jobs-referral-modal-pagination">
              <span>{`Showing ${modalStart}-${modalEnd} of ${modalTotal}`}</span>
              <div className="active-jobs-referral-modal-pagination-actions">
                <button
                  type="button"
                  className="active-jobs-referral-page-btn"
                  onClick={() => setModalPage((prev) => Math.max(1, prev - 1))}
                  disabled={modalPage <= 1 || isModalLoading}
                >
                  Previous
                </button>
                <span>{`Page ${modalPage} / ${modalTotalPages}`}</span>
                <button
                  type="button"
                  className="active-jobs-referral-page-btn"
                  onClick={() => setModalPage((prev) => Math.min(modalTotalPages, prev + 1))}
                  disabled={modalPage >= modalTotalPages || isModalLoading}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {editingReferral ? (
        <div className="modal-overlay active-jobs-referral-modal-overlay" onClick={closeEditReferral}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit referral" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Referral</h3>
            <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Update this referral contact.
            </p>
            {editReferralError ? <div className="auth-error">{editReferralError}</div> : null}
            <form className="form" onSubmit={onSaveReferralEdit}>
              <label className="form-label">Name</label>
              <input
                type="text"
                placeholder="Referral name"
                value={editReferralForm.name}
                onChange={(event) => setEditReferralForm((prev) => ({ ...prev, name: event.target.value }))}
                autoFocus
              />
              <label className="form-label">Company</label>
              <input
                type="text"
                placeholder="Company name"
                value={editReferralForm.company}
                onChange={(event) => setEditReferralForm((prev) => ({ ...prev, company: event.target.value }))}
                required
              />
              <label className="form-label">Role</label>
              <input
                type="text"
                placeholder="Software Engineer"
                value={editReferralForm.role}
                onChange={(event) => setEditReferralForm((prev) => ({ ...prev, role: event.target.value }))}
              />
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={closeEditReferral} disabled={isSavingReferralEdit}>
                  Cancel
                </button>
                <button type="submit" disabled={isSavingReferralEdit}>
                  {isSavingReferralEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <section className="active-jobs-side-panel active-jobs-referral-insight-panel" aria-label="Current week insight">
        <div className="active-jobs-referral-insight-head">
          <span>Current week (7 days)</span>
          <strong>{thisWeekTotal}</strong>
        </div>
        <div className="active-jobs-referral-insight-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, safeTargetProgressPercent)}%` }} />
        </div>
        {isLoadingSummary && currentWeekDailyCounts.length === 0 ? (
          <div className="active-jobs-kpi-skeleton" aria-hidden>
            <div className="active-jobs-skeleton-line is-wide" />
            <div className="active-jobs-skeleton-grid">
              {Array.from({ length: 7 }).map((_, idx) => (
                <span key={`summary-skeleton-${idx}`} />
              ))}
            </div>
          </div>
        ) : summaryError && currentWeekDailyCounts.length === 0 ? (
          <div className="empty-state">{summaryError}</div>
        ) : (
          <>
            <div className="active-jobs-referral-insight-chart" aria-label="Current week daily bar chart">
              <div className="active-jobs-referral-insight-y-axis" aria-hidden>
                {yAxisTicks.map((tick, index) => (
                  <span key={`y-axis-${index}`}>{tick}</span>
                ))}
              </div>
              <div className="active-jobs-referral-insight-plot">
                <div className="active-jobs-referral-insight-bars">
                  {currentWeekDailyCounts.map((entry) => {
                    const isHighlighted = entry.day === highlightedDay;
                    const normalizedHeight = Math.round((entry.count / yAxisTop) * 100);
                    const barHeight = entry.count === 0 ? 7 : Math.max(18, normalizedHeight);
                    return (
                      <div key={`day-bar-${entry.day}`} className="active-jobs-referral-insight-bar-item">
                        <span className="active-jobs-referral-insight-bar-wrap">
                          {isHighlighted ? <span className="active-jobs-referral-insight-bar-badge">{`${entry.count} apps`}</span> : null}
                          <span
                            className={`active-jobs-referral-insight-bar${isHighlighted ? " is-highlighted" : ""}`}
                            style={{ height: `${barHeight}%` }}
                            aria-hidden
                          />
                        </span>
                        <em>{entry.day}</em>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="active-jobs-referral-insight-list">
              <div>
                <span>vs last week</span>
                <strong className={weekDelta >= 0 ? "is-positive" : "is-negative"}>
                  {`${weekDeltaSign}${Math.abs(weekDelta)} (${weekDeltaSign}${weekDeltaPercent}%)`}
                </strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{`${targetCount} / ${safeTargetProgressPercent}%`}</strong>
              </div>
              <div>
                <span>Best day</span>
                <strong>{bestDay || "—"}</strong>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
