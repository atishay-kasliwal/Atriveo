import { useEffect, useState } from "react";
import { completeOa, getActiveOa, type ActiveOaRecord } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";
import Spinner from "./Spinner";

function deadlineLabel(row: ActiveOaRecord): string {
  if (!row.oa_deadline_date) return "No deadline";
  if (row.oa_urgency === "overdue") return `Overdue (${formatTableDate(row.oa_deadline_date)})`;
  if (row.oa_urgency === "today") return "Due today";
  return `Due ${formatTableDate(row.oa_deadline_date)}`;
}

function deadlineChipClass(row: ActiveOaRecord): string {
  if (!row.oa_deadline_date) return "status-chip status-chip--note";
  if (row.oa_urgency === "overdue") return "status-chip status-chip--rejected";
  if (row.oa_urgency === "today") return "status-chip status-chip--requested";
  return "status-chip status-chip--open";
}

export default function OaPreview() {
  const [rows, setRows] = useState<ActiveOaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | string | null>(null);

  async function load() {
    try {
      setError("");
      setLoading(true);
      const res = await getActiveOa();
      setRows(res.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDone(row: ActiveOaRecord) {
    try {
      setBusyId(row.id);
      setError("");
      const result = await completeOa(row.id);
      await load();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      if (result.already_completed) {
        setError("Already completed. Record was refreshed in archive.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

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
        <div className="chart-empty" style={{ minHeight: 80 }}>
          No active OA items.
        </div>
      ) : (
        <>
          <div className="panel-count">{rows.length} active</div>
          <div className="panel-scroll">
            <ul className="pending-list">
              {rows.map((row) => (
                <li key={String(row.id)} className="pending-item">
                  <div className="pending-item-head">
                    <div className="title-row">
                      <strong>{String(row.company || "(no company)")}</strong>
                      <span className={deadlineChipClass(row)}>{deadlineLabel(row)}</span>
                    </div>
                    <button className="small-ghost" onClick={() => onDone(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "..." : "OA Done"}
                    </button>
                  </div>
                  <div className="pending-meta-row">
                    {row.role ? <span>{String(row.role)}</span> : <span>Role not set</span>}
                    {row.job_application_id ? <span>· ID {String(row.job_application_id)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
