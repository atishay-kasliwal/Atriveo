import type { Dispatch, SetStateAction } from "react";
import { ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS, ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS } from "../../constants";
import { getReferralInitials } from "../../utils/formatters";

type ReferralRow = { name: string; company: string; role: string };

type Props = {
  referralSearch: string;
  setReferralSearch: Dispatch<SetStateAction<string>>;
  filteredReferralRows: ReferralRow[];
};

export default function ActiveJobsReferralPanel({
  referralSearch,
  setReferralSearch,
  filteredReferralRows,
}: Props) {
  const previewRows = filteredReferralRows.slice(0, 10);
  const totalReferralCount = filteredReferralRows.length;
  const thisWeekTotal = ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS.reduce((sum, entry) => sum + entry.count, 0);
  const previousWeek = ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS[ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.length - 2] ?? {
    week: "Week 4",
    count: 0,
  };
  const bestDay = ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS.reduce((peak, entry) =>
    entry.count > peak.count ? entry : peak,
  );
  const dailyCounts = ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS.map((entry) => entry.count);
  const chartMax = Math.max(...dailyCounts, 1);
  const targetCount = 12;
  const weekDelta = thisWeekTotal - previousWeek.count;
  const weekDeltaSign = weekDelta >= 0 ? "+" : "-";
  const weekDeltaPercent =
    previousWeek.count > 0 ? Math.round((Math.abs(weekDelta) / previousWeek.count) * 100) : 0;
  const targetProgressPercent = Math.round((thisWeekTotal / targetCount) * 100);
  const yAxisTop = Math.max(4, Math.ceil(chartMax / 2) * 2);
  const yAxisTicks = [yAxisTop, Math.round(yAxisTop * 0.75), Math.round(yAxisTop * 0.5), Math.round(yAxisTop * 0.25), 0];
  const highlightedDay = bestDay.day;

  return (
    <>
      <section className="active-jobs-side-panel active-jobs-referral-panel">
        <div className="active-jobs-referrals-head">
          <h3>
            Referrals <span className="active-jobs-referral-heading-count">({totalReferralCount})</span>
          </h3>
          <div className="active-jobs-referrals-actions">
            <button type="button" className="active-jobs-referral-add-btn">
              Add referral
            </button>
            <span className="active-jobs-referral-total" aria-label={`${totalReferralCount} referrals`}>
              {totalReferralCount}
            </span>
          </div>
        </div>
        <label className="active-jobs-referral-search">
          <span className="active-jobs-referral-search-icon" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none" role="presentation" focusable="false">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={referralSearch}
            onChange={(e) => setReferralSearch(e.target.value)}
            placeholder="Search name, company, role..."
            aria-label="Search referrals"
          />
        </label>
        <div className="active-jobs-referral-table-wrap">
          <table className="active-jobs-referral-table">
            <thead>
              <tr>
                <th>Count</th>
                <th>Name</th>
                <th>Company</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.name}-${row.company}`}>
                  <td className="active-jobs-referral-count-cell">{index + 1}</td>
                  <td>
                    <div className="active-jobs-referral-person">
                      <span className="active-jobs-referral-avatar" aria-hidden>
                        <span className="active-jobs-referral-avatar-text">{getReferralInitials(row.name)}</span>
                      </span>
                      <div className="active-jobs-referral-name">
                        <strong>{row.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{row.company}</td>
                  <td>{row.role}</td>
                </tr>
              ))}
              {previewRows.length === 0 ? (
                <tr>
                  <td className="active-jobs-referral-empty" colSpan={4}>
                    No matching friend or company.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="active-jobs-side-panel active-jobs-referral-insight-panel" aria-label="Current week insight">
        <div className="active-jobs-referral-insight-head">
          <span>Current week (7 days)</span>
          <strong>{thisWeekTotal}</strong>
        </div>
        <div className="active-jobs-referral-insight-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, targetProgressPercent)}%` }} />
        </div>
        <div className="active-jobs-referral-insight-chart" aria-label="Current week daily bar chart">
          <div className="active-jobs-referral-insight-y-axis" aria-hidden>
            {yAxisTicks.map((tick, index) => (
              <span key={`y-axis-${index}`}>{tick}</span>
            ))}
          </div>
          <div className="active-jobs-referral-insight-plot">
            <div className="active-jobs-referral-insight-bars">
              {ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS.map((entry) => {
                const isHighlighted = entry.day === highlightedDay;
                const normalizedHeight = Math.round((entry.count / yAxisTop) * 100);
                const barHeight = entry.count === 0 ? 7 : Math.max(18, normalizedHeight);
                return (
                <div key={`day-bar-${entry.day}`} className="active-jobs-referral-insight-bar-item">
                  <span className="active-jobs-referral-insight-bar-wrap">
                    {isHighlighted ? <span className="active-jobs-referral-insight-bar-badge">{`${entry.count} apps`}</span> : null}
                    <span
                      className={`active-jobs-referral-insight-bar${isHighlighted ? " is-highlighted" : ""}`}
                      style={{ height: `${barHeight}%` }}
                      aria-hidden
                    />
                  </span>
                  <em>{entry.day}</em>
                </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="active-jobs-referral-insight-list">
          <div>
            <span>vs last week</span>
            <strong className={weekDelta >= 0 ? "is-positive" : "is-negative"}>
              {`${weekDeltaSign}${Math.abs(weekDelta)} (${weekDeltaSign}${weekDeltaPercent}%)`}
            </strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{`${targetCount} / ${targetProgressPercent}%`}</strong>
          </div>
          <div>
            <span>Best day</span>
            <strong>{bestDay.day}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
