import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { login, requestPasswordReset, resetPassword, setStoredSession, signup, type AuthSession } from "../lib/api";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "../lib/paths";
import { ANALYTICS_EVENTS, trackErrorEvent, trackFunnelStep, trackProductEvent } from "../analytics/events";
import {
  COMPANY_SIGNALS,
  COMPETE_KPIS,
  EXTENSION_INSTALL_PATH,
  FUNNEL_STAGES,
  LEADERBOARD,
  PARTICLES,
  PRIMARY_FREE_TIER_FEATURES,
  PREVIEW_ROWS,
  REFERRAL_IMPACT,
  SECONDARY_FREE_TIER_FEATURES,
  STEP_ITEMS,
  TRUST_LOGOS,
  TRUST_SIGNALS,
  VELOCITY_LABELS,
  VELOCITY_SERIES,
} from "./landing/constants";

const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/atriveo-job-assistant/ocbmncmmepfjgpnakenoibaambecidcf";

type LandingPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onAuthenticated: (session: AuthSession) => void;
};

export default function LandingPage({
  isAuthenticated,
  theme,
  onToggleTheme,
  onAuthenticated,
}: LandingPageProps) {
  const navigate = useNavigate();
  type AuthMode = "login" | "signup" | "forgotPassword" | "resetPassword";
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const proofQuotes = [
    {
      quote: "Atriveo turned my random tabs into a real job search system.",
      author: "Emma Carter",
      initials: "EC",
    },
    {
      quote: "I finally stopped missing follow-ups and started getting interviews.",
      author: "Olivia Reed",
      initials: "OR",
    },
  ];

  const proofStats = [
    {
      value: "40+ Applications Tracked",
      detail: "Students stay organized without spreadsheets.",
    },
    {
      value: "3 Interviews in 2 Weeks",
      detail: "Candidates report faster interview cycles.",
    },
    {
      value: "Referrals Tracked in One Place",
      detail: "Never lose track of warm introductions.",
    },
    {
      value: "Deadlines Never Missed",
      detail: "Reminders keep applications moving forward.",
    },
  ];

  function openAuth(mode: "login" | "signup", source = "landing") {
    setAuthMode(mode);
    setAuthError("");
    setAuthNotice("");
    setPassword("");
    setPasswordConfirm("");
    setAuthOpen(true);
    if (mode === "signup") {
      trackProductEvent(ANALYTICS_EVENTS.signup_started, {
        source,
      });
      trackFunnelStep(ANALYTICS_EVENTS.signup_started, {
        source,
      });
    }
  }

  function closeAuth() {
    if (authLoading) return;
    setAuthOpen(false);
    setAuthError("");
    setAuthNotice("");
  }

  function openForgotPassword() {
    setAuthMode("forgotPassword");
    setAuthError("");
    setAuthNotice("");
    setPassword("");
    setPasswordConfirm("");
    setAuthOpen(true);
  }

  function handleAuthOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeAuth();
  }

  useEffect(() => {
    trackFunnelStep(ANALYTICS_EVENTS.landing_page_view, {
      source: "landing_page",
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!authOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen, authLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token") || params.get("resetToken");
    if (!tokenFromUrl) return;

    setResetToken(tokenFromUrl);
    setAuthMode("resetPassword");
    setAuthNotice("Set a new password for your account.");
    setAuthError("");
    setAuthOpen(true);
  }, []);

  function completeAuth(
    response: { token: string; user: AuthSession["user"] },
    source: string,
    authProvider: "password" | "google",
    mode: "login" | "signup",
  ) {
    const session: AuthSession = { token: response.token, user: response.user };
    setStoredSession(session);
    onAuthenticated(session);
    setAuthOpen(false);
    if (mode === "signup") {
      trackProductEvent(ANALYTICS_EVENTS.signup_completed, {
        source,
        auth_provider: authProvider,
      });
      trackFunnelStep(ANALYTICS_EVENTS.signup_completed, {
        source,
        auth_provider: authProvider,
      });
    } else {
      trackProductEvent(ANALYTICS_EVENTS.login_completed, {
        source,
        auth_provider: authProvider,
      });
    }
    navigate(withDashboardBase(""), { replace: true });
  }

  function handleExtensionStoreClick(source: "navbar" | "extension_section") {
    trackProductEvent(ANALYTICS_EVENTS.chrome_extension_store_clicked, {
      source,
      destination: "chrome_web_store",
    });
  }

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    if (authMode === "forgotPassword") {
      if (!email.trim()) {
        setAuthError("Email is required.");
        return;
      }
      try {
        setAuthLoading(true);
        const response = await requestPasswordReset(email.trim());
        setAuthMode("login");
        setAuthNotice(response.message || "If your account exists, a reset email has been sent.");
      } catch (err) {
        setAuthError((err as Error).message || "Unable to send reset email.");
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (authMode === "resetPassword") {
      if (!resetToken.trim()) {
        setAuthError("Reset token is missing. Please use the link from your email.");
        return;
      }
      if (!password.trim()) {
        setAuthError("New password is required.");
        return;
      }
      if (password.trim().length < 8) {
        setAuthError("Password must be at least 8 characters.");
        return;
      }
      if (password !== passwordConfirm) {
        setAuthError("Passwords do not match.");
        return;
      }
      try {
        setAuthLoading(true);
        const response = await resetPassword(resetToken.trim(), password);
        setAuthMode("login");
        setAuthNotice(response.message || "Password reset successful. Please log in.");
        setPassword("");
        setPasswordConfirm("");
      } catch (err) {
        setAuthError((err as Error).message || "Unable to reset password.");
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "landing_auth_modal",
        error_type: "missing_required_field",
        form_name: authMode,
      });
      setAuthError("Email and password are required.");
      return;
    }
    if (authMode === "signup" && password.trim().length < 8) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "landing_auth_modal",
        error_type: "password_too_short",
        form_name: authMode,
      });
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    try {
      setAuthLoading(true);
      const response =
        authMode === "signup"
          ? await signup({
              email: email.trim(),
              password,
              first_name: firstName.trim() || undefined,
              last_name: lastName.trim() || undefined,
            })
          : await login(email.trim(), password);
      completeAuth(response, "landing_auth_modal_email", "password", authMode as "login" | "signup");
    } catch (err) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "landing_auth_modal",
        error_type: "auth_submit_failed",
        form_name: authMode,
      });
      setAuthError((err as Error).message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="lv-shell">
      <header className={`lv-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lv-wrap lv-nav-inner">
          <Link to="/" className="lv-logo" aria-label="Atriveo">
            Atriveo<span>.</span>
          </Link>
          <div className="lv-nav-actions">
            <Link to={EXTENSION_INSTALL_PATH} className="lv-btn lv-btn-ghost">
              Add Extension
            </Link>
            {isAuthenticated ? (
              <Link to={DASHBOARD_BASE_PATH} className="lv-btn lv-btn-primary">
                Dashboard
              </Link>
            ) : (
              <button type="button" className="lv-btn lv-btn-ghost" onClick={() => openAuth("login")}>Log in</button>
            )}
          </div>
        </div>
      </header>

      <main className="lv-main">
        <section className="lv-hero">
          <div className="lv-particles" aria-hidden="true">
            {PARTICLES.map((particle) => (
              <span
                key={particle.id}
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  animationDuration: particle.duration,
                  animationDelay: particle.delay,
                }}
              />
            ))}
          </div>
          <div className="lv-wrap lv-hero-inner">
            <h1>
              Your job search, organized.
              <br />
              <span>From first application to final offer. Free.</span>
            </h1>
            <p>
              Track every application, manage referrals, and stay accountable with friends. Atriveo gives you one place to run your job search from first application to final offer, free.
            </p>
            <div className="lv-hero-actions">
              <button type="button" className="lv-btn lv-btn-primary" onClick={() => openAuth("signup")}>Get Started Free</button>
            </div>
            <p className="lv-hero-proof">✓ No credit card required · ✓ Free to use · ✓ Trusted by 1,000+ users</p>
          </div>
        </section>

        <section id="lv-preview" className="lv-preview">
          <div className="lv-wrap lv-preview-wrap">
            <article className="lv-dashboard-card">
              <div className="lv-dashboard-top">
                <div className="lv-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Atriveo.</strong>
                <span className="lv-top-pill">Applications All</span>
              </div>
              <div className="lv-dashboard-body">
                <aside className="lv-dashboard-side" aria-label="Navigation preview">
                  <button type="button" className="is-active">Applications</button>
                  <button type="button">Referrals</button>
                  <button type="button">Follow Up</button>
                  <button type="button">Archive</button>
                </aside>
                <div className="lv-dashboard-table-wrap">
                  <div className="lv-dashboard-table-head">
                    <span>Company</span>
                    <span>Referral</span>
                    <span>Status</span>
                    <span>Applied</span>
                    <span>OA</span>
                    <span>Deadline</span>
                  </div>
                  {PREVIEW_ROWS.map((row) => (
                    <div key={`${row.company}-${row.role}`} className="lv-dashboard-row">
                      <span className="lv-company-cell">
                        <i aria-hidden="true">{row.company[0]}</i>
                        <em>
                          <strong>{row.company}</strong>
                          <small>{row.role}</small>
                        </em>
                      </span>
                      <span>{row.referral}</span>
                      <span>{row.status}</span>
                      <span>{row.applied}</span>
                      <span>{row.oa}</span>
                      <span>{row.deadline}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="lv-float-card lv-float-card--left">
              <header>
                <span aria-hidden="true">◎</span>
                <strong>Applications till now</strong>
              </header>
              <p className="lv-float-value">28</p>
              <p className="lv-float-meta">Software applications this month</p>
              <div className="lv-float-bar">
                <span style={{ width: "78%" }} />
              </div>
              <div className="lv-float-row">
                <small>OA completion</small>
                <strong>78%</strong>
              </div>
            </article>

            <article className="lv-float-card lv-float-card--right">
              <header>
                <span aria-hidden="true">◉</span>
                <strong>Upcoming Interview</strong>
              </header>
              <p className="lv-float-meta">Tomorrow at 2:00 PM</p>
              <div className="lv-mini-bars" aria-hidden="true">
                {[26, 38, 44, 51, 35, 48, 58, 64].map((height, index) => (
                  <span key={`bar-${index}`} style={{ height: `${height}%` }} />
                ))}
              </div>
            </article>

            <article className="lv-float-card lv-float-card--top-right">
              <header>
                <span aria-hidden="true">◎</span>
                <strong>Follow Up Today</strong>
              </header>
              <p className="lv-float-value">3</p>
              <p className="lv-float-meta">Pending follow-ups today</p>
              <div className="lv-float-bar">
                <span style={{ width: "62%" }} />
              </div>
              <div className="lv-float-row">
                <small>Response rate</small>
                <strong>62%</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="lv-social-proof">
          <div className="lv-wrap">
            <p>Built for students applying to top tech companies.</p>
            <div className="lv-social-proof-logos">
              {TRUST_LOGOS.map((logo) => (
                <span key={logo.name} className="lv-social-proof-logo">
                  <img
                    src={theme === "dark" ? logo.darkSrc ?? logo.src : logo.src}
                    alt={logo.name}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="lv-trust-signals">
          <div className="lv-wrap">
            <h2>Why 1000+ job seekers trust Atriveo</h2>
            <div className="lv-trust-grid">
              {TRUST_SIGNALS.map((signal) => (
                <article key={signal.label} className="lv-trust-card">
                  <span className="lv-trust-icon">{signal.icon}</span>
                  <h3>{signal.label}</h3>
                  <p>{signal.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lv-extension-showcase" aria-label="Atriveo Chrome extension">
          <div className="lv-wrap lv-extension-grid">
            <div className="lv-extension-preview" aria-hidden="true">
              <div className="lv-extension-pill-row">
                <span className="lv-extension-pill-label">Works on</span>
                <span className="lv-extension-pill">
                  <i className="lv-extension-pill-mark lv-extension-pill-mark--workday">W</i>
                  Workday
                </span>
                <span className="lv-extension-pill">
                  <i className="lv-extension-pill-mark lv-extension-pill-mark--greenhouse">G</i>
                  Greenhouse
                </span>
                <span className="lv-extension-pill">
                  <i className="lv-extension-pill-mark lv-extension-pill-mark--lever">L</i>
                  Lever
                </span>
                <span className="lv-extension-pill lv-extension-pill--more">+19 coming soon</span>
              </div>

              <article className="lv-extension-browser">
                <header className="lv-extension-browser-head">
                  <div className="lv-window-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="lv-extension-browser-tab" />
                  <span className="lv-extension-browser-add" />
                  <span className="lv-extension-browser-action">
                    <i />
                  </span>
                </header>

                <div className="lv-extension-browser-body">
                  <aside className="lv-extension-mini-popup" aria-hidden="true">
                    <strong>Atriveo</strong>
                    <span className="lv-extension-mini-line" />
                    <span className="lv-extension-mini-line lv-extension-mini-line--short" />
                    <span className="lv-extension-mini-add">Add</span>
                  </aside>

                  <div className="lv-extension-company">
                    <span className="lv-extension-company-mark">A.</span>
                    <div>
                      <strong>airbnb</strong>
                      <small>Software Engineer</small>
                    </div>
                  </div>

                  <div className="lv-extension-skeleton" aria-hidden="true">
                    <span style={{ width: "62%" }} />
                    <span style={{ width: "34%" }} />
                    <span style={{ width: "22%" }} />
                    <span style={{ width: "28%" }} />
                    <span style={{ width: "18%" }} />
                    <span style={{ width: "24%" }} />
                  </div>

                  <div className="lv-extension-metrics" aria-hidden="true">
                    <article className="lv-extension-metric">
                      <small>Autofill Rate</small>
                      <strong>87%</strong>
                      <div className="lv-extension-sparkline">
                        <span style={{ height: "36%" }} />
                        <span style={{ height: "42%" }} />
                        <span style={{ height: "54%" }} />
                        <span style={{ height: "48%" }} />
                        <span style={{ height: "63%" }} />
                        <span style={{ height: "72%" }} />
                        <span style={{ height: "68%" }} />
                        <span style={{ height: "79%" }} />
                      </div>
                    </article>

                    <article className="lv-extension-mini-funnel">
                      <small>Stages</small>
                      <div className="lv-extension-mini-funnel-bars">
                        <span style={{ width: "100%" }} />
                        <span style={{ width: "72%" }} />
                        <span style={{ width: "46%" }} />
                      </div>
                    </article>
                  </div>
                </div>
              </article>
            </div>

            <div className="lv-extension-copy">
              <p className="lv-extension-kicker">
                <span aria-hidden="true">A.</span>
                Apply Faster with Atriveo
              </p>
              <h2>Automatically detect job applications and streamline the process.</h2>
              <p>
                The Atriveo Job Assistant captures important job details and helps you autofill repetitive fields so you can apply faster and stay organized.
              </p>
              <div className="lv-extension-actions">
                <a
                  className="lv-btn lv-btn-primary lv-extension-cta-primary"
                  href={CHROME_WEB_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => handleExtensionStoreClick("extension_section")}
                >
                  Add Extension
                </a>
                <Link className="lv-btn lv-btn-outline lv-extension-cta-secondary" to={EXTENSION_INSTALL_PATH}>
                  Learn More
                </Link>
              </div>
              <p className="lv-extension-proof" aria-label="social proof">
                <span>★★★★★</span> 200,000+ applications submitted
              </p>
            </div>
          </div>
        </section>

        <section id="lv-features" className="lv-free-features">
          <div className="lv-wrap">
            <h2>Everything You Need to Manage Your Job Search</h2>
            <p className="lv-free-subtitle">A cleaner system for applications, deadlines, and follow-through so you can stay organized and move with confidence.</p>
            <div className="lv-free-primary-grid">
              {PRIMARY_FREE_TIER_FEATURES.map((feature) => (
                <article key={feature.title} className="lv-free-primary-card">
                  <span className="lv-free-primary-icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
            <div className="lv-free-secondary-wrap">
              <div className="lv-free-secondary-list" role="list" aria-label="Additional Atriveo features">
                {SECONDARY_FREE_TIER_FEATURES.map((feature) => (
                  <div key={feature.label} className="lv-free-secondary-item" role="listitem">
                    <span className="lv-free-secondary-icon" aria-hidden="true">{feature.icon}</span>
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lv-free-cta">
              <button type="button" className="lv-btn lv-btn-primary" onClick={() => openAuth("signup")}>
                Start Tracking Jobs for Free
              </button>
              <p className="lv-free-cta-note">No credit card required</p>
            </div>
          </div>
        </section>

        <section className="lv-compete">
          <div className="lv-wrap">
            <header className="lv-compete-head">
              <span>LEADERBOARD</span>
              <h2>Compete with your friends.</h2>
              <p>Stay motivated by comparing application momentum with your network.</p>
            </header>

            <div className="lv-compete-board">
              <div className="lv-compete-kpi-row">
                {COMPETE_KPIS.map((item) => (
                  <article key={item.label} className="lv-compete-kpi">
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <span>{item.delta}</span>
                  </article>
                ))}
              </div>

              <div className="lv-compete-main">
                <div className="lv-compete-visuals">
                  <article className="lv-compete-panel">
                    <h3>Weekly Velocity</h3>
                    <p className="lv-panel-subtitle">Applications per day: you vs group average</p>
                    <div className="lv-velocity-series">
                      <div className="lv-velocity-row">
                        <small>You</small>
                        <div className="lv-velocity-bars" aria-hidden="true">
                          {VELOCITY_SERIES.you.map((value, index) => (
                            <span key={`you-${VELOCITY_LABELS[index]}`}>
                              <i style={{ height: `${18 + value * 12}px` }} />
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="lv-velocity-row">
                        <small>Friends Avg</small>
                        <div className="lv-velocity-bars lv-velocity-bars--alt" aria-hidden="true">
                          {VELOCITY_SERIES.friends.map((value, index) => (
                            <span key={`friends-${VELOCITY_LABELS[index]}`}>
                              <i style={{ height: `${18 + value * 12}px` }} />
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="lv-velocity-labels" aria-hidden="true">
                        {VELOCITY_LABELS.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="lv-compete-panel">
                    <h3>Stage Funnel</h3>
                    <p className="lv-panel-subtitle">See where your pipeline compresses</p>
                    <div className="lv-funnel-list">
                      {FUNNEL_STAGES.map((stage, index) => (
                        <div key={stage.label} className="lv-funnel-row">
                          <small>{stage.label}</small>
                          <div className="lv-funnel-bar">
                            <span
                              style={{ width: `${Math.max(10, (stage.value / FUNNEL_STAGES[0].value) * 100)}%` }}
                            />
                          </div>
                          <strong>{stage.value}</strong>
                          {index < FUNNEL_STAGES.length - 1 ? <em>→</em> : null}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="lv-compete-panel">
                    <h3>Referral Impact</h3>
                    <p className="lv-panel-subtitle">Conversion rate by channel</p>
                    <div className="lv-impact-list">
                      {REFERRAL_IMPACT.map((item) => (
                        <div key={item.label} className="lv-impact-row">
                          <div>
                            <small>{item.label}</small>
                            <span>{item.note}</span>
                          </div>
                          <div className="lv-impact-meter">
                            <i style={{ width: `${item.value}%` }} />
                          </div>
                          <strong>{item.value}%</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <aside className="lv-compete-side">
                  <article className="lv-compete-panel">
                    <h3>Weekly Board</h3>
                    <div className="lv-leaderboard-list">
                      {LEADERBOARD.map((entry) => (
                        <div key={entry.rank} className={`lv-leaderboard-row${entry.leader ? " is-leader" : ""}`}>
                          <span>{entry.rank}</span>
                          <strong>{entry.name}</strong>
                          <em>{entry.score}</em>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="lv-compete-panel">
                    <h3>Target Signals</h3>
                    <div className="lv-signal-list">
                      {COMPANY_SIGNALS.map((signal) => (
                        <div key={signal.company} className="lv-signal-row">
                          <div className="lv-signal-head">
                            <strong>{signal.company}</strong>
                            <span className={`lv-signal-badge lv-signal-badge--${signal.status.toLowerCase()}`}>{signal.status}</span>
                          </div>
                          <small>{signal.role}</small>
                          <span>{signal.friends} friend applied</span>
                          <em>By {signal.by}</em>
                        </div>
                      ))}
                    </div>
                  </article>
                </aside>
              </div>

              <div className="lv-compete-footrow">
                <div className="lv-compete-strip">
                  <span>Lead: +2</span>
                  <span>Today: You 4</span>
                  <span>Weekly Wins: You 3</span>
                  <span>Team Total: 36</span>
                  <span>Referral Lift: +14%</span>
                  <span>Top Momentum: You</span>
                </div>
                <button type="button" className="lv-btn lv-btn-outline" onClick={() => openAuth("signup")}>
                  View Full Leaderboard
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="lv-how" className="lv-how">
          <div className="lv-wrap">
            <h2>How it works</h2>
            <div className="lv-step-grid">
              {STEP_ITEMS.map((step) => (
                <article key={step.title} className="lv-step-card">
                  <span>{step.step}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="lv-testimonials">
          <div className="lv-wrap">
            <header className="lv-testimonials-head">
              <h2>Students Are Landing Interviews With Atriveo</h2>
              <p>Real outcomes from candidates who use Atriveo to stay consistent, organized, and interview-ready.</p>
            </header>

            <div className="lv-proof-quotes" role="list" aria-label="Student testimonials">
              {proofQuotes.map((item) => (
                <article key={item.author} className="lv-proof-quote" role="listitem">
                  <p>"{item.quote}"</p>
                  <div className="lv-proof-quote-person">
                    <span className="lv-proof-avatar" aria-hidden="true">{item.initials}</span>
                    <small>{item.author}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="lv-proof-metrics" role="list" aria-label="Student outcomes">
              {proofStats.map((item) => (
                <article key={item.value} className="lv-proof-metric" role="listitem">
                  <h3>{item.value}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="lv-footer-mini">
        <div className="lv-footer-mini-inner">
          <p>© 2026 Atriveo. Built for ambitious students.</p>
          <div className="lv-footer-mini-actions">
            <nav className="lv-footer-mini-legal" aria-label="Legal links">
              <a href="https://www.atriveo.com/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              <span aria-hidden="true">•</span>
              <a href="https://www.atriveo.com/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
            </nav>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="lv-footer-theme-toggle" />
          </div>
        </div>
      </footer>

      {authOpen ? (
        <div className="lp-auth-overlay" onMouseDown={handleAuthOverlayClick}>
          <section className="lp-auth-modal" role="dialog" aria-modal="true" aria-label="Authentication">
            <button type="button" className="lp-auth-close" onClick={closeAuth} aria-label="Close">
              ×
            </button>
            <h2 className="lp-auth-title">
              {authMode === "login"
                ? "Log in to Atriveo"
                : authMode === "signup"
                  ? "Create your Atriveo account"
                  : authMode === "forgotPassword"
                    ? "Reset your password"
                    : "Set a new password"}
            </h2>
            <p className="lp-auth-subtitle">
              {authMode === "login"
                ? "Use your email and password to continue."
                : authMode === "signup"
                  ? "Start your tracker with a clean private workspace."
                  : authMode === "forgotPassword"
                    ? "Enter your account email and we will send a reset link."
                    : "Enter and confirm your new password."}
            </p>
            <form className="lp-auth-form" onSubmit={onSubmitAuth}>
              {authMode === "signup" ? (
                <div className="lp-auth-name-row">
                  <div>
                    <label className="lp-auth-label" htmlFor="lp-first-name">
                      First name
                    </label>
                    <input
                      id="lp-first-name"
                      className="lp-auth-input"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Alex"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="lp-auth-label" htmlFor="lp-last-name">
                      Last name
                    </label>
                    <input
                      id="lp-last-name"
                      className="lp-auth-input"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Rivera"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              {authMode !== "resetPassword" ? (
                <>
                  <label className="lp-auth-label" htmlFor="lp-email">
                    Email
                  </label>
                  <input
                    id="lp-email"
                    className="lp-auth-input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </>
              ) : null}

              {authMode !== "forgotPassword" ? (
                <>
                  <label className="lp-auth-label" htmlFor="lp-password">
                    {authMode === "resetPassword" ? "New password" : "Password"}
                  </label>
                  <input
                    id="lp-password"
                    className="lp-auth-input"
                    type="password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    placeholder={authMode === "login" ? "Enter your password" : "Minimum 8 characters"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </>
              ) : null}

              {authMode === "resetPassword" ? (
                <>
                  <label className="lp-auth-label" htmlFor="lp-password-confirm">
                    Confirm new password
                  </label>
                  <input
                    id="lp-password-confirm"
                    className="lp-auth-input"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                  />
                </>
              ) : null}

              {authMode === "login" ? (
                <button type="button" className="lp-auth-link-btn" onClick={openForgotPassword}>
                  Forgot password?
                </button>
              ) : null}

              {authNotice ? <div className="lp-auth-notice">{authNotice}</div> : null}
              {authError ? <div className="lp-auth-error">{authError}</div> : null}
              <button type="submit" className="lp-auth-submit" disabled={authLoading}>
                {authLoading
                  ? authMode === "login"
                    ? "Signing in..."
                    : authMode === "forgotPassword"
                      ? "Sending reset link..."
                      : authMode === "resetPassword"
                        ? "Saving password..."
                    : "Creating account..."
                  : authMode === "login"
                    ? "Log in"
                    : authMode === "signup"
                      ? "Create account"
                      : authMode === "forgotPassword"
                        ? "Send reset link"
                        : "Set new password"}
              </button>
              {authMode === "login" || authMode === "signup" ? (
                <>
                  <div className="lp-auth-divider" role="separator" aria-label="or">
                    <span>or</span>
                  </div>
                  <GoogleAuthButton
                    mode={authMode}
                    theme={theme}
                    disabled={authLoading}
                    onSuccess={(response) => completeAuth(response, "landing_auth_modal_google", "google", authMode)}
                    onError={(message) => {
                      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
                        component_name: "landing_auth_modal",
                        error_type: "google_auth_failed",
                        form_name: authMode,
                      });
                      setAuthError(message);
                    }}
                  />
                </>
              ) : null}
            </form>
            <p className="lp-auth-switch">
              {authMode === "login" ? "No account? " : authMode === "signup" ? "Already have access? " : "Back to sign in? "}
              <button
                type="button"
                onClick={() => {
                  setAuthError("");
                  setAuthNotice("");
                  if (authMode === "login") {
                    setAuthMode("signup");
                  } else {
                    setAuthMode("login");
                  }
                }}
              >
                {authMode === "login" ? "Create one" : "Log in"}
              </button>
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
