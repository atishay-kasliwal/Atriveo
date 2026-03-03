import { Link } from "react-router-dom";

const navItems = ["Network", "Dashboard", "Active Jobs", "Referrals", "Archive", "Pending Tasks", "Notes"];

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 17H9l-1 1h8l-1-1z" />
      <path d="M18 16H6l1.2-1.8V10a4.8 4.8 0 1 1 9.6 0v4.2L18 16z" />
    </svg>
  );
}

function IconPower() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v8" />
      <path d="M7.4 6.7A8 8 0 1 0 16.6 6.7" />
    </svg>
  );
}

export default function HeaderTestPage() {
  return (
    <div className="header-test-page">
      <header className="header-test-nav-shell">
        <div className="header-test-container">
          <div className="header-test-nav">
            <div className="header-test-top">
              <Link to="/" className="header-test-brand" aria-label="Atriveo home">
                Atriveo<span>.</span>
              </Link>

              <div className="header-test-actions">
                <button type="button" className="header-test-icon-btn" aria-label="Notifications">
                  <IconBell />
                </button>
                <button type="button" className="header-test-action-pill header-test-action-pill--success">
                  New Application
                </button>
                <button type="button" className="header-test-action-pill">
                  Create Task
                </button>
                <button type="button" className="header-test-action-pill">
                  Log Note
                </button>
                <button type="button" className="header-test-action-pill header-test-action-pill--settings">
                  Settings
                </button>
                <button type="button" className="header-test-icon-btn header-test-icon-btn--danger" aria-label="Logout">
                  <IconPower />
                </button>
              </div>
            </div>

            <nav className="header-test-bottom" aria-label="Header preview navigation">
              <div className="header-test-links">
                {navItems.map((item) => (
                  <a
                    key={item}
                    href="#"
                    className={item === "Dashboard" ? "header-test-link header-test-link--active" : "header-test-link"}
                    onClick={(e) => e.preventDefault()}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="header-test-main">
        <section className="header-test-card">
          <h1>Two-row dashboard header test</h1>
          <p>
            This keeps your left nav unchanged and moves logo + action controls to a top row.
            If this feels right, we can apply it directly to the real dashboard layout.
          </p>
          <div className="header-test-actions-row">
            <Link to="/dashboard">Open current dashboard</Link>
            <Link to="/">Back to landing</Link>
          </div>
        </section>
        <section className="header-test-card header-test-card--muted">
          <h2>Why this version</h2>
          <ul>
            <li>Cleaner visual hierarchy: identity and actions first, navigation second.</li>
            <li>More scanable on desktop when there are many right-side action buttons.</li>
            <li>Mobile wraps naturally without compressing the primary nav labels.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
