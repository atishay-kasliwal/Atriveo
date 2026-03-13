import { useEffect, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import useIsMobileViewport from "../../../hooks/useIsMobileViewport";
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

type ReferralRow = { id: number | string; name: string; company: string; role: string };
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
type WeeklyPoint = { week: string; count: number };
type DailyCount = { day: string; count: number };

type Props = {
  cardsError: string;
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
  isLoadingCards: boolean;
  filteredReferralRows: ReferralRow[];
  isLoadingReferrals: boolean;
  referralError: string;
  totalReferralCount: number;
  onAddReferral: () => void;
  filteredSampleCardsLength: number;
  pagedSampleCards: ActiveCard[];
  cardStartIndex: number;
  hasCardPrev: boolean;
  hasCardNext: boolean;
  cardPaginationItems: Array<number | "ellipsis">;
  safeCardPage: number;
  totalCardPages: number;
  archivingId: number | string | null;
  openCardLink: (card: ActiveCard) => void;
  openCardEdit: (card: ActiveCard) => void;
  onArchiveCard: (card: ActiveCard) => void;
  weeklyCounts: WeeklyPoint[];
  totalApplications: number;
  averagePerWeek: string;
  peakWeekLabel: string;
  isLoadingKpi: boolean;
  kpiError: string;
  currentWeekDailyCounts: DailyCount[];
  thisWeekTotal: number;
  previousWeekTotal: number;
  bestDay: string;
  targetCount: number;
  targetProgressPercent: number;
  isLoadingSummary: boolean;
  summaryError: string;
};

export default function ActiveJobsBoard(props: Props) {
  const isMobile = useIsMobileViewport(640);
  const [mobileSection, setMobileSection] = useState<"applications" | "insights" | "referrals">("applications");

  useEffect(() => {
    if (!isMobile) setMobileSection("applications");
  }, [isMobile]);

  return (
    <>
      {props.cardsError ? <div className="error">{props.cardsError}</div> : null}
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
          activeApplicationsCount={props.filteredSampleCardsLength}
        />
        {isMobile ? (
          <>
            <div className="active-jobs-mobile-view-switch" role="tablist" aria-label="Jobs mobile sections">
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === "applications"}
                className={`active-jobs-mobile-view-btn${mobileSection === "applications" ? " is-active" : ""}`}
                onClick={() => setMobileSection("applications")}
              >
                Applications
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === "insights"}
                className={`active-jobs-mobile-view-btn${mobileSection === "insights" ? " is-active" : ""}`}
                onClick={() => setMobileSection("insights")}
              >
                Insights
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileSection === "referrals"}
                className={`active-jobs-mobile-view-btn${mobileSection === "referrals" ? " is-active" : ""}`}
                onClick={() => setMobileSection("referrals")}
              >
                Referrals
              </button>
            </div>
            <div className="active-jobs-layout is-mobile-tabbed">
              {mobileSection === "applications" ? (
                <ActiveJobsCardsColumn
                  isLoading={props.isLoadingCards}
                  cardsError={props.cardsError}
                  filteredSampleCardsLength={props.filteredSampleCardsLength}
                  pagedSampleCards={props.pagedSampleCards}
                  cardStartIndex={props.cardStartIndex}
                  hasCardPrev={props.hasCardPrev}
                  hasCardNext={props.hasCardNext}
                  cardPaginationItems={props.cardPaginationItems}
                  safeCardPage={props.safeCardPage}
                  totalCardPages={props.totalCardPages}
                  setCardPage={props.setCardPage}
                  archivingId={props.archivingId}
                  openCardLink={props.openCardLink}
                  openCardEdit={props.openCardEdit}
                  onArchiveCard={props.onArchiveCard}
                />
              ) : null}
              {mobileSection === "insights" ? (
                <aside className="active-jobs-context-column active-jobs-context-column--mobile-single">
                  <ActiveJobsKpiPanel
                    weeklyCounts={props.weeklyCounts}
                    totalApplications={props.totalApplications}
                    averagePerWeek={props.averagePerWeek}
                    peakWeekLabel={props.peakWeekLabel}
                    isLoading={props.isLoadingKpi}
                    error={props.kpiError}
                  />
                </aside>
              ) : null}
              {mobileSection === "referrals" ? (
                <aside className="active-jobs-context-column active-jobs-context-column--mobile-single">
                  <ActiveJobsReferralPanel
                    referralSearch={props.referralSearch}
                    setReferralSearch={props.setReferralSearch}
                    filteredReferralRows={props.filteredReferralRows}
                    isLoadingReferrals={props.isLoadingReferrals}
                    referralError={props.referralError}
                    totalReferralCount={props.totalReferralCount}
                    onAddReferral={props.onAddReferral}
                    currentWeekDailyCounts={props.currentWeekDailyCounts}
                    thisWeekTotal={props.thisWeekTotal}
                    previousWeekTotal={props.previousWeekTotal}
                    bestDay={props.bestDay}
                    targetCount={props.targetCount}
                    targetProgressPercent={props.targetProgressPercent}
                    isLoadingSummary={props.isLoadingSummary}
                    summaryError={props.summaryError}
                  />
                </aside>
              ) : null}
            </div>
          </>
        ) : (
          <div className="active-jobs-layout">
            <ActiveJobsCardsColumn
              isLoading={props.isLoadingCards}
              cardsError={props.cardsError}
              filteredSampleCardsLength={props.filteredSampleCardsLength}
              pagedSampleCards={props.pagedSampleCards}
              cardStartIndex={props.cardStartIndex}
              hasCardPrev={props.hasCardPrev}
              hasCardNext={props.hasCardNext}
              cardPaginationItems={props.cardPaginationItems}
              safeCardPage={props.safeCardPage}
              totalCardPages={props.totalCardPages}
              setCardPage={props.setCardPage}
              archivingId={props.archivingId}
              openCardLink={props.openCardLink}
              openCardEdit={props.openCardEdit}
              onArchiveCard={props.onArchiveCard}
            />
            <aside className="active-jobs-context-column">
              <ActiveJobsKpiPanel
                weeklyCounts={props.weeklyCounts}
                totalApplications={props.totalApplications}
                averagePerWeek={props.averagePerWeek}
                peakWeekLabel={props.peakWeekLabel}
                isLoading={props.isLoadingKpi}
                error={props.kpiError}
              />
              <ActiveJobsReferralPanel
                referralSearch={props.referralSearch}
                setReferralSearch={props.setReferralSearch}
                filteredReferralRows={props.filteredReferralRows}
                isLoadingReferrals={props.isLoadingReferrals}
                referralError={props.referralError}
                totalReferralCount={props.totalReferralCount}
                onAddReferral={props.onAddReferral}
                currentWeekDailyCounts={props.currentWeekDailyCounts}
                thisWeekTotal={props.thisWeekTotal}
                previousWeekTotal={props.previousWeekTotal}
                bestDay={props.bestDay}
                targetCount={props.targetCount}
                targetProgressPercent={props.targetProgressPercent}
                isLoadingSummary={props.isLoadingSummary}
                summaryError={props.summaryError}
              />
            </aside>
          </div>
        )}
      </section>
      {props.confirmDialog}
    </>
  );
}
