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

type WeeklySelfRankSnapshot = {
  currentRank?: number | null;
  previousRank?: number | null;
  change?: number | null;
};

type Props = {
  weeklyHeaderTotal: number;
  weeklyBoardLeader: WeeklyBoardLeader | null;
  weeklyBoardLeadBy: number;
  weeklySelfRankSnapshot: WeeklySelfRankSnapshot;
  weeklyBoardTopThree: WeeklyBoardTopRow[];
  weeklySelfStreak: WeeklySelfStreak | null;
  rivalryKeepOnePlan: RivalryKeepOnePlan | null;
};

export default function NetworkWeeklyBoardCard({
  weeklyHeaderTotal,
  weeklyBoardLeader,
  weeklyBoardLeadBy,
  weeklySelfRankSnapshot,
  weeklyBoardTopThree,
  weeklySelfStreak,
  rivalryKeepOnePlan,
}: Props) {
  return (
    <div className="network-trend-card network-insight-card network-weekly-mini-board network-weekly-mini-board-stack">
      <div className="chart-header network-insight-card-head network-rivalry-header network-weekly-mini-board-header">
        <div className="chart-title-group network-rivalry-head">
          <h2 className="network-insight-title">🏆 Weekly Board</h2>
        </div>
        <strong className="network-weekly-board-total" aria-label="Your weekly application total">
          {weeklyHeaderTotal}
          <span className="network-weekly-board-total-unit">apps</span>
        </strong>
      </div>
      {weeklyBoardLeader ? (
        <div className="network-rivalry-status">
          <p className="network-rivalry-status-title">
            {weeklyBoardLeader.isSelf
              ? "You're leading this week"
              : `${weeklyBoardLeader.displayName} is leading this week`}
          </p>
          <p className="network-rivalry-status-copy">
            {weeklyBoardLeadBy > 0 ? `+${weeklyBoardLeadBy} applications ahead` : "Top spot is currently tied"}
          </p>
          {weeklySelfRankSnapshot.currentRank ? (
            <div className="network-rivalry-rank-snapshot" aria-label="Weekly rank snapshot">
              <span className="network-rivalry-rank-pill is-current">
                <span className="network-rivalry-rank-pill-label">This week</span>
                <strong className="network-rivalry-rank-pill-value">
                  #{weeklySelfRankSnapshot.currentRank}
                </strong>
              </span>
              <span className="network-rivalry-rank-pill is-previous">
                <span className="network-rivalry-rank-pill-label">Last week</span>
                <strong className="network-rivalry-rank-pill-value">
                  {weeklySelfRankSnapshot.previousRank
                    ? `#${weeklySelfRankSnapshot.previousRank}`
                    : "—"}
                </strong>
              </span>
              {typeof weeklySelfRankSnapshot.change === "number" ? (
                <span
                  className={`network-rivalry-rank-shift ${
                    weeklySelfRankSnapshot.change > 0
                      ? "is-up"
                      : weeklySelfRankSnapshot.change < 0
                        ? "is-down"
                        : "is-even"
                  }`}
                >
                  {weeklySelfRankSnapshot.change > 0
                    ? `↑${weeklySelfRankSnapshot.change}`
                    : weeklySelfRankSnapshot.change < 0
                      ? `↓${Math.abs(weeklySelfRankSnapshot.change)}`
                      : "→0"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {weeklyBoardTopThree.length ? (
        <>
          <div className="network-rivalry-top3-grid" aria-label="Top 3 competitors">
            {weeklyBoardTopThree.slice(0, 3).map((row, index) => (
              <div
                key={`top3-${row.key}`}
                className={`network-rivalry-top3-card place-${index + 1}`}
              >
                <div className="network-rivalry-rank-badge" aria-hidden="true">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </div>
                <p className="network-rivalry-top3-name">{row.displayName}</p>
                <strong className="network-rivalry-top3-score">{row.total}</strong>
              </div>
            ))}
          </div>
          {weeklyBoardTopThree.length > 3 ? (
            <div className="network-rivalry-top3-grid network-rivalry-top45-grid" aria-label="4th and 5th place">
              {weeklyBoardTopThree.slice(3).map((row, index) => (
                <div
                  key={`top45-${row.key}`}
                  className={`network-rivalry-top3-card place-${index + 4}`}
                >
                  <div className="network-rivalry-rank-badge" aria-hidden="true">
                    {index + 4}
                  </div>
                  <p className="network-rivalry-top3-name">{row.displayName}</p>
                  <strong className="network-rivalry-top3-score">{row.total}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {weeklySelfStreak ? (
        <div className="network-rivalry-streak">
          <p className="network-streak-title">
            <span aria-hidden="true">🔥</span>{" "}
            {weeklySelfStreak.count} day streak
          </p>
          <p className="network-streak-copy">
            {weeklySelfStreak.count > 0
              ? "Keep applying to grow your streak"
              : "Apply today to start your streak"}
          </p>
          <div className="network-streak-days" aria-label="Your weekly streak progress">
            {weeklySelfStreak.days.map((day) => (
              <div
                key={`streak-${day.label}`}
                className={`network-streak-day${day.isActive ? " is-active" : ""}${day.isFuture ? " is-future" : ""}`}
                title={`${day.label}`}
              >
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {rivalryKeepOnePlan ? (
        <div className="network-rivalry-keep-panel" aria-label="How to keep number one">
          <p className="network-rivalry-keep-kicker">
            {rivalryKeepOnePlan.isDefending ? "Weekly lock" : "Weekly comeback"}
          </p>
          <p className="network-rivalry-keep-title">{rivalryKeepOnePlan.title}</p>
          <div className="network-rivalry-keep-meter" aria-hidden="true">
            <span style={{ width: `${rivalryKeepOnePlan.progressPercent}%` }} />
          </div>
          <div className="network-rivalry-keep-meta">
            <span>
              Week {rivalryKeepOnePlan.weekTotal}/{rivalryKeepOnePlan.progressGoal}
            </span>
            <span>{rivalryKeepOnePlan.detail}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
