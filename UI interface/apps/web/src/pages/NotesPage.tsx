import { useEffect, useMemo, useState } from "react";
import Spinner from "../components/Spinner";
import { deleteNote, getNotes, updateNote } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";

type NotePriority = "High" | "Medium" | "Low" | "Archive";

type NoteRow = Record<string, any>;

const ACTIVE_PRIORITIES: NotePriority[] = ["High", "Medium", "Low"];

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
  const [expanded, setExpanded] = useState<Record<NotePriority, boolean>>({
    High: true,
    Medium: false,
    Low: false,
    Archive: false,
  });

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

  function toggleSection(priority: NotePriority) {
    setExpanded((prev) => ({ ...prev, [priority]: !prev[priority] }));
  }

  function renderSection(priority: NotePriority, items: NoteRow[]) {
    const isArchive = priority === "Archive";
    return (
      <div key={priority} className="notes-section">
        <button
          type="button"
          className="notes-section-head"
          onClick={() => toggleSection(priority)}
          aria-expanded={expanded[priority]}
        >
          <div className="notes-section-title-wrap">
            <span className={`status-chip notes-priority-chip notes-priority-chip--${priority.toLowerCase()}`}>{priority}</span>
            <span className="notes-section-count">{items.length}</span>
          </div>
          <span className={`notes-section-arrow ${expanded[priority] ? "open" : ""}`}>▾</span>
        </button>

        {expanded[priority] ? (
          items.length === 0 ? (
            <div className="notes-empty">No notes in this section.</div>
          ) : (
            <div className="notes-board-grid">
              {items.map((n) => {
                const full = String(n.comments ?? "");
                const { title, body } = splitNote(full);
                return (
                  <article key={String(n.id)} className="notes-card">
                    <div className="notes-card-head">
                      <strong>{title}</strong>
                    </div>
                    {body ? <p className="notes-card-body">{body}</p> : null}
                    <div className="notes-card-footer">
                      <div className="row-actions row-actions--notes">
                        <button type="button" className="action-btn" onClick={() => startEdit(n)}>
                          Edit
                        </button>
                        {isArchive ? (
                          <button type="button" className="action-btn" onClick={() => restoreNote(n.id)}>
                            Restore
                          </button>
                        ) : (
                          <button type="button" className="action-btn" onClick={() => markDone(n.id)}>
                            Archive
                          </button>
                        )}
                        <button type="button" className="action-btn" onClick={() => handleDelete(n.id)}>
                          Delete
                        </button>
                      </div>
                      {n.note_date ? <span className="pending-meta notes-card-date">{formatTableDate(n.note_date)}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      <section>
        <div className="card">
          <h2>Notes</h2>
          {isLoading ? <Spinner /> : <div className="notes-board">{(["High", "Medium", "Low", "Archive"] as NotePriority[]).map((p) => renderSection(p, grouped[p]))}</div>}
        </div>
      </section>

      {editId !== null ? (
        <div className="modal-overlay" onClick={() => !isSaving && cancelEdit()}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Note</h3>
            <form
              className="form"
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
