import { type Dispatch, type RefObject, type SetStateAction } from "react";
import { STAGE_OPTIONS_TOOLBAR } from "../../constants";
import type {
  ToolbarBooleanFilter,
  ToolbarStageFilter,
  ToolbarStatusFilter,
  ToolbarTimeRange,
} from "../../types";

type Props = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  cardSearch: string;
  setCardSearch: Dispatch<SetStateAction<string>>;
  cardTimeRange: ToolbarTimeRange;
  setCardTimeRange: Dispatch<SetStateAction<ToolbarTimeRange>>;
  cardReferralFilter: ToolbarBooleanFilter;
  setCardReferralFilter: Dispatch<SetStateAction<ToolbarBooleanFilter>>;
  cardOaFilter: ToolbarBooleanFilter;
  setCardOaFilter: Dispatch<SetStateAction<ToolbarBooleanFilter>>;
  cardStatusFilter: ToolbarStatusFilter;
  setCardStatusFilter: Dispatch<SetStateAction<ToolbarStatusFilter>>;
  cardStageFilter: ToolbarStageFilter;
  setCardStageFilter: Dispatch<SetStateAction<ToolbarStageFilter>>;
  activeSmartView: "default" | "interview" | "referral" | null;
  setActiveSmartView: Dispatch<SetStateAction<"default" | "interview" | "referral" | null>>;
  activeApplicationsCount: number;
};

export default function ActiveJobsToolbar({
  searchInputRef,
  cardSearch,
  setCardSearch,
  cardStageFilter,
  setCardStageFilter,
  setActiveSmartView,
  activeApplicationsCount,
}: Props) {

  return (
    <section className="application-card-toolbar active-jobs-main-toolbar">
      <div className="active-jobs-toolbar-row">
        <div className="active-jobs-toolbar-brand">
          <span className="active-jobs-toolbar-brand-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" role="presentation" focusable="false">
              <path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.7" />
              <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.2 12h5.6M9.2 16h5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <h2>
            Active Applications <span>({activeApplicationsCount})</span>
          </h2>
        </div>
        <div className="active-jobs-toolbar-controls">
          <div className="active-jobs-search-shell">
            <span className="active-jobs-search-icon" aria-hidden>
              <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="search"
              className="active-jobs-search-input"
              placeholder="Search applications, company, role, referral..."
              value={cardSearch}
              onChange={(e) => {
                setCardSearch(e.target.value);
                setActiveSmartView(null);
              }}
              aria-label="Search applications"
            />
            <div className="active-jobs-stage-select-wrap">
              <select
                className="active-jobs-stage-select"
                value={cardStageFilter}
                onChange={(e) => {
                  setCardStageFilter(e.target.value as ToolbarStageFilter);
                  setActiveSmartView(null);
                }}
                aria-label="Filter by stage"
              >
                {STAGE_OPTIONS_TOOLBAR.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="active-jobs-stage-select-caret" aria-hidden>
                <svg viewBox="0 0 16 16" fill="none" role="presentation" focusable="false">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
