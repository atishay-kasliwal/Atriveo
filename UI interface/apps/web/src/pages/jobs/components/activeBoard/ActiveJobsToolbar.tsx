import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  BOOLEAN_CHIP_LABEL,
  OA_FILTER_SEQUENCE,
  REFERRAL_FILTER_SEQUENCE,
  STAGE_FILTER_SEQUENCE,
  STAGE_OPTIONS_TOOLBAR,
  STATUS_CHIP_LABEL,
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
}: Props) {
  return (
    <section className="application-card-toolbar active-jobs-main-toolbar">
      <div className="application-card-toolbar-search-row">
        <label className="application-card-search-shell application-card-search-shell--main">
          <span className="application-card-search-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="search"
            className="application-card-search-input"
            placeholder="Search applications, company, role, referral, job ID..."
            value={cardSearch}
            onChange={(e) => {
              setCardSearch(e.target.value);
              setActiveSmartView(null);
            }}
            aria-label="Global search"
          />
          <kbd className="application-card-search-hint">⌘ K</kbd>
        </label>
      </div>

      <div className="application-card-toolbar-section-head">
        <p>Filter by</p>
        <span aria-hidden />
      </div>

      <div className="application-card-toolbar-filters-row" role="toolbar" aria-label="Quick filters">
        <button
          type="button"
          className={`filter-chip ${cardTimeRange !== "all" ? "is-active" : ""}`}
          onClick={() => {
            setCardTimeRange((curr) => cycleInSequence(curr, TIME_FILTER_SEQUENCE));
            setActiveSmartView(null);
          }}
        >
          <span className="filter-chip-value">Time: {TIME_CHIP_LABEL[cardTimeRange]}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${cardReferralFilter !== "all" ? "is-active" : ""}`}
          onClick={() => {
            setCardReferralFilter((curr) => cycleInSequence(curr, REFERRAL_FILTER_SEQUENCE));
            setActiveSmartView(null);
          }}
        >
          <span className="filter-chip-value">Referral: {BOOLEAN_CHIP_LABEL[cardReferralFilter]}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${cardOaFilter !== "all" ? "is-active" : ""}`}
          onClick={() => {
            setCardOaFilter((curr) => cycleInSequence(curr, OA_FILTER_SEQUENCE));
            setActiveSmartView(null);
          }}
        >
          <span className="filter-chip-value">OA: {BOOLEAN_CHIP_LABEL[cardOaFilter]}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${cardStatusFilter !== "all" ? "is-active" : ""}`}
          onClick={() => {
            setCardStatusFilter((curr) => cycleInSequence(curr, STATUS_FILTER_SEQUENCE));
            setActiveSmartView(null);
          }}
        >
          <span className="filter-chip-value">Status: {STATUS_CHIP_LABEL[cardStatusFilter]}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${cardStageFilter !== "All" ? "is-active" : ""}`}
          onClick={() => {
            setCardStageFilter((curr) => cycleInSequence(curr, STAGE_FILTER_SEQUENCE));
            setActiveSmartView(null);
          }}
        >
          <span className="filter-chip-value">
            Stage: {STAGE_OPTIONS_TOOLBAR.find((opt) => opt.value === cardStageFilter)?.label ?? "All"}
          </span>
        </button>
      </div>

      <div className="application-card-toolbar-secondary">
        <div className="application-card-toolbar-presets">
          <div className="application-card-toolbar-section-head application-card-toolbar-section-head--compact">
            <p>Smart Views</p>
            <span aria-hidden />
          </div>
          <div className="application-card-toolbar-preset-list">
            <button
              type="button"
              onClick={applyDefaultCardFilters}
              className={activeSmartView === "default" ? "is-selected" : ""}
            >
              Default Smart
            </button>
            <button
              type="button"
              onClick={applyInterviewScenario}
              className={activeSmartView === "interview" ? "is-selected" : ""}
            >
              Interview Focus
            </button>
            <button
              type="button"
              onClick={applyReferralScenario}
              className={activeSmartView === "referral" ? "is-selected" : ""}
            >
              Referral Tracker
            </button>
            <button type="button" onClick={clearCardFilters}>
              Clear All
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
