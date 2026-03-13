import type { Dispatch, SetStateAction } from "react";
import { APPLICATION_PIPELINE_STAGES } from "../../constants";

type ActiveCard = {
  id: number | string;
  company: string;
  companyLogoUrl: string;
  companyLogoKind: "brand" | "favicon" | "fallback";
  role: string;
  appliedDate: string;
  appliedDateTime: string;
  referredBy: string;
  jobId: string;
  keywordMatch: string;
  progress: number;
  jobLink: string;
  raw: Record<string, unknown>;
};

function getCompanyInitials(company: string): string {
  const parts = String(company || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

type Props = {
  isLoading: boolean;
  cardsError: string;
  filteredSampleCardsLength: number;
  pagedSampleCards: ActiveCard[];
  cardStartIndex: number;
  hasCardPrev: boolean;
  hasCardNext: boolean;
  cardPaginationItems: Array<number | "ellipsis">;
  safeCardPage: number;
  totalCardPages: number;
  setCardPage: Dispatch<SetStateAction<number>>;
  archivingId: number | string | null;
  openCardLink: (card: ActiveCard) => void;
  openCardEdit: (card: ActiveCard) => void;
  onArchiveCard: (card: ActiveCard) => void;
};

export default function ActiveJobsCardsColumn({
  isLoading,
  cardsError,
  filteredSampleCardsLength,
  pagedSampleCards,
  cardStartIndex,
  hasCardPrev,
  hasCardNext,
  cardPaginationItems,
  safeCardPage,
  totalCardPages,
  setCardPage,
  archivingId,
  openCardLink,
  openCardEdit,
  onArchiveCard,
}: Props) {
  return (
    <section className="active-jobs-main-column">
      <div className="active-jobs-card-list">
        {isLoading && pagedSampleCards.length === 0
          ? Array.from({ length: 3 }).map((_, idx) => (
              <article key={`application-skeleton-${idx}`} className="application-card application-card--skeleton" aria-hidden>
                <div className="active-jobs-skeleton-line is-wide" />
                <div className="active-jobs-skeleton-line is-medium" />
                <div className="active-jobs-skeleton-line is-chip" />
                <div className="active-jobs-skeleton-pipeline" />
              </article>
            ))
          : null}
        {pagedSampleCards.map((card, idx) => {
          const hasLogo = Boolean(card.companyLogoUrl);
          const logoShellClass = [
            "application-card-logo",
            hasLogo ? "has-image" : "is-fallback",
            card.companyLogoKind === "favicon" ? "is-favicon" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const logoImageClass = [
            "application-card-logo-image",
            card.companyLogoKind === "favicon" ? "is-favicon" : "is-brand",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <article key={`${String(card.id)}-${idx}`} className="application-card">
              <div className="application-card-top">
                <header className="application-card-header">
                  <span className="application-card-count" aria-hidden>{cardStartIndex + idx + 1}</span>
                  <span className={logoShellClass} aria-hidden>
                    {hasLogo ? (
                      <>
                        <img
                          src={card.companyLogoUrl}
                          alt=""
                          className={logoImageClass}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            const img = event.currentTarget;
                            img.style.display = "none";
                            const fallback = img.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "inline-flex";
                          }}
                        />
                        <span className="application-card-logo-fallback" style={{ display: "none" }}>
                          {getCompanyInitials(card.company)}
                        </span>
                      </>
                    ) : (
                      <span className="application-card-logo-fallback">{getCompanyInitials(card.company)}</span>
                    )}
                  </span>
                  <div className="application-card-title">
                    <h3>{card.company}</h3>
                    <p className="application-card-role">{card.role} - Job ID: {card.jobId}</p>
                  </div>
                </header>
                <div className="application-card-actions-inline" role="group" aria-label="Application actions">
                  <button type="button" className="is-link" onClick={() => openCardLink(card)} disabled={!card.jobLink}>
                    Link
                  </button>
                  <button type="button" className="is-edit" onClick={() => openCardEdit(card)}>
                    Edit
                  </button>
                  <button type="button" className="is-archive" onClick={() => onArchiveCard(card)} disabled={archivingId === card.id}>
                    {archivingId === card.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>

              <div className="application-card-meta-row">
                <section className="application-card-metadata" aria-label="Secondary metadata">
                  <span className="application-card-tag">Referral: {card.referredBy}</span>
                  <span className="application-card-tag">Keyword Match: {card.keywordMatch || "-"}</span>
                </section>
                <span className="application-card-applied">Applied: {card.appliedDateTime || card.appliedDate}</span>
              </div>

              <div className="application-card-pipeline" aria-label="Pipeline progress">
                <div className="application-card-pipeline-track" aria-hidden>
                  {APPLICATION_PIPELINE_STAGES.map((stage, idx) => (
                    <div key={`${card.company}-${stage}`} className="application-card-pipeline-step">
                      <span className={`application-card-pipeline-node${idx <= card.progress ? " is-complete" : ""}`} />
                      {idx < APPLICATION_PIPELINE_STAGES.length - 1 ? (
                        <span className={`application-card-pipeline-line${idx < card.progress ? " is-complete" : ""}`} />
                      ) : null}
                    </div>
                  ))}
                </div>
                <div
                  className="application-card-pipeline-labels"
                  style={{ gridTemplateColumns: `repeat(${APPLICATION_PIPELINE_STAGES.length}, minmax(0, 1fr))` }}
                >
                  {APPLICATION_PIPELINE_STAGES.map((stage) => (
                    <span key={`${card.company}-${stage}-label`}>{stage}</span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!isLoading && cardsError && filteredSampleCardsLength === 0 ? <div className="empty-state">{cardsError}</div> : null}
      {!isLoading && !cardsError && filteredSampleCardsLength === 0 ? (
        <div className="empty-state">No cards match your smart filters.</div>
      ) : null}
      {filteredSampleCardsLength > 0 && pagedSampleCards.length > 0 ? (
        <div className="application-card-pagination">
          <div className="application-card-pagination-inner" role="navigation" aria-label={`Card pagination, page ${safeCardPage} of ${totalCardPages}`}>
            <button type="button" className="is-first" disabled={!hasCardPrev} onClick={() => setCardPage(1)} aria-label="First page">
              &lt;&lt;
            </button>
            {hasCardPrev ? (
              <button type="button" className="is-prev" onClick={() => setCardPage((p) => p - 1)}>
                &lt;
              </button>
            ) : (
              <button type="button" className="is-prev" disabled aria-label="Previous page">
                &lt;
              </button>
            )}
            <div className="application-card-pagination-pages">
              {cardPaginationItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="application-card-pagination-ellipsis" aria-hidden>...</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={item === safeCardPage ? "is-page is-active" : "is-page"}
                    onClick={() => setCardPage(item)}
                    aria-current={item === safeCardPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
            <button type="button" className="is-next" disabled={!hasCardNext} onClick={() => setCardPage((p) => p + 1)}>
              &gt;
            </button>
            <button type="button" className="is-last" disabled={!hasCardNext} onClick={() => setCardPage(totalCardPages)} aria-label="Last page">
              &gt;&gt;
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
