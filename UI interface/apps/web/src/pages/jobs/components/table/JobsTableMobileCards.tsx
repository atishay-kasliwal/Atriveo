import { formatTableDateTime } from "../../../../lib/formatDate";

type Props = {
  rows: Array<Record<string, unknown>>;
  page: number;
  limit: number;
  statusFilter?: string;
  archivingId: number | string | null;
  deletingId: number | string | null;
  openEdit: (job: Record<string, unknown>) => void;
  onArchive: (job: Record<string, unknown>) => void;
  onDelete: (job: Record<string, unknown>) => void;
  getStatusMeta: (raw: string) => { label: string; cls: string };
  capitalizeFirst: (value: string) => string;
};

function getAppliedAt(value: Record<string, unknown>, statusFilter?: string) {
  const applied = (value as any).applied_at
    ? (value as any).applied_at
    : statusFilter === "rejected"
      ? (value as any).archive_date ?? value.date_saved
      : value.date_saved;
  return formatTableDateTime(applied);
}

export default function JobsTableMobileCards({
  rows,
  page,
  limit,
  statusFilter,
  archivingId,
  deletingId,
  openEdit,
  onArchive,
  onDelete,
  getStatusMeta,
  capitalizeFirst,
}: Props) {
  return (
    <div className="jobs-mobile-cards" aria-label="Jobs cards">
      {rows.map((row, idx) => {
        const status = getStatusMeta(String(row.application_status ?? "Applied"));
        return (
          <article key={`job-mobile-${String(row.id)}`} className="jobs-mobile-card">
            <header className="jobs-mobile-card-head">
              <div className="jobs-mobile-card-title-wrap">
                <p className="jobs-mobile-card-company">{capitalizeFirst(String(row.company ?? "-"))}</p>
                <h3 className="jobs-mobile-card-role" title={String(row.role ?? "-")}>
                  {String(row.role ?? "-")}
                </h3>
              </div>
              <span className={status.cls}>{status.label}</span>
            </header>

            <dl className="jobs-mobile-card-meta">
              <div>
                <dt>No.</dt>
                <dd>{(page - 1) * limit + idx + 1}</dd>
              </div>
              <div>
                <dt>Applied Date</dt>
                <dd>{getAppliedAt(row, statusFilter)}</dd>
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
              <button type="button" className="jobs-mobile-card-btn" onClick={() => openEdit(row)}>
                Edit
              </button>
              {statusFilter !== "rejected" ? (
                <button
                  type="button"
                  className="jobs-mobile-card-btn"
                  onClick={() => onArchive(row)}
                  disabled={archivingId === row.id}
                >
                  {archivingId === row.id ? "Archiving..." : "Archive"}
                </button>
              ) : null}
              <button
                type="button"
                className="jobs-mobile-card-btn jobs-mobile-card-btn--danger"
                onClick={() => onDelete(row)}
                disabled={deletingId === row.id}
              >
                {deletingId === row.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
