import { ACTIVE_JOBS_PREMIUM_KPIS } from "../../constants";

export default function ActiveJobsKpiPanel() {
  return (
    <section className="active-jobs-side-panel active-jobs-kpi-panel">
      <div className="active-jobs-side-heading">
        <h3>Live KPIs</h3>
        <span>Updated today</span>
      </div>
      <div className="active-jobs-kpi-premium-grid">
        <article className="active-jobs-kpi-premium-card is-line">
          <header className="active-jobs-kpi-premium-head">
            <p>{ACTIVE_JOBS_PREMIUM_KPIS.monthly.label}</p>
            <span className="active-jobs-kpi-pill">{ACTIVE_JOBS_PREMIUM_KPIS.monthly.delta}</span>
          </header>
          <p className="active-jobs-kpi-premium-value">{ACTIVE_JOBS_PREMIUM_KPIS.monthly.value}</p>
          <p className="active-jobs-kpi-premium-status">{ACTIVE_JOBS_PREMIUM_KPIS.monthly.status}</p>
          <svg viewBox="0 0 240 70" className="active-jobs-kpi-sparkline" aria-hidden>
            <path d={ACTIVE_JOBS_PREMIUM_KPIS.monthly.sparkPath} />
          </svg>
        </article>

        <article className="active-jobs-kpi-premium-card is-bars">
          <header className="active-jobs-kpi-premium-head">
            <p>{ACTIVE_JOBS_PREMIUM_KPIS.oa.label}</p>
            <span className="active-jobs-kpi-pill">{ACTIVE_JOBS_PREMIUM_KPIS.oa.delta}</span>
          </header>
          <p className="active-jobs-kpi-premium-value">{ACTIVE_JOBS_PREMIUM_KPIS.oa.value}</p>
          <p className="active-jobs-kpi-premium-status">{ACTIVE_JOBS_PREMIUM_KPIS.oa.status}</p>
          <div className="active-jobs-kpi-bars" aria-hidden>
            {ACTIVE_JOBS_PREMIUM_KPIS.oa.bars.map((height, idx) => (
              <span key={`kpi-bar-${idx}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
