import type { Dispatch, SetStateAction } from "react";
import WeeklyCompetitionChart from "../../../components/network/WeeklyCompetitionChart";

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

type Props = {
  compareFriendOptions: CompareFriendOption[];
  selectedWeeklyCompareKey: string;
  setSelectedWeeklyCompareKey: Dispatch<SetStateAction<string>>;
  compareSelectWidthCh: number;
  weeklyCompetition: WeeklyCompetition | null;
};

export default function NetworkRivalryModeCard({
  compareFriendOptions,
  selectedWeeklyCompareKey,
  setSelectedWeeklyCompareKey,
  compareSelectWidthCh,
  weeklyCompetition,
}: Props) {
  return (
    <div className="network-trend-card network-insight-card">
      <div className="chart-header network-insight-card-head network-rivalry-header network-rivalry-feature-header">
        <div className="chart-title-group network-rivalry-head">
          <h2 className="network-insight-title">🔥 Rivalry Mode</h2>
        </div>
        <div className="chart-filter network-compare-filter">
          <span className="chart-filter-label">Pick rival</span>
          <select
            className="chart-filter-select network-compare-select"
            aria-label="Select friend to compare weekly trend"
            value={selectedWeeklyCompareKey}
            onChange={(event) => setSelectedWeeklyCompareKey(event.target.value)}
            disabled={!compareFriendOptions.length}
            style={{ width: `${compareSelectWidthCh}ch`, maxWidth: "100%" }}
          >
            {compareFriendOptions.length ? (
              compareFriendOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} · {option.total}
                </option>
              ))
            ) : (
              <option value="">No friends available</option>
            )}
          </select>
        </div>
      </div>
      <p className="network-rivalry-subtitle network-rivalry-subtitle--below">
        Compete with friends to track job application momentum.
      </p>
      <div className="network-weekly-line-layout">
        <div className="network-weekly-line-stage network-chart-stage">
          {weeklyCompetition ? (
            <WeeklyCompetitionChart
              labels={weeklyCompetition.labels}
              userValues={weeklyCompetition.userValues}
              friendValues={weeklyCompetition.friendValues}
              friendName={weeklyCompetition.friendName}
              todayLabel={weeklyCompetition.todayLabel}
              goalTarget={weeklyCompetition.goalTarget}
            />
          ) : (
            <div className="chart-empty" style={{ minHeight: 180 }}>
              Not enough data for weekly competition.
            </div>
          )}
        </div>
      </div>
      {weeklyCompetition ? (
        <div className="trend-uniform-foot network-rivalry-footer">
          <span
            className={`trend-uniform-foot-item ${weeklyCompetition.weekLead > 0 ? "trend-uniform-foot-item--applied" : weeklyCompetition.weekLead < 0 ? "trend-uniform-foot-item--rejected" : "trend-uniform-foot-item--muted"}`}
          >
            {weeklyCompetition.weekLead > 0
              ? `You +${weeklyCompetition.weekLead} this week`
              : weeklyCompetition.weekLead < 0
                ? `${weeklyCompetition.friendName} +${Math.abs(weeklyCompetition.weekLead)} this week`
                : "Week tie"}
          </span>
          <span
            className={`trend-uniform-foot-item ${weeklyCompetition.todayLead > 0 ? "trend-uniform-foot-item--applied" : weeklyCompetition.todayLead < 0 ? "trend-uniform-foot-item--rejected" : "trend-uniform-foot-item--muted"}`}
          >
            {weeklyCompetition.todayLead > 0
              ? `Today +${weeklyCompetition.todayLead}`
              : weeklyCompetition.todayLead < 0
                ? `Today -${Math.abs(weeklyCompetition.todayLead)}`
                : "Today even"}
          </span>
          <span className="trend-uniform-foot-item trend-uniform-foot-item--muted">
            Rival rank #{weeklyCompetition.friendRank}
          </span>
        </div>
      ) : null}
    </div>
  );
}
