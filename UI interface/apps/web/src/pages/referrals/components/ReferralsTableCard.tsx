import Spinner from "../../../components/Spinner";
import { formatTableDate } from "../../../lib/formatDate";
import { textOrDash } from "../utils";

type Props = {
  title: string;
  addButtonLabel: string;
  onAddClick: () => void;
  isLoading: boolean;
  hasData: boolean;
  emptyText: string;
  rows: Array<Record<string, unknown>>;
  page: number;
  limit: number;
  hasPrev: boolean;
  hasNext: boolean;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  deletingId: number | string | null;
  openEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  dateHeader: string;
  rowClassName?: string;
  cardStyle?: React.CSSProperties;
};

export default function ReferralsTableCard({
  title,
  addButtonLabel,
  onAddClick,
  isLoading,
  hasData,
  emptyText,
  rows,
  page,
  limit,
  hasPrev,
  hasNext,
  setPage,
  deletingId,
  openEdit,
  onDelete,
  dateHeader,
  rowClassName = "tr-hover",
  cardStyle,
}: Props) {
  return (
    <div className="card" style={cardStyle}>
      <div className="referrals-head">
        <h2>{title}</h2>
        <button type="button" className="jobs-search-btn" onClick={onAddClick}>
          {addButtonLabel}
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !hasData ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="referrals-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>{dateHeader}</th>
                  <th>Company / Position</th>
                  <th>Status</th>
                  <th>Referral Name</th>
                  <th>Notes</th>
                  <th>Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isDummy = Boolean((r as { __dummy?: boolean }).__dummy);
                  return (
                    <tr key={String(r.id)} className={rowClassName}>
                      <td className="table-col-no">{(page - 1) * limit + idx + 1}</td>
                      <td>{formatTableDate((r as any).updated_date || r.request_date)}</td>
                      <td>
                        <div className="job-main referral-job-main">
                          <div className="job-company" title={textOrDash(r.company)}>{textOrDash(r.company)}</div>
                          <div className="job-role referral-job-role" title={textOrDash(r.request_log)}>{textOrDash(r.request_log)}</div>
                        </div>
                      </td>
                      <td>{textOrDash(r.referral_received)}</td>
                      <td className="referrals-col-name" title={textOrDash(r.referred_by_name)}>{textOrDash(r.referred_by_name)}</td>
                      <td className="referrals-col-notes" title={textOrDash(r.comment)}>{textOrDash(r.comment)}</td>
                      <td>
                        {r.request_link ? (
                          <a href={String(r.request_link)} target="_blank" rel="noopener noreferrer" className="table-link">
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {isDummy ? (
                          "—"
                        ) : (
                          <div className="referrals-row-actions">
                            <button type="button" className="action-btn" onClick={() => openEdit(r)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => onDelete(r)}
                              disabled={deletingId === r.id}
                              aria-label="Delete referral"
                            >
                              {deletingId === r.id ? "…" : "🗑️"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button type="button" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span>Page {page}</span>
            <button type="button" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
