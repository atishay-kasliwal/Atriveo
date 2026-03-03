import { useEffect, useMemo, useState } from "react";
import Spinner from "../components/Spinner";
import { deleteNote, getNotes, updateNote } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";

type NotePriority = "High" | "Medium" | "Low" | "Archive";
type NotesTab = "All" | NotePriority;

type NoteRow = Record<string, any>;
const NOTE_TABS: NotesTab[] = ["All", "High", "Medium", "Low", "Archive"];
const NOTE_PAGE_SIZE = 3;

function normalizePriority(note: NoteRow): NotePriority {
  const raw = String(note.priority ?? "").trim();
  if (raw === "High" || raw === "Medium" || raw === "Low" || raw === "Archive") {
    return raw;
  }
  return note.is_done ? "Archive" : "Medium";
}

function splitNote(comments: string): { title: string; body: string } {
  const [titleLine, ...restLines] = comments.split("\n");
  const cleaned = restLines
    .map((line) => line.trim())
    .map((line) => {
      const m = /^last\\s*date\\s*:\\s*\\d{4}-\\d{2}-\\d{2}\\s*(.*)$/i.exec(line);
      if (!m) return line;
      return (m[1] ?? "").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return {
    title: titleLine?.trim() || "(Untitled)",
    body: cleaned,
  };
}

function splitNoteForEdit(comments: string): { title: string; body: string } {
  const [titleLine, ...restLines] = comments.split("\n");
  const title = titleLine?.trim() || "";
  const body = restLines
    .map((line) => line.trim())
    .map((line) => {
      const m = /^last\s*date\s*:\s*\d{4}-\d{2}-\d{2}\s*(.*)$/i.exec(line);
      if (!m) return line;
      return (m[1] ?? "").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return { title, body };
}

export default function NotesPage() {
  const [activeNotes, setActiveNotes] = useState<NoteRow[]>([]);
  const [archiveNotes, setArchiveNotes] = useState<NoteRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState<{ note_date: string; title: string; body: string; priority: NotePriority; show_on_dashboard: boolean }>({
    note_date: "",
    title: "",
    body: "",
    priority: "Medium",
    show_on_dashboard: true,
  });
  const [activeTab, setActiveTab] = useState<NotesTab>("All");
  const [notesPageIndex, setNotesPageIndex] = useState(0);

  async function load() {
    try {
      setError("");
      setIsLoading(true);
      const [activeRes, archiveRes] = await Promise.all([
        getNotes({ page: 1, limit: 100, archive: false }),
        getNotes({ page: 1, limit: 100, archive: true }),
      ]);
      setActiveNotes(activeRes.data ?? []);
      setArchiveNotes(archiveRes.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setActiveNotes([]);
      setArchiveNotes([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, []);

  const grouped = useMemo(() => {
    const activeMap: Record<"High" | "Medium" | "Low", NoteRow[]> = {
      High: [],
      Medium: [],
      Low: [],
    };

    for (const note of activeNotes) {
      const p = normalizePriority(note);
      if (p === "Archive") {
        activeMap.Medium.push(note);
      } else {
        activeMap[p].push(note);
      }
    }

    return {
      High: activeMap.High,
      Medium: activeMap.Medium,
      Low: activeMap.Low,
      Archive: archiveNotes,
    };
  }, [activeNotes, archiveNotes]);

  const tabCounts = useMemo(() => {
    const counts: Record<NotesTab, number> = {
      All: grouped.High.length + grouped.Medium.length + grouped.Low.length + grouped.Archive.length,
      High: grouped.High.length,
      Medium: grouped.Medium.length,
      Low: grouped.Low.length,
      Archive: grouped.Archive.length,
    };
    return counts;
  }, [grouped]);

  const visibleNotes = useMemo(() => {
    const withPriority = (items: NoteRow[], priority: NotePriority) =>
      items.map((note) => ({ note, priority }));

    if (activeTab === "All") {
      return [
        ...withPriority(grouped.High, "High"),
        ...withPriority(grouped.Medium, "Medium"),
        ...withPriority(grouped.Low, "Low"),
        ...withPriority(grouped.Archive, "Archive"),
      ];
    }

    return withPriority(grouped[activeTab], activeTab);
  }, [activeTab, grouped]);

  const totalPages = Math.max(1, Math.ceil(visibleNotes.length / NOTE_PAGE_SIZE));

  useEffect(() => {
    setNotesPageIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (notesPageIndex <= totalPages - 1) return;
    setNotesPageIndex(Math.max(0, totalPages - 1));
  }, [notesPageIndex, totalPages]);

  const pagedVisibleNotes = useMemo(() => {
    const start = notesPageIndex * NOTE_PAGE_SIZE;
    return visibleNotes.slice(start, start + NOTE_PAGE_SIZE);
  }, [notesPageIndex, visibleNotes]);

  function startEdit(note: NoteRow) {
    const parsed = splitNoteForEdit(String(note.comments ?? ""));
    setEditId(note.id);
    setEditForm({
      note_date: String(note.note_date ?? ""),
      title: parsed.title,
      body: parsed.body,
      priority: normalizePriority(note),
      show_on_dashboard: Boolean(note.show_on_dashboard ?? true),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({ note_date: "", title: "", body: "", priority: "Medium", show_on_dashboard: true });
  }

  async function saveEdit(id: number | string) {
    try {
      setIsSaving(true);
      const nextIsArchived = editForm.priority === "Archive";
      const comments = editForm.body.trim()
        ? `${editForm.title.trim()}\n\n${editForm.body.trim()}`
        : editForm.title.trim();
      await updateNote(id, {
        note_date: editForm.note_date || undefined,
        comments: comments || undefined,
        priority: editForm.priority,
        show_on_dashboard: editForm.show_on_dashboard,
        is_done: nextIsArchived,
      });
      await load();
      cancelEdit();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function markDone(id: number | string) {
    try {
      setIsSaving(true);
      await updateNote(id, { is_done: true, priority: "Archive" });
      await load();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreNote(id: number | string) {
    try {
      setIsSaving(true);
      await updateNote(id, { is_done: false, priority: "Medium" });
      await load();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number | string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    try {
      setIsSaving(true);
      await deleteNote(id);
      await load();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      <section>
        <div className="card">
          <div className="notes-page-shell">
            <div className="notes-page-head">
              <h2>Notes</h2>
              <p className="notes-page-sub">Keep outreach and follow-up messages organized by priority.</p>
            </div>
            {isLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="notes-tab-row" role="tablist" aria-label="Notes filters">
                  {NOTE_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`notes-tab${activeTab === tab ? " is-active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span>{tab}</span>
                      <span className="notes-tab-count">{tabCounts[tab]}</span>
                    </button>
                  ))}
                </div>
                {visibleNotes.length > NOTE_PAGE_SIZE ? (
                  <div className="notes-pager" aria-label="Notes pagination">
                    <button
                      type="button"
                      className="notes-pager-btn"
                      onClick={() => setNotesPageIndex((p) => Math.max(0, p - 1))}
                      disabled={notesPageIndex === 0}
                      aria-label="Previous notes"
                    >
                      ←
                    </button>
                    <span className="notes-pager-label">
                      {notesPageIndex + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="notes-pager-btn"
                      onClick={() => setNotesPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={notesPageIndex >= totalPages - 1}
                      aria-label="Next notes"
                    >
                      →
                    </button>
                  </div>
                ) : null}

                {visibleNotes.length === 0 ? (
                  <div className="notes-empty">No notes in this section.</div>
                ) : (
                  <div className="notes-board-grid">
                    {pagedVisibleNotes.map(({ note, priority }) => {
                      const full = String(note.comments ?? "");
                      const { title, body } = splitNote(full);
                      const isArchive = priority === "Archive";
                      return (
                        <article key={String(note.id)} className={`notes-card notes-card--${priority.toLowerCase()}`}>
                          <div className="notes-card-head">
                            <span className={`status-chip notes-priority-chip notes-priority-chip--${priority.toLowerCase()}`}>{priority}</span>
                            {note.note_date ? <span className="notes-card-date">{formatTableDate(note.note_date)}</span> : null}
                          </div>
                          <h3 className="notes-card-title">{title}</h3>
                          <p className={`notes-card-body${body ? "" : " notes-card-body--empty"}`}>
                            {body || "No additional details yet."}
                          </p>
                          <div className="notes-card-footer">
                            <div className="row-actions row-actions--notes">
                              <button type="button" className="action-btn" onClick={() => startEdit(note)}>
                                Edit
                              </button>
                              {isArchive ? (
                                <button type="button" className="action-btn" onClick={() => restoreNote(note.id)}>
                                  Restore
                                </button>
                              ) : (
                                <button type="button" className="action-btn" onClick={() => markDone(note.id)}>
                                  Archive
                                </button>
                              )}
                              <button type="button" className="action-btn" onClick={() => handleDelete(note.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {editId !== null ? (
        <div className="modal-overlay" onClick={() => !isSaving && cancelEdit()}>
          <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Note</h3>
            <form
              className="form form--two-col"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit(editId);
              }}
            >
              <div className="form-row">
                <label className="form-label">Current date</label>
                <input
                  type="date"
                  value={editForm.note_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, note_date: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={editForm.priority}
                  onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as NotePriority }))}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Archive">Archive</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">Show on Dashboard</label>
                <select
                  className="form-select"
                  value={editForm.show_on_dashboard ? "Yes" : "No"}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      show_on_dashboard: e.target.value === "Yes",
                    }))
                  }
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <textarea
                className="form-span-2"
                rows={6}
                value={editForm.body}
                onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
              />
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={cancelEdit} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
