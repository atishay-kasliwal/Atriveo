import type { Dispatch, SetStateAction } from "react";
import Spinner from "../../../components/Spinner";
import NetworkRivalryModeCard from "./NetworkRivalryModeCard";
import NetworkWeeklyBoardCard from "./NetworkWeeklyBoardCard";

type CompareFriendOption = {
  key: string;
  label: string;
  total: number;
};

type WeeklyCompetition = {
  labels: string[];
  userValues: number[];
  friendValues: number[];
  friendName: string;
  todayLabel: string;
  goalTarget: number;
  weekLead: number;
  todayLead: number;
  friendRank: number;
};

type WeeklyBoardLeader = {
  isSelf: boolean;
  displayName: string;
};

type WeeklyBoardTopRow = {
  key: string;
  displayName: string;
  total: number;
};

type WeeklySelfStreak = {
  count: number;
  days: Array<{ label: string; isActive: boolean; isFuture: boolean }>;
};

type RivalryKeepOnePlan = {
  isDefending: boolean;
  title: string;
  detail: string;
  weekTotal: number;
  progressGoal: number;
  progressPercent: number;
};

type InsightCharts = {
  selected: unknown[];
  todayRows: Array<{
    key: string;
    label: string;
    color: string;
    isLeader: boolean;
    total: number;
  }>;
  todayStats: {
    average: number;
    hiddenCount: number;
  };
  todayLeader: {
    hasSingleLeader: boolean;
  };
  weeklySelfRankSnapshot: {
    currentRank?: number | null;
    previousRank?: number | null;
    change?: number | null;
  };
};

type Props = {
  insightsOpen: boolean;
  setInsightsOpen: Dispatch<SetStateAction<boolean>>;
  isLoading: boolean;
  insightCharts: InsightCharts;
  compareFriendOptions: CompareFriendOption[];
  selectedWeeklyCompareKey: string;
  setSelectedWeeklyCompareKey: Dispatch<SetStateAction<string>>;
  compareSelectWidthCh: number;
  weeklyCompetition: WeeklyCompetition | null;
  weeklyHeaderTotal: number;
  weeklyBoardLeader: WeeklyBoardLeader | null;
  weeklyBoardLeadBy: number;
  weeklyBoardTopThree: WeeklyBoardTopRow[];
  weeklySelfStreak: WeeklySelfStreak | null;
  rivalryKeepOnePlan: RivalryKeepOnePlan | null;
};

export default function NetworkInsightsSection({
  insightsOpen,
  setInsightsOpen,
  isLoading,
  insightCharts,
  compareFriendOptions,
  selectedWeeklyCompareKey,
  setSelectedWeeklyCompareKey,
  compareSelectWidthCh,
  weeklyCompetition,
  weeklyHeaderTotal,
  weeklyBoardLeader,
  weeklyBoardLeadBy,
  weeklyBoardTopThree,
  weeklySelfStreak,
  rivalryKeepOnePlan,
}: Props) {
  return (
    <section>
      <div className={`card network-shell-card ${insightsOpen ? "is-open" : "is-closed"}`}>
        <button type="button" className="network-main-head" onClick={() => setInsightsOpen((p) => !p)}>
          <h2>Network Insights</h2>
          <div className="network-main-right">
            <span className="pending-meta">{insightsOpen ? "Collapse" : "Expand"} · Today + Weekly</span>
            <span className={`network-section-arrow ${insightsOpen ? "open" : ""}`}>▴</span>
          </div>
        </button>

        {!insightsOpen ? null : isLoading ? (
          <Spinner />
        ) : (
          <div className="network-card-content">
            {insightCharts.selected.length === 0 ? (
              <div className="empty-state network-empty-insights">
                <div className="network-empty-state-icon" aria-hidden="true">👥</div>
                <p className="network-empty-state-title">No friends in your network yet</p>
                <p className="network-empty-state-copy">Add friends to unlock leaderboards, rivalry mode, and weekly insights.</p>
              </div>
            ) : (
              <div className="network-combined-card">
                <div className="network-trend-grid network-insights-grid">
                  <NetworkRivalryModeCard
                    compareFriendOptions={compareFriendOptions}
                    selectedWeeklyCompareKey={selectedWeeklyCompareKey}
                    setSelectedWeeklyCompareKey={setSelectedWeeklyCompareKey}
                    compareSelectWidthCh={compareSelectWidthCh}
                    weeklyCompetition={weeklyCompetition}
                  />
                  <NetworkWeeklyBoardCard
                    weeklyHeaderTotal={weeklyHeaderTotal}
                    weeklyBoardLeader={weeklyBoardLeader}
                    weeklyBoardLeadBy={weeklyBoardLeadBy}
                    weeklySelfRankSnapshot={insightCharts.weeklySelfRankSnapshot}
                    weeklyBoardTopThree={weeklyBoardTopThree}
                    weeklySelfStreak={weeklySelfStreak}
                    rivalryKeepOnePlan={rivalryKeepOnePlan}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
