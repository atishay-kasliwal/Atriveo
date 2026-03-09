import Spinner from "../../../components/Spinner";
import { formatTableDateTime } from "../../../lib/formatDate";
import useIsMobileViewport from "../../../hooks/useIsMobileViewport";
import { getOaResultLabel } from "../utils/formatters";

type Props = {
  statusFilter?: string;
  oaArchiveError: string;
  oaArchiveLoading: boolean;
  oaArchiveData: Array<Record<string, unknown>>;
  oaDeletingId: number | string | null;
  openOaEdit: (row: Record<string, unknown>) => void;
  onDeleteOaRecord: (row: Record<string, unknown>) => void;
  capitalizeFirst: (value: string) => string;
  normalizeOaStatus: (value: unknown) => "Yes" | "No";
};

export default function OaArchiveTable({
  statusFilter,
  oaArchiveError,
  oaArchiveLoading,
  oaArchiveData,
  oaDeletingId,
  openOaEdit,
  onDeleteOaRecord,
  capitalizeFirst,
  normalizeOaStatus,
}: Props) {
  if (statusFilter !== "rejected") return null;
  const isMobile = useIsMobileViewport(640);

  return (
    <div className="card" style={{ padding: "24px", marginTop: "20px" }}>
      <div className="jobs-header">
        <h2>Online Assessment Records</h2>
        <p className="chart-subtitle">Completed and missed OA archive</p>
      </div>
      {oaArchiveError ? <div className="error">{oaArchiveError}</div> : null}
      {oaArchiveLoading ? (
        <Spinner />
      ) : oaArchiveData.length === 0 ? (
        <div className="empty-state">No OA records yet. Mark "OA Done" from Dashboard to add records.</div>
      ) : (
        isMobile ? (
          <div className="jobs-mobile-cards jobs-mobile-cards--oa" aria-label="OA archive cards">
            {oaArchiveData.map((row, idx) => (
              <article key={`oa-mobile-${String(row.id)}`} className="jobs-mobile-card">
                <header className="jobs-mobile-card-head">
                  <div className="jobs-mobile-card-title-wrap">
                    <p className="jobs-mobile-card-company">{capitalizeFirst(String(row.company ?? "-"))}</p>
                    <h3 className="jobs-mobile-card-role" title={String(row.role ?? "-")}>
                      {String(row.role ?? "-")}
                    </h3>
                  </div>
                  <span className="status-chip status-chip--rejected">{getOaResultLabel(row)}</span>
                </header>
                <dl className="jobs-mobile-card-meta">
                  <div>
                    <dt>No.</dt>
                    <dd>{idx + 1}</dd>
                  </div>
                  <div>
                    <dt>Record Date</dt>
                    <dd>{formatTableDateTime((row as any).oa_result_date ?? row.oa_completed_date)}</dd>
                  </div>
                </dl>
                <div className="jobs-mobile-card-actions">
                  {row.job_link ? (
                    <a
                      href={String(row.job_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="jobs-mobile-card-btn jobs-mobile-card-btn--link"
                    >
                      Open
                    </a>
                  ) : null}
                  <button type="button" className="jobs-mobile-card-btn" onClick={() => openOaEdit(row)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="jobs-mobile-card-btn jobs-mobile-card-btn--danger"
                    onClick={() => onDeleteOaRecord(row)}
                    disabled={oaDeletingId === row.id}
                  >
                    {oaDeletingId === row.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap table-wrap--tablet-scroll">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Record Date</th>
                  <th>Status</th>
                  <th>Company / Position</th>
                  <th>OA Deadline</th>
                  <th>Job/App ID</th>
                  <th>OA</th>
                  <th>Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {oaArchiveData.map((row, idx) => (
                  <tr key={`oa-archive-${String(row.id)}`} className="tr-hover">
                    <td className="jobs-col-no">{idx + 1}</td>
                    <td>{formatTableDateTime((row as any).oa_result_date ?? row.oa_completed_date)}</td>
                    <td>{getOaResultLabel(row)}</td>
                    <td>
                      <div className="job-main">
                        <div className="job-company">{capitalizeFirst(String(row.company ?? "-"))}</div>
                        <div className="job-role" title={String(row.role ?? "-")}>
                          {String(row.role ?? "-")}
                        </div>
                      </div>
                    </td>
                    <td>{String(row.oa_deadline_date ?? "-") || "-"}</td>
                    <td>{String(row.job_application_id ?? "-") || "-"}</td>
                    <td>{normalizeOaStatus(row.oa_status)}</td>
                    <td>
                      {row.job_link ? (
                        <a
                          href={String(row.job_link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="table-link"
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="action-btn" onClick={() => openOaEdit(row)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => onDeleteOaRecord(row)}
                          disabled={oaDeletingId === row.id}
                        >
                          {oaDeletingId === row.id ? "…" : "🗑️"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
