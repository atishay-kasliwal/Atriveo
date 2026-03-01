import { useEffect, useState } from "react";
import { getNotes } from "../lib/api";
import Spinner from "./Spinner";

export default function NotesPreview() {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNote, setSelectedNote] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        setLoading(true);
        const res = await getNotes({ page: 1, limit: 12, archive: false, show_on_dashboard: true });
        setRows(res.data ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ paddingTop: 8 }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="panel-shell">
      {error ? <div className="error">{error}</div> : null}
      {rows.length === 0 ? (
        <div className="chart-empty">No notes yet.</div>
      ) : (
        <>
          <div className="panel-scroll">
            <ul className="notes-preview-grid">
              {rows.map((n) => {
                const comments = String(n.comments ?? "");
                const [firstLine, ...rest] = comments.split("\n");
                const subtitle = rest
                  .map((line) => line.trim())
                  .map((line) => {
                    const m = /^last\\s*date\\s*:\\s*\\d{4}-\\d{2}-\\d{2}\\s*(.*)$/i.exec(line);
                    if (!m) return line;
                    return (m[1] ?? "").trim();
                  })
                  .filter((line) => line.length > 0)
                  .join("\n");
                return (
                  <li key={String(n.id)} className="notes-preview-card">
                    <button type="button" className="notes-preview-open" onClick={() => setSelectedNote(n)}>
                      <div className="pending-item-head">
                        <div className="title-row">
                          <strong>{firstLine || "(Untitled note)"}</strong>
                          {n.note_date ? (
                            <span className="pending-meta">{String(n.note_date)}</span>
                          ) : null}
                        </div>
                      </div>
                      {subtitle ? (
                        <div className="notes-preview-body">{subtitle}</div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {selectedNote ? (
        <div className="modal-overlay" onClick={() => setSelectedNote(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{String(selectedNote.comments ?? "").split("\n")[0]?.trim() || "(Untitled note)"}</h3>
            {selectedNote.note_date ? <div className="pending-meta">{String(selectedNote.note_date)}</div> : null}
            <div className="notes-preview-modal-body">
              {String(selectedNote.comments ?? "")
                .split("\n")
                .slice(1)
                .join("\n")
                .trim() || "No extra details."}
            </div>
            <div className="modal-actions">
              <button type="button" className="action-btn" onClick={() => setSelectedNote(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
