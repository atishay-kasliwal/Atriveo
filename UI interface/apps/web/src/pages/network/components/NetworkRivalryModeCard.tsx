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
      {weeklyCompetition ? (
        <p className="network-rivalry-subtitle network-rivalry-subtitle--below">
          {weeklyCompetition.weekLead > 0 ? (
            <>You're ahead of {weeklyCompetition.friendName} by <strong className="network-rivalry-subtitle-accent is-winning">+{weeklyCompetition.weekLead}</strong> this week — keep it up.</>
          ) : weeklyCompetition.weekLead < 0 ? (
            <>{weeklyCompetition.friendName} is ahead by <strong className="network-rivalry-subtitle-accent is-losing">+{Math.abs(weeklyCompetition.weekLead)}</strong> — time to catch up.</>
          ) : (
            <>You and {weeklyCompetition.friendName} are <strong className="network-rivalry-subtitle-accent is-tied">tied</strong> this week. Make your move.</>
          )}
        </p>
      ) : (
        <p className="network-rivalry-subtitle network-rivalry-subtitle--below">
          Pick a rival to start competing on weekly application momentum.
        </p>
      )}
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
        <div className="network-rivalry-stat-row">
          <div className={`network-rivalry-stat-chip ${weeklyCompetition.weekLead > 0 ? "is-winning" : weeklyCompetition.weekLead < 0 ? "is-losing" : "is-tied"}`}>
            <span className="network-rivalry-stat-label">Week</span>
            <span className="network-rivalry-stat-value">
              {weeklyCompetition.weekLead > 0
                ? `+${weeklyCompetition.weekLead} you`
                : weeklyCompetition.weekLead < 0
                  ? `+${Math.abs(weeklyCompetition.weekLead)} them`
                  : "Tied"}
            </span>
          </div>
          <div className={`network-rivalry-stat-chip ${weeklyCompetition.todayLead > 0 ? "is-winning" : weeklyCompetition.todayLead < 0 ? "is-losing" : "is-tied"}`}>
            <span className="network-rivalry-stat-label">Today</span>
            <span className="network-rivalry-stat-value">
              {weeklyCompetition.todayLead > 0
                ? `+${weeklyCompetition.todayLead}`
                : weeklyCompetition.todayLead < 0
                  ? `-${Math.abs(weeklyCompetition.todayLead)}`
                  : "Even"}
            </span>
          </div>
          <div className="network-rivalry-stat-chip is-neutral">
            <span className="network-rivalry-stat-label">Rival rank</span>
            <span className="network-rivalry-stat-value">#{weeklyCompetition.friendRank}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
