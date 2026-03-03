import { useEffect, useState } from "react";
import { getPending, markPendingDone } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";
import Spinner from "./Spinner";

export default function PendingPreview() {
  const [pendingItems, setPendingItems] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const pendingRes = await getPending(false);
      setPendingItems(pendingRes.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDone(id: number | string) {
    try {
      await markPendingDone(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function dueInfo(value: unknown): { label: string; tone: "normal" | "overdue" } | null {
    if (!value) return null;
    const raw = String(value);
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tone: "normal" | "overdue" = date.getTime() < today.getTime() ? "overdue" : "normal";
    return { label: formatTableDate(raw), tone };
  }

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
      {pendingItems.length === 0 ? (
        <div className="chart-empty" style={{ minHeight: 80 }}>
          No pending items. All clear.
        </div>
      ) : (
        <>
          <div className="panel-count">{pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""}</div>
          <div className="panel-scroll">
            <ul className="pending-list">
              {pendingItems.map((it: any) => {
                const due = dueInfo(it.end_date);
                return (
                <li key={it.id} className="pending-item">
                  <div className="pending-item-head">
                    <div className="title-row">
                      <strong>{it.company || "(no company)"}</strong>
                      <span className="status-chip status-chip--pending">Pending</span>
                    </div>
                    <button className="small-ghost" onClick={() => handleDone(it.id)}>
                      Done
                    </button>
                  </div>
                  <div className="pending-meta-row">
                    {it.position_name ? <span>{it.position_name}</span> : null}
                    {it.pending_date ? <span>· {formatTableDate(it.pending_date)}</span> : null}
                  </div>
                  {due ? (
                    <div className={`pending-due-line pending-due-line--${due.tone}`}>
                      Due: <strong>{due.label}</strong>
                    </div>
                  ) : null}
                  {it.comment ? (
                    <div className="pending-comment clamp-2">{it.comment}</div>
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
