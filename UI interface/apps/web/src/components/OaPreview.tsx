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
  if (!row.oa_deadline_date) return "oa-urgency-chip oa-urgency-chip--none";
  if (row.oa_urgency === "overdue") return "oa-urgency-chip oa-urgency-chip--overdue";
  if (row.oa_urgency === "today") return "oa-urgency-chip oa-urgency-chip--today";
  return "oa-urgency-chip oa-urgency-chip--upcoming";
}

function deadlineMeta(row: ActiveOaRecord): string {
  if (!row.oa_deadline_date || row.days_to_deadline == null) return "No deadline set";
  if (row.days_to_deadline < 0) return `${Math.abs(row.days_to_deadline)} day${Math.abs(row.days_to_deadline) === 1 ? "" : "s"} overdue`;
  if (row.days_to_deadline === 0) return "Needs action today";
  return `${row.days_to_deadline} day${row.days_to_deadline === 1 ? "" : "s"} left`;
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
          <div className="panel-count oa-panel-count">{rows.length} active</div>
          <div className="panel-scroll">
            <ul className="pending-list oa-list">
              {rows.map((row) => (
                <li key={String(row.id)} className={`pending-item oa-item${row.oa_urgency === "overdue" ? " is-overdue" : ""}`}>
                  <div className="pending-item-head">
                    <div className="title-row oa-title-row">
                      <strong className="oa-company">{String(row.company || "(no company)")}</strong>
                      <span className={deadlineChipClass(row)}>{deadlineLabel(row)}</span>
                    </div>
                    <button className="oa-done-btn" onClick={() => onDone(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "..." : "OA Done"}
                    </button>
                  </div>
                  <div className="pending-meta-row oa-meta-row">
                    {row.role ? <span className="oa-role">{String(row.role)}</span> : <span className="oa-role">Role not set</span>}
                    {row.job_application_id ? <span className="oa-id">ID {String(row.job_application_id)}</span> : null}
                  </div>
                  <div className="oa-deadline-meta">{deadlineMeta(row)}</div>
                  {row.notes ? (
                    <div className="pending-comment clamp-2 oa-note">{String(row.notes)}</div>
                  ) : null}
                  <div className="oa-row-shine" aria-hidden />
                  <div className="oa-accent-bar" aria-hidden />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
