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

export default function MobileApplicationCards({
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
    <section className="mobile-applications-cards" aria-label="Job applications">
      {rows.map((row, idx) => {
        const status = getStatusMeta(String(row.application_status ?? "Applied"));
        const hasJobLink = Boolean(row.job_link);
        return (
          <article key={`mobile-app-${String(row.id)}`} className="mobile-application-card">
            <header className="mobile-application-card__head">
              <div className="mobile-application-card__title-group">
                <h3 className="mobile-application-card__company">{capitalizeFirst(String(row.company ?? "-"))}</h3>
                <p className="mobile-application-card__role" title={String(row.role ?? "-")}>
                  {String(row.role ?? "-")}
                </p>
              </div>
              <span className={status.cls}>{status.label}</span>
            </header>

            <dl className="mobile-application-card__meta">
              <div>
                <dt>Date Applied</dt>
                <dd>{getAppliedAt(row, statusFilter)}</dd>
              </div>
              <div>
                <dt>Entry</dt>
                <dd>{(page - 1) * limit + idx + 1}</dd>
              </div>
            </dl>

            <div className="mobile-application-card__actions">
              {hasJobLink ? (
                <a
                  href={String(row.job_link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-application-card__btn"
                >
                  View
                </a>
              ) : (
                <button type="button" className="mobile-application-card__btn" disabled>
                  View
                </button>
              )}
              <button type="button" className="mobile-application-card__btn" onClick={() => openEdit(row)}>
                Edit
              </button>
              {statusFilter !== "rejected" ? (
                <button
                  type="button"
                  className="mobile-application-card__btn"
                  onClick={() => onArchive(row)}
                  disabled={archivingId === row.id}
                >
                  {archivingId === row.id ? "Archiving..." : "Archive"}
                </button>
              ) : null}
              <button
                type="button"
                className="mobile-application-card__btn mobile-application-card__btn--danger"
                onClick={() => onDelete(row)}
                disabled={deletingId === row.id}
              >
                {deletingId === row.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

