import { useEffect, useMemo, useState } from "react";
import Spinner from "../components/Spinner";
import { editPending, getDashboardSummary, getPending, markPendingDone } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";
import NotesPage from "./NotesPage";
import { getDueTag } from "./pending/utils";

type PendingItem = Record<string, unknown>;

export default function PendingPage() {
  const [pendingData, setPendingData] = useState<PendingItem[]>([]);
  const [archiveData, setArchiveData] = useState<PendingItem[]>([]);
  const [archiveCompany, setArchiveCompany] = useState("all");
  const [archiveSort, setArchiveSort] = useState<"newest" | "oldest">("newest");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [markingId, setMarkingId] = useState<number | string | null>(null);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [editForm, setEditForm] = useState({
    company: "",
    position_name: "",
    pending_date: "",
    end_date: "",
    comment: "",
    link: "",
  });

  async function load() {
    try {
      setError("");
      setIsLoading(true);
      const [pendingRes, archiveRes] = await Promise.all([getPending(), getPending(true)]);
      setPendingData(pendingRes.data ?? []);
      setArchiveData(archiveRes.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setPendingData([]);
      setArchiveData([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener("pending-refresh", onRefresh);
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => {
      window.removeEventListener("pending-refresh", onRefresh);
      window.removeEventListener("dashboard-refresh", onRefresh);
    };
  }, []);

  function startEdit(item: PendingItem) {
    setEditId((item.id as number | string) ?? null);
    setEditForm({
      company: String(item.company ?? ""),
      position_name: String(item.position_name ?? ""),
      pending_date: item.pending_date ? String(item.pending_date).slice(0, 10) : "",
      end_date: item.end_date ? String(item.end_date).slice(0, 10) : "",
      comment: String(item.comment ?? ""),
      link: String(item.link ?? ""),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({ company: "", position_name: "", pending_date: "", end_date: "", comment: "", link: "" });
  }

  async function saveEdit() {
    if (!editId) return;
    setEditLoading(true);
    try {
      await editPending(editId, {
        company: editForm.company.trim() || undefined,
        position_name: editForm.position_name.trim() || undefined,
        pending_date: editForm.pending_date || undefined,
        end_date: editForm.end_date || undefined,
        comment: editForm.comment.trim() || undefined,
        link: editForm.link.trim() || undefined,
      });
      await load();
      cancelEdit();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEditLoading(false);
    }
  }

  async function onMarkDone(id: number | string) {
    try {
      setMarkingId(id);
      await markPendingDone(id);
      await load();
      await getDashboardSummary();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarkingId(null);
    }
  }

  const archiveCompanies = useMemo(() => {
    const values = new Set<string>();
    for (const item of archiveData) {
      const name = String(item.company ?? "").trim();
      if (name) values.add(name);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [archiveData]);

  const archiveRows = useMemo(() => {
    const normalizeDate = (value: unknown) => {
      const raw = String(value ?? "").slice(0, 10);
      if (!raw) return 0;
      const parsed = new Date(`${raw}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };
    const filtered = archiveData.filter((item) => {
      if (archiveCompany === "all") return true;
      return String(item.company ?? "").trim().toLowerCase() === archiveCompany.toLowerCase();
    });
    return [...filtered].sort((a, b) => {
      const av = normalizeDate(a.pending_date);
      const bv = normalizeDate(b.pending_date);
      return archiveSort === "newest" ? bv - av : av - bv;
    });
  }, [archiveCompany, archiveData, archiveSort]);

  function renderCard(item: PendingItem, archived = false) {
    const id = (item.id as number | string) ?? "";
    const dueTag = getDueTag(item.end_date);
    const hasEndDate = Boolean(item.end_date);
    const comment = String(item.comment ?? "").trim();
    return (
      <article
        key={String(id)}
        className={`pending-card pending-card--clickable ${archived ? "pending-card--archived" : "pending-card--active"}`}
        onClick={() => setSelectedItem(item)}
      >
        <div className="pending-card-top">
          <span className={`status-chip ${archived ? "status-chip--done" : "status-chip--open"}`}>
            {archived ? "Done" : "Open"}
          </span>
          {hasEndDate ? (
            <span className={`status-chip pending-due-chip pending-due-chip--${dueTag.tone}`}>{dueTag.label}</span>
          ) : null}
        </div>
        <h3 className="pending-card-company">{String(item.company ?? "-")}</h3>
        <p className="pending-card-role">{String(item.position_name ?? "-")}</p>
        {comment ? <p className="pending-card-comment">{comment}</p> : null}
        <p className="pending-card-date">
          Start: {formatTableDate(item.pending_date)}
          {hasEndDate ? (
            <>
              <br />
              End: {formatTableDate(item.end_date)}
            </>
          ) : null}
        </p>
        <div className="pending-card-footer">
          <div className="row-actions pending-actions">
            {!archived ? (
              <button
                type="button"
                className="action-btn"
                disabled={markingId === id}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkDone(id);
                }}
              >
                {markingId === id ? "..." : "Done"}
              </button>
            ) : null}
            <button
              type="button"
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(item);
              }}
              aria-label="Edit"
              title="Edit"
            >
              ✎
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}

      <NotesPage />

      <section className="followup-workbench">
        <div className="card followup-workbench-pane followup-workbench-pane--pending">
          <div className="pending-header">
            <div className="pending-header-main">
              <h2>Pending Tasks</h2>
            </div>
            <button
              type="button"
              className="section-header-btn"
              onClick={() => window.dispatchEvent(new CustomEvent("open-create-task-modal"))}
            >
              Add Task
            </button>
          </div>
          {isLoading ? (
            <Spinner />
          ) : pendingData.length === 0 ? (
            <div className="empty-state">No pending items. All clear.</div>
          ) : (
            <div className="pending-board-grid">{pendingData.map((p) => renderCard(p, false))}</div>
          )}
        </div>

        <div className="card followup-workbench-pane followup-workbench-pane--archive">
          <div className="pending-header pending-header--archive">
            <div className="pending-header-main">
              <h2>Archive</h2>
            </div>
            {!isLoading && archiveData.length > 0 ? (
              <div className="pending-archive-tools pending-archive-tools--inline">
                <select
                  className="pending-archive-select"
                  value={archiveCompany}
                  onChange={(e) => setArchiveCompany(e.target.value)}
                  aria-label="Filter archive by company"
                >
                  <option value="all">All Companies</option>
                  {archiveCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
                <select
                  className="pending-archive-select"
                  value={archiveSort}
                  onChange={(e) => setArchiveSort(e.target.value === "oldest" ? "oldest" : "newest")}
                  aria-label="Sort archived records"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            ) : null}
          </div>
          {isLoading ? (
            <Spinner />
          ) : archiveData.length === 0 ? (
            <div className="empty-state">No archived items.</div>
          ) : (
            <>
              <div className="table-wrap pending-archive-wrap">
                <table className="pending-archive-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Notes</th>
                      <th>Start Date</th>
                      <th>Status</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archiveRows.map((item, idx) => {
                      const note = String(item.comment ?? "").trim();
                      const notePreview = note ? (note.length > 96 ? `${note.slice(0, 96)}...` : note) : "-";
                      return (
                        <tr
                          key={String(item.id ?? idx)}
                          className="tr-hover pending-archive-row"
                          onClick={() => setSelectedItem(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedItem(item);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View ${String(item.company ?? "item")} details`}
                        >
                          <td className="table-col-no">{idx + 1}</td>
                          <td>
                            <div className="job-company">{String(item.company ?? "-")}</div>
                          </td>
                          <td>
                            <div className="job-role">{String(item.position_name ?? "-")}</div>
                          </td>
                          <td className="pending-archive-note" title={note || "No notes"}>
                            {notePreview}
                          </td>
                          <td>{formatTableDate(item.pending_date)}</td>
                          <td>
                            <span className="status-chip status-chip--done">Done</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="action-btn pending-archive-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {editId !== null ? (
        <div className="modal-overlay" onClick={() => !editLoading && cancelEdit()}>
          <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Pending</h3>
            <form
              className="form form--two-col"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
            >
              <input
                placeholder="Company *"
                value={editForm.company}
                onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
              />
              <input
                placeholder="Position"
                value={editForm.position_name}
                onChange={(e) => setEditForm((f) => ({ ...f, position_name: e.target.value }))}
              />
              <div className="form-row">
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  value={editForm.pending_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, pending_date: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">End date</label>
                <input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
              <textarea
                className="form-span-2"
                rows={4}
                placeholder="Comment"
                value={editForm.comment}
                onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
              />
              <input
                className="form-span-2"
                placeholder="Link (URL)"
                type="url"
                value={editForm.link}
                onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))}
              />
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={cancelEdit} disabled={editLoading}>
                  Cancel
                </button>
                <button type="submit" disabled={editLoading || !editForm.company.trim()}>
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal pending-view-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{String(selectedItem.company ?? "Pending Item")}</h3>
            <div className="pending-view-grid">
              <div>
                <div className="pending-meta">Position</div>
                <div>{String(selectedItem.position_name ?? "-")}</div>
              </div>
              <div>
                <div className="pending-meta">Start date</div>
                <div>{formatTableDate(selectedItem.pending_date)}</div>
              </div>
              <div>
                <div className="pending-meta">End date</div>
                <div>{formatTableDate(selectedItem.end_date)}</div>
              </div>
              <div>
                <div className="pending-meta">Status</div>
                <div>{Boolean(selectedItem.is_done) ? "Done" : "Open"}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="pending-meta">Link</div>
                {selectedItem.link ? (
                  <a href={String(selectedItem.link)} target="_blank" rel="noopener noreferrer" className="table-link">
                    {String(selectedItem.link)}
                  </a>
                ) : (
                  <span className="pending-meta">-</span>
                )}
              </div>
            </div>
            <div className="pending-message-box">
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {String(selectedItem.comment ?? "No message provided.")}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="action-btn"
                onClick={() => {
                  startEdit(selectedItem);
                  setSelectedItem(null);
                }}
                aria-label="Edit"
                title="Edit"
              >
                ✎
              </button>
              <button type="button" className="action-btn" onClick={() => setSelectedItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
