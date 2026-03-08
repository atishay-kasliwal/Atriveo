import type { Dispatch, SetStateAction } from "react";
import { APPLICATION_PIPELINE_STAGES } from "../../constants";
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
      <div className="active-jobs-card-list">
        {pagedSampleCards.map((card, idx) => (
          <article key={`${card.company}-${card.role}-${idx}`} className="application-card">
            <div className="application-card-top">
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
              <div className="application-card-actions-inline" role="group" aria-label="Application actions">
                <button type="button" className="is-link">Link</button>
                <button type="button" className="is-edit">Edit</button>
                <button type="button" className="is-archive">Archive</button>
              </div>
            </div>

            <div className="application-card-meta-row">
              <section className="application-card-metadata" aria-label="Secondary metadata">
                <span className="application-card-tag">Referral: {card.referredBy}</span>
                <span className="application-card-tag">Keyword Match: {getKeywordMatchTier(card.keywordMatch)}</span>
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
        ))}
      </div>
      {filteredSampleCardsLength === 0 ? <div className="empty-state">No cards match your smart filters.</div> : null}
      {filteredSampleCardsLength > 0 ? (
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
