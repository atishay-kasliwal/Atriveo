import { useEffect, useState } from "react";
import { getNotes } from "../lib/api";
import Spinner from "./Spinner";

export default function NotesPreview() {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    <div>
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
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
