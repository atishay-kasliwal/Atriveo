import Spinner from "../../../components/Spinner";
import { formatTableDateTime } from "../../../lib/formatDate";
import useIsMobileViewport from "../../../hooks/useIsMobileViewport";
import type { SortField, SortOrder } from "../types";
import JobsTableHead from "./table/JobsTableHead";
import JobsTableMobileCards from "./table/JobsTableMobileCards";

type Props = {
  isLoading: boolean;
  data: Array<Record<string, unknown>>;
  sortedData: Array<Record<string, unknown>>;
  page: number;
  limit: number;
  totalPages: number;
  totalRows: number;
  hasPrev: boolean;
  hasNext: boolean;
  sortBy: SortField;
  sortOrder: SortOrder;
  sortConfig: { key: SortField; label: string }[];
  searchInput: string;
  statusFilter?: string;
  archivingId: number | string | null;
  deletingId: number | string | null;
  setSearchInput: (value: string) => void;
  setPage: (setter: (p: number) => number) => void;
  onSearch: (e: React.FormEvent) => void;
  handleSort: (field: SortField) => void;
  openEdit: (job: Record<string, unknown>) => void;
  onArchive: (job: Record<string, unknown>) => void;
  onDelete: (job: Record<string, unknown>) => void;
  getStatusMeta: (raw: string) => { label: string; cls: string };
  getKeywordMeta: (raw: string) => { label: string; cls: string };
  capitalizeFirst: (value: string) => string;
  normalizeReferralStatus: (value: unknown) => "Requested" | "Yes" | "No" | "";
  normalizeOaStatus: (value: unknown) => "Yes" | "No";
};

export default function JobsTable({
  isLoading,
  data,
  sortedData,
  page,
  limit,
  totalPages,
  totalRows,
  hasPrev,
  hasNext,
  sortBy,
  sortOrder,
  sortConfig,
  searchInput,
  statusFilter,
  archivingId,
  deletingId,
  setSearchInput,
  setPage,
  onSearch,
  handleSort,
  openEdit,
  onArchive,
  onDelete,
  getStatusMeta,
  getKeywordMeta,
  capitalizeFirst,
  normalizeReferralStatus,
  normalizeOaStatus,
}: Props) {
  const isMobile = useIsMobileViewport();

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="jobs-header">
        <h2>Jobs</h2>
        <form className="jobs-search-row" onSubmit={onSearch}>
          <input
            className="jobs-search-input"
            type="search"
            placeholder="Search anything"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search jobs by any field"
          />
          <button type="submit" className="jobs-search-btn">Search</button>
        </form>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <div className="empty-state">
          No jobs found. Add one from the Dashboard.
        </div>
      ) : (
        <>
          {isMobile ? (
            <JobsTableMobileCards
              rows={sortedData}
              page={page}
              limit={limit}
              statusFilter={statusFilter}
              archivingId={archivingId}
              deletingId={deletingId}
              openEdit={openEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              getStatusMeta={getStatusMeta}
              capitalizeFirst={capitalizeFirst}
            />
          ) : (
            <div className="table-wrap">
              <table className="jobs-table">
                <JobsTableHead
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
                <tbody>
                  {sortedData.map((j, idx) => (
                    <tr
                      key={String(j.id)}
                      className={`tr-hover ${normalizeReferralStatus(j.referral_status) === "Yes" ? "data-referral" : ""} ${
                        String(j.application_status ?? "") === "Rejected" ? "data-rejected" : ""
                      } ${normalizeReferralStatus(j.referral_status) === "No" ? "data-no" : ""
                      }`}
                    >
                      <td className="jobs-col-no">{(page - 1) * limit + idx + 1}</td>
                      <td>
                        {formatTableDateTime(
                          (j as any).applied_at
                            ? (j as any).applied_at
                            : (statusFilter === "rejected" ? ((j as any).archive_date ?? j.date_saved) : j.date_saved),
                        )}
                      </td>
                      <td>
                        <div className="job-main">
                          <div className="job-company">{capitalizeFirst(String(j.company ?? "-"))}</div>
                          <div className="job-role" title={String(j.role ?? "-")}>
                            {String(j.role ?? "-")}
                          </div>
                        </div>
                      </td>
                      <td>{normalizeReferralStatus(j.referral_status) || "-"}</td>
                      <td>{String((j as any).referred_by_name ?? "-") || "-"}</td>
                      <td>
                        <span className={getKeywordMeta(String((j as any).keyword_matching ?? "Medium")).cls}>
                          {getKeywordMeta(String((j as any).keyword_matching ?? "Medium")).label}
                        </span>
                      </td>
                      <td>{normalizeOaStatus((j as any).oa_status)}</td>
                      <td>{String((j as any).oa_deadline_date ?? "-") || "-"}</td>
                      <td>{String((j as any).job_application_id ?? "-")}</td>
                      <td>
                        {j.job_link ? (
                          <a
                            href={String(j.job_link)}
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
                        <span className={getStatusMeta(String(j.application_status ?? "Applied")).cls}>
                          {getStatusMeta(String(j.application_status ?? "Applied")).label}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="action-btn" onClick={() => openEdit(j)}>
                            Edit
                          </button>
                          {statusFilter !== "rejected" ? (
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => onArchive(j)}
                              disabled={archivingId === j.id}
                              title="Archive application"
                              aria-label="Archive application"
                            >
                              {archivingId === j.id ? "…" : "Archive"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => onDelete(j)}
                            disabled={deletingId === j.id}
                            aria-label="Delete job"
                          >
                            {deletingId === j.id ? "…" : "🗑️"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination">
            <button type="button" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span>Page {page} of {totalPages} • {totalRows} total</span>
            <button type="button" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
