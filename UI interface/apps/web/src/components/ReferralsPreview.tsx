import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReferrals } from "../lib/api";
import { formatTableDate } from "../lib/formatDate";
import Spinner from "./Spinner";

export default function ReferralsPreview() {
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        setLoading(true);
        const res = await getReferrals({ page: 1, limit: 10, filter: "open" });
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
        <div className="chart-empty">No open referrals.</div>
      ) : (
        <>
          <div className="panel-count">{rows.length} open</div>
          <div className="panel-scroll">
            <ul className="pending-list">
              {rows.map((r) => (
                <li key={String(r.id)} className="pending-item">
                  <div className="pending-item-head">
                    <div className="title-row">
                      <strong>{String(r.company || "(no company)")}</strong>
                      <span className="status-chip status-chip--requested">
                        {String(r.referral_received ?? "Requested")}
                      </span>
                    </div>
                  </div>
                  <div className="pending-meta-row">
                    {r.request_log ? <span>{String(r.request_log)}</span> : null}
                    {r.request_date ? <span>· {formatTableDate(r.request_date)}</span> : null}
                  </div>
                  {r.comment ? (
                    <div className="pending-comment clamp-2">{String(r.comment)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <p className="panel-footer-right" style={{ marginTop: 12, fontSize: "0.85rem" }}>
        <Link to="/referrals" className="table-link">
          View all referrals
        </Link>
      </p>
    </div>
  );
}
