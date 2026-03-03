import { Link } from "react-router-dom";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "../lib/paths";

const featureCards = [
  {
    title: "Application pipeline that stays honest",
    body: "Track saved roles, referrals, deadlines, and responses without spreadsheets. Filters, CSV import/export, and weekly targets are built in.",
    badge: "Pipeline clarity",
  },
  {
    title: "Signals you can act on",
    body: "Daily/weekly trends, referral mix, rejection patterns, and OA deadlines so you know what to do next instead of guessing.",
    badge: "Decision support",
  },
  {
    title: "Collaboration ready",
    body: "Private by default with friend connections for peer visibility. Sessions are tokenized; passwords are PBKDF2-hashed before hitting the database.",
    badge: "Secure sharing",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Create your Atriveo account",
    body: "Sign up with email + password. We hash credentials and issue a short-lived session token; revoke anytime from Settings (coming next).",
  },
  {
    step: "02",
    title: "Import or add jobs",
    body: "Use the CSV template or quick-add modal to populate your pipeline. Existing admin data stays untouched in its own user scope.",
  },
  {
    step: "03",
    title: "Monitor deadlines & referrals",
    body: "Daily dashboard surfaces OA cutoffs, referrals, pending tasks, and rejections so you can intervene early.",
  },
];

type LandingPageProps = {
  isAuthenticated: boolean;
};

export default function LandingPage({ isAuthenticated }: LandingPageProps) {
  return (
    <div className="landing-shell">
      <div className="landing-bg" aria-hidden />
      <header className="landing-nav">
        <div className="landing-logo-group">
          <img src="/brand/primary-light.svg" alt="Atriveo" className="landing-logo" />
          <span className="landing-mark">Atriveo</span>
          <span className="landing-pill">New domain</span>
        </div>
        <div className="landing-nav-actions">
          <Link className="landing-link" to={withDashboardBase("")}>Product</Link>
          <Link className="landing-link" to="/login">Log in</Link>
          <Link className="landing-cta" to="/signup">Create account</Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-text">
            <p className="landing-eyebrow">Career pipelines without spreadsheet overhead</p>
            <h1>Atriveo keeps job search momentum visible, accountable, and easy to ship.</h1>
            <p className="landing-subtitle">
              Modern pipeline, deadline alerts, referral tracking, and network visibility — now hosted on <strong>Atriveo.com</strong> while
              remaining live at <strong>production.atishaykasliwal.com</strong> during the transition.
            </p>
            <div className="landing-actions">
              <Link className="landing-btn primary" to="/signup">Start free account</Link>
              <Link className="landing-btn ghost" to={withDashboardBase("")}>
                View product
              </Link>
              {isAuthenticated ? (
                <span className="landing-note">You're signed in — jump back to the dashboard.</span>
              ) : null}
            </div>
            <div className="landing-meta">
              <div className="landing-meta-item">
                <span className="dot" /> Dual live: atriveo.com & production.atishaykasliwal.com
              </div>
              <div className="landing-meta-item">
                <span className="dot" /> Data isolated per user — existing records stay mapped to current owners
              </div>
              <div className="landing-meta-item">
                <span className="dot" /> Cloudflare Workers + Neon Postgres stack
              </div>
            </div>
          </div>
          <div className="landing-hero-panel" aria-label="Dashboard preview stats">
            <div className="landing-panel-inner">
              <p className="panel-kicker">Live dashboard snapshot</p>
              <div className="panel-metric-row">
                <div>
                  <p className="metric-label">Applications this week</p>
                  <p className="metric-value">18</p>
                  <p className="metric-delta positive">+22% vs prior week</p>
                </div>
                <div>
                  <p className="metric-label">Referrals secured</p>
                  <p className="metric-value">7</p>
                  <p className="metric-delta">3 pending reviews</p>
                </div>
              </div>
              <div className="panel-progress">
                <div className="panel-progress-label">
                  OA deadlines covered
                  <span className="metric-delta positive">On track</span>
                </div>
                <div className="panel-progress-bar" role="progressbar" aria-valuenow={76} aria-valuemin={0} aria-valuemax={100}>
                  <div className="panel-progress-fill" style={{ width: "76%" }} />
                </div>
                <p className="panel-footnote">Auto-surface OA dates + pending tasks per teammate.</p>
              </div>
              <div className="panel-tags">
                <span>CSV import/export</span>
                <span>Weekly targets</span>
                <span>Friend visibility</span>
                <span>Token-based sessions</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-grid">
          {featureCards.map((card) => (
            <article key={card.title} className="landing-card">
              <span className="landing-card-pill">{card.badge}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="landing-steps">
          <div className="landing-steps-head">
            <p className="landing-eyebrow">How onboarding works</p>
            <h2>Ready for self-serve users without touching existing data.</h2>
            <p className="landing-subtitle">
              Admin accounts keep their data; new signups get an empty, isolated workspace. No migrations required.
            </p>
          </div>
          <div className="landing-steps-grid">
            {howItWorks.map((item) => (
              <article key={item.step} className="landing-step">
                <span className="landing-step-num">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div>
            <p className="landing-eyebrow">Move fast, keep state intact</p>
            <h2>We’ll deploy to Atriveo.com and keep production.atishaykasliwal.com live until you flip DNS.</h2>
            <p className="landing-subtitle">Zero data changes required — just new auth + landing surface.</p>
          </div>
          <div className="landing-bottom-actions">
            <Link className="landing-btn primary" to="/signup">Create account</Link>
            <Link className="landing-btn ghost" to="/login">Log in</Link>
            <Link className="landing-link" to={DASHBOARD_BASE_PATH}>Open dashboard</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
