import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  OA_FILTER_SEQUENCE,
  REFERRAL_FILTER_SEQUENCE,
  STAGE_FILTER_SEQUENCE,
  STAGE_OPTIONS_TOOLBAR,
  STATUS_FILTER_SEQUENCE,
  TIME_CHIP_LABEL,
  TIME_FILTER_SEQUENCE,
} from "../../constants";
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
  applyDefaultCardFilters: () => void;
  applyInterviewScenario: () => void;
  applyReferralScenario: () => void;
  clearCardFilters: () => void;
  activeApplicationsCount: number;
};

function cycleInSequence<T extends string>(current: T, sequence: readonly T[]): T {
  const idx = sequence.indexOf(current);
  if (idx < 0) return sequence[0];
  return sequence[(idx + 1) % sequence.length];
}

export default function ActiveJobsToolbar({
  searchInputRef,
  cardSearch,
  setCardSearch,
  cardTimeRange,
  setCardTimeRange,
  cardReferralFilter,
  setCardReferralFilter,
  cardOaFilter,
  setCardOaFilter,
  cardStatusFilter,
  setCardStatusFilter,
  cardStageFilter,
  setCardStageFilter,
  activeSmartView,
  setActiveSmartView,
  applyDefaultCardFilters,
  applyInterviewScenario,
  applyReferralScenario,
  clearCardFilters,
  activeApplicationsCount,
}: Props) {
  const stageLabel = STAGE_OPTIONS_TOOLBAR.find((opt) => opt.value === cardStageFilter)?.label ?? "All";
  const quickPillLabel = cardTimeRange === "all" ? "38 K" : TIME_CHIP_LABEL[cardTimeRange].toUpperCase();

  function handleFiltersClick() {
    if (activeSmartView === "default") {
      applyInterviewScenario();
      return;
    }
    if (activeSmartView === "interview") {
      applyReferralScenario();
      return;
    }
    if (activeSmartView === "referral") {
      clearCardFilters();
      return;
    }
    setCardStatusFilter((curr) => cycleInSequence(curr, STATUS_FILTER_SEQUENCE));
    setActiveSmartView(null);
  }

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
          <label className="active-jobs-search-shell">
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
            <button
              type="button"
              className={`active-jobs-inline-chip ${cardStageFilter !== "All" ? "is-active" : ""}`}
              onClick={() => {
                setCardStageFilter((curr) => cycleInSequence(curr, STAGE_FILTER_SEQUENCE));
                setActiveSmartView(null);
              }}
            >
              {stageLabel}
            </button>
            <button
              type="button"
              className={`active-jobs-inline-chip ${cardTimeRange !== "all" || cardReferralFilter !== "all" ? "is-active" : ""}`}
              onClick={() => {
                setCardTimeRange((curr) => cycleInSequence(curr, TIME_FILTER_SEQUENCE));
                setCardReferralFilter((curr) => cycleInSequence(curr, REFERRAL_FILTER_SEQUENCE));
                setCardOaFilter((curr) => cycleInSequence(curr, OA_FILTER_SEQUENCE));
                applyDefaultCardFilters();
              }}
            >
              {quickPillLabel}
            </button>
          </label>
          <button
            type="button"
            className={`active-jobs-filters-btn ${cardStatusFilter !== "all" ? "is-active" : ""}`}
            onClick={handleFiltersClick}
          >
            Filters
            <svg viewBox="0 0 16 16" fill="none" role="presentation" focusable="false" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
