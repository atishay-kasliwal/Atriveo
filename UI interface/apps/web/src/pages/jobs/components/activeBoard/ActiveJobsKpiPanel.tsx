import { ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS } from "../../constants";

export default function ActiveJobsKpiPanel() {
  const maxCount = Math.max(...ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.map((entry) => entry.count), 4);
  const axisTop = Math.ceil(maxCount / 2) * 2;
  const axisStep = Math.max(1, Math.ceil(axisTop / 3));
  const axisTicks = [axisTop, Math.max(0, axisTop - axisStep), Math.max(0, axisTop - axisStep * 2), 0];
  const totalApplications = ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.reduce((sum, entry) => sum + entry.count, 0);
  const averagePerWeek = (totalApplications / ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.length).toFixed(1);
  const peakWeek = ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.reduce((peak, entry) =>
    entry.count > peak.count ? entry : peak,
  );

  return (
    <section className="active-jobs-side-panel active-jobs-kpi-panel">
      <div className="active-jobs-side-heading">
        <h3>Weekly Application Count</h3>
        <button type="button" className="active-jobs-date-pill">
          Last 5 weeks
          <svg viewBox="0 0 16 16" fill="none" role="presentation" focusable="false" aria-hidden>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="active-jobs-insights-chart" aria-label="Weekly application counts">
        <div className="active-jobs-insights-axis" aria-hidden>
          {axisTicks.map((tick, idx) => (
            <span key={`axis-${idx}`}>{tick}</span>
          ))}
        </div>
        <div className="active-jobs-insights-bars">
          {ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS.map((entry) => {
            const normalized = entry.count / axisTop;
            const amplifiedRatio = Math.pow(normalized, 0.82);
            return (
              <div key={entry.week} className="active-jobs-insights-bar-item">
                <span
                  className="active-jobs-insights-bar"
                  style={{ height: `${Math.max(20, Math.round(amplifiedRatio * 100))}%` }}
                  aria-hidden
                />
                <em>{entry.week}</em>
              </div>
            );
          })}
        </div>
      </div>
      <div className="active-jobs-insights-footer" aria-label="Weekly application summary">
        <div>
          <span>Total</span>
          <strong>{totalApplications}</strong>
        </div>
        <div>
          <span>Avg / week</span>
          <strong>{averagePerWeek}</strong>
        </div>
        <div>
          <span>Peak</span>
          <strong>{`${peakWeek.week} (${peakWeek.count})`}</strong>
        </div>
      </div>
    </section>
  );
}
