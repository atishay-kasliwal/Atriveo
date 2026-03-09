type WeeklyPoint = {
  week: string;
  count: number;
};

type Props = {
  weeklyCounts: WeeklyPoint[];
  totalApplications: number;
  averagePerWeek: string;
  peakWeekLabel: string;
  isLoading: boolean;
  error: string;
};

export default function ActiveJobsKpiPanel({
  weeklyCounts,
  totalApplications,
  averagePerWeek,
  peakWeekLabel,
  isLoading,
  error,
}: Props) {
  const maxCount = Math.max(...weeklyCounts.map((entry) => entry.count), 4);
  const axisTop = Math.ceil(maxCount / 2) * 2;
  const axisStep = Math.max(1, Math.ceil(axisTop / 3));
  const axisTicks = [axisTop, Math.max(0, axisTop - axisStep), Math.max(0, axisTop - axisStep * 2), 0];

  return (
    <section className="active-jobs-side-panel active-jobs-kpi-panel">
      <div className="active-jobs-side-heading">
        <h3>Weekly Application Count</h3>
      </div>
      {isLoading && weeklyCounts.length === 0 ? (
        <div className="active-jobs-kpi-skeleton" aria-hidden>
          <div className="active-jobs-skeleton-line is-wide" />
          <div className="active-jobs-skeleton-line is-medium" />
          <div className="active-jobs-skeleton-grid">
            {Array.from({ length: 5 }).map((_, idx) => (
              <span key={`kpi-skeleton-${idx}`} />
            ))}
          </div>
        </div>
      ) : error && weeklyCounts.length === 0 ? (
        <div className="empty-state">{error}</div>
      ) : (
        <>
          <div className="active-jobs-insights-chart" aria-label="Weekly application counts">
            <div className="active-jobs-insights-axis" aria-hidden>
              {axisTicks.map((tick, idx) => (
                <span key={`axis-${idx}`}>{tick}</span>
              ))}
            </div>
            <div className="active-jobs-insights-bars">
              {weeklyCounts.map((entry) => {
                const normalized = axisTop <= 0 ? 0 : entry.count / axisTop;
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
              <strong>{peakWeekLabel}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
