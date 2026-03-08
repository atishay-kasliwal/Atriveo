import type { Dispatch, SetStateAction } from "react";
import { APPLICATION_PIPELINE_STAGES, CARD_LIMIT } from "../../constants";
import { getKeywordMatchTier } from "../../utils/formatters";

type SampleCard = {
  company: string;
  role: string;
  appliedDate: string;
  appliedDateTime: string;
  referredBy: string;
  jobId: string;
  keywordMatch: number;
  progress: number;
};

type Props = {
  filteredSampleCardsLength: number;
  pagedSampleCards: SampleCard[];
  cardStartIndex: number;
  hasCardPrev: boolean;
  hasCardNext: boolean;
  cardPaginationItems: Array<number | "ellipsis">;
  safeCardPage: number;
  totalCardPages: number;
  setCardPage: Dispatch<SetStateAction<number>>;
};

export default function ActiveJobsCardsColumn({
  filteredSampleCardsLength,
  pagedSampleCards,
  cardStartIndex,
  hasCardPrev,
  hasCardNext,
  cardPaginationItems,
  safeCardPage,
  totalCardPages,
  setCardPage,
}: Props) {
  return (
    <section className="active-jobs-main-column">
      <div className="active-jobs-main-heading">
        <h2>Active Applications</h2>
        <span>
          Showing {pagedSampleCards.length} of {filteredSampleCardsLength}
        </span>
      </div>
      {pagedSampleCards.map((card, idx) => (
        <article key={`${card.company}-${card.role}-${idx}`} className="application-card">
          <section className="application-card-summary">
            <header className="application-card-header">
              <span className="application-card-count" aria-hidden>{cardStartIndex + idx + 1}</span>
              <span className="application-card-logo" aria-hidden>
                {card.company.slice(0, 2).toUpperCase()}
              </span>
              <div className="application-card-title">
                <h3>{card.company}</h3>
                <p className="application-card-role">{card.role} - Job ID: {card.jobId}</p>
              </div>
            </header>

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

            <aside className="application-card-status">
              <div className="application-card-quick-actions" aria-label="Card quick actions">
                <button type="button" aria-label="Link">
                  <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                    <path d="M8.2 11.8a2.5 2.5 0 0 0 3.6 0l2.8-2.8a2.5 2.5 0 1 0-3.6-3.6l-1 1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.8 8.2a2.5 2.5 0 0 0-3.6 0L5.4 11a2.5 2.5 0 1 0 3.6 3.6l1-1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" aria-label="Edit">
                  <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                    <path d="M3 14.8V17h2.2l8-8-2.2-2.2-8 8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10.8 4.8 13 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" aria-label="Archive">
                  <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                    <rect x="3" y="4" width="14" height="3.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4.5 7.5h11v7.3a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2V7.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 10h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </aside>
          </section>

          <hr className="application-card-divider" />

          <div className="application-card-bottom">
            <section className="application-card-metadata" aria-label="Secondary metadata">
              <span className="application-card-tag">Referral: {card.referredBy}</span>
              <span className="application-card-tag">Keyword Match: {getKeywordMatchTier(card.keywordMatch)}</span>
              <span className="application-card-tag application-card-tag--applied">
                Applied: {card.appliedDateTime || card.appliedDate}
              </span>
            </section>
          </div>
        </article>
      ))}
      {filteredSampleCardsLength === 0 ? <div className="empty-state">No cards match your smart filters.</div> : null}
      {filteredSampleCardsLength > 0 ? (
        <div className="application-card-pagination">
          <div className="application-card-pagination-inner" role="navigation" aria-label="Card pagination">
            <button type="button" disabled={!hasCardPrev} onClick={() => setCardPage((p) => p - 1)}>Prev</button>
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
            <button type="button" disabled={!hasCardNext} onClick={() => setCardPage((p) => p + 1)}>Next</button>
          </div>
          <span className="application-card-pagination-meta">Page {safeCardPage} of {totalCardPages}</span>
          <span className="application-card-pagination-rows">{CARD_LIMIT} rows per page</span>
        </div>
      ) : null}
    </section>
  );
}
