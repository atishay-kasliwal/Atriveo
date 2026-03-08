import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type {
  ToolbarBooleanFilter,
  ToolbarStageFilter,
  ToolbarStatusFilter,
  ToolbarTimeRange,
} from "../types";
import ActiveJobsCardsColumn from "./activeBoard/ActiveJobsCardsColumn";
import ActiveJobsKpiPanel from "./activeBoard/ActiveJobsKpiPanel";
import ActiveJobsReferralPanel from "./activeBoard/ActiveJobsReferralPanel";
import ActiveJobsToolbar from "./activeBoard/ActiveJobsToolbar";

type ReferralRow = { name: string; company: string; role: string };
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
  error: string;
  confirmDialog: ReactNode;
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
  setCardPage: Dispatch<SetStateAction<number>>;
  referralSearch: string;
  setReferralSearch: Dispatch<SetStateAction<string>>;
  activeSmartView: "default" | "interview" | "referral" | null;
  setActiveSmartView: Dispatch<SetStateAction<"default" | "interview" | "referral" | null>>;
  applyDefaultCardFilters: () => void;
  applyInterviewScenario: () => void;
  applyReferralScenario: () => void;
  clearCardFilters: () => void;
  filteredReferralRows: ReferralRow[];
  filteredSampleCardsLength: number;
  pagedSampleCards: SampleCard[];
  cardStartIndex: number;
  hasCardPrev: boolean;
  hasCardNext: boolean;
  cardPaginationItems: Array<number | "ellipsis">;
  safeCardPage: number;
  totalCardPages: number;
};

export default function ActiveJobsBoard(props: Props) {
  return (
    <>
      {props.error ? <div className="error">{props.error}</div> : null}
      <section className="application-card-board active-jobs-demo-board">
        <ActiveJobsToolbar
          searchInputRef={props.searchInputRef}
          cardSearch={props.cardSearch}
          setCardSearch={props.setCardSearch}
          cardTimeRange={props.cardTimeRange}
          setCardTimeRange={props.setCardTimeRange}
          cardReferralFilter={props.cardReferralFilter}
          setCardReferralFilter={props.setCardReferralFilter}
          cardOaFilter={props.cardOaFilter}
          setCardOaFilter={props.setCardOaFilter}
          cardStatusFilter={props.cardStatusFilter}
          setCardStatusFilter={props.setCardStatusFilter}
          cardStageFilter={props.cardStageFilter}
          setCardStageFilter={props.setCardStageFilter}
          activeSmartView={props.activeSmartView}
          setActiveSmartView={props.setActiveSmartView}
          applyDefaultCardFilters={props.applyDefaultCardFilters}
          applyInterviewScenario={props.applyInterviewScenario}
          applyReferralScenario={props.applyReferralScenario}
          clearCardFilters={props.clearCardFilters}
          activeApplicationsCount={props.filteredSampleCardsLength}
        />
        <div className="active-jobs-layout">
          <ActiveJobsCardsColumn
            filteredSampleCardsLength={props.filteredSampleCardsLength}
            pagedSampleCards={props.pagedSampleCards}
            cardStartIndex={props.cardStartIndex}
            hasCardPrev={props.hasCardPrev}
            hasCardNext={props.hasCardNext}
            cardPaginationItems={props.cardPaginationItems}
            safeCardPage={props.safeCardPage}
            totalCardPages={props.totalCardPages}
            setCardPage={props.setCardPage}
          />
          <aside className="active-jobs-context-column">
            <ActiveJobsKpiPanel />
            <ActiveJobsReferralPanel
              referralSearch={props.referralSearch}
              setReferralSearch={props.setReferralSearch}
              filteredReferralRows={props.filteredReferralRows}
            />
          </aside>
        </div>
      </section>
      {props.confirmDialog}
    </>
  );
}
