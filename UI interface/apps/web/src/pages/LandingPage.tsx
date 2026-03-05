import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { login, setStoredSession, signup, type AuthSession } from "../lib/api";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "../lib/paths";
import { ANALYTICS_EVENTS, trackErrorEvent, trackFunnelStep, trackProductEvent } from "../analytics/events";

type LandingPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onAuthenticated: (session: AuthSession) => void;
};

type PreviewRow = {
  company: string;
  role: string;
  referral: "Yes" | "No";
  status: string;
  applied: string;
  oa: string;
  deadline: string;
};

const PREVIEW_ROWS: PreviewRow[] = [
  {
    company: "Google",
    role: "Software Engineer",
    referral: "Yes",
    status: "Interview",
    applied: "Mar 1, 2026",
    oa: "Yes",
    deadline: "Mar 15",
  },
  {
    company: "Meta",
    role: "Backend Engineer",
    referral: "Yes",
    status: "Applied",
    applied: "Mar 3, 2026",
    oa: "Pending",
    deadline: "Mar 20",
  },
  {
    company: "Apple",
    role: "iOS Engineer",
    referral: "No",
    status: "OA",
    applied: "Mar 4, 2026",
    oa: "Yes",
    deadline: "Mar 18",
  },
  {
    company: "Amazon",
    role: "SDE Intern",
    referral: "Yes",
    status: "Applied",
    applied: "Mar 5, 2026",
    oa: "Pending",
    deadline: "Mar 22",
  },
];

const FEATURES = [
  {
    icon: "◎",
    title: "Track Applications",
    description: "Keep every application organized in one place with role, company, date, and status context.",
  },
  {
    icon: "◍",
    title: "Manage Referrals",
    description: "Track referral requests and outcomes so warm intros never get lost during busy weeks.",
  },
  {
    icon: "◉",
    title: "Never Miss Deadlines",
    description: "Stay ahead of OA deadlines and interviews with clear visibility into what needs action next.",
  },
];

const STEP_ITEMS = [
  {
    step: "Step 1",
    title: "Add Applications",
    description: "Add each application in seconds with company, role, and referral context.",
  },
  {
    step: "Step 2",
    title: "Track Progress",
    description: "Move applications through OA, interview, and final outcome states.",
  },
  {
    step: "Step 3",
    title: "Stay Consistent",
    description: "Review momentum and keep follow-ups moving every day.",
  },
  {
    step: "Step 4",
    title: "Compete with Friends",
    description: "Compare progress with friends to stay accountable and keep momentum high.",
  },
];

const LEADERBOARD = [
  { rank: 1, name: "You", score: 10, leader: true },
  { rank: 2, name: "Ethan", score: 8, leader: false },
  { rank: 3, name: "Olivia", score: 7, leader: false },
  { rank: 4, name: "Mason", score: 6, leader: false },
];

const COMPANY_SIGNALS = [
  { company: "Google", role: "Software Engineer", friends: 2, by: "Ethan", status: "Hot" },
  { company: "Meta", role: "Backend Engineer", friends: 1, by: "Olivia", status: "Warm" },
  { company: "Stripe", role: "Product Engineer", friends: 1, by: "You", status: "New" },
  { company: "Amazon", role: "SDE Intern", friends: 2, by: "Mason", status: "Hot" },
];

const COMPETE_KPIS = [
  { label: "Your Rank", value: "#1", delta: "+2 this week" },
  { label: "Apps This Week", value: "10", delta: "2 ahead of avg" },
  { label: "Gap to #2", value: "2", delta: "Strong lead" },
  { label: "Streak", value: "6 days", delta: "Best in group" },
];

const VELOCITY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VELOCITY_SERIES = {
  you: [2, 3, 4, 3, 5, 4, 6],
  friends: [1, 2, 2, 3, 2, 3, 3],
};

const FUNNEL_STAGES = [
  { label: "Applied", value: 28 },
  { label: "OA", value: 16 },
  { label: "Interview", value: 9 },
  { label: "Offer", value: 2 },
];

const REFERRAL_IMPACT = [
  { label: "With Referral", value: 38, note: "+14% conversion" },
  { label: "Direct Apply", value: 24, note: "Baseline conversion" },
];

const TRUST_LOGOS = [
  { name: "Google", src: "/company-logos/google.svg" },
  { name: "Amazon", src: "/company-logos/amazon.svg", darkSrc: "/company-logos/amazon-dark.svg" },
  { name: "Meta", src: "/company-logos/meta.svg", darkSrc: "/company-logos/meta-dark.svg" },
  { name: "NVIDIA", src: "/company-logos/nvidia.svg", darkSrc: "/company-logos/nvidia-dark.svg" },
  { name: "Apple", src: "/company-logos/apple.svg", darkSrc: "/company-logos/apple-dark.svg" },
  { name: "Microsoft", src: "/company-logos/microsoft.svg", darkSrc: "/company-logos/microsoft-dark.svg" },
  { name: "Netflix", src: "/company-logos/netflix.svg" },
];

const TESTIMONIALS = [
  {
    name: "Emma Carter",
    role: "CS Student",
    quote: "Atriveo turned my search from random tabs into one clear weekly system.",
    initials: "EC",
  },
  {
    name: "Olivia Reed",
    role: "New Grad Applicant",
    quote: "I finally stopped missing follow-ups. The timeline and reminders keep me consistent.",
    initials: "OR",
  },
  {
    name: "Ethan Brooks",
    role: "Software Intern Candidate",
    quote: "My referrals, deadlines, and interviews are in one place, so I can focus on quality.",
    initials: "EB",
  },
];

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 17) % 100}%`,
  top: `${(i * 29) % 100}%`,
  size: `${1 + (i % 3)}px`,
  duration: `${16 + (i % 7)}s`,
  delay: `${-(i % 9)}s`,
}));

export default function LandingPage({
  isAuthenticated,
  theme,
  onToggleTheme,
  onAuthenticated,
}: LandingPageProps) {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const featuredTestimonial = TESTIMONIALS[0];
  const secondaryTestimonials = TESTIMONIALS.slice(1);

  function openAuth(mode: "login" | "signup", source = "landing") {
    setAuthMode(mode);
    setAuthError("");
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

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
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
      const session: AuthSession = { token: response.token, user: response.user };
      setStoredSession(session);
      onAuthenticated(session);
      setAuthOpen(false);
      if (authMode === "signup") {
        trackProductEvent(ANALYTICS_EVENTS.signup_completed, {
          source: "landing_auth_modal",
        });
        trackFunnelStep(ANALYTICS_EVENTS.signup_completed, {
          source: "landing_auth_modal",
        });
      } else {
        trackProductEvent(ANALYTICS_EVENTS.login_completed, {
          source: "landing_auth_modal",
        });
      }
      navigate(withDashboardBase(""), { replace: true });
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
              <span>From first application to final offer.</span>
            </h1>
            <p>
              Track applications, manage referrals, and never miss a follow-up. Atriveo gives you one clean operating system for recruiting.
            </p>
            <div className="lv-hero-actions">
              <button type="button" className="lv-btn lv-btn-primary" onClick={() => openAuth("signup")}>Get Started Free</button>
            </div>
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

        <section className="lv-features">
          <div className="lv-wrap">
            <h2>Everything you need to manage your job search.</h2>
            <div className="lv-feature-grid">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="lv-feature-card">
                  <span className="lv-feature-icon" aria-hidden="true">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
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

        <section className="lv-how">
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
          <div className="lv-wrap lv-testimonials-grid">
            <div className="lv-testimonials-copy">
              <h2>What Students Say</h2>
              <p>
                Real feedback from candidates using Atriveo to keep recruiting organized,
                consistent, and less chaotic.
              </p>
            </div>
            <div className="lv-testimonial-rail">
              <article className="lv-testimonial-feature">
                <span className="lv-testimonial-quote lv-testimonial-quote--left" aria-hidden="true">“</span>
                <span className="lv-testimonial-quote lv-testimonial-quote--right" aria-hidden="true">”</span>
                <p className="lv-testimonial-feature-copy">{featuredTestimonial.quote}</p>
                <div className="lv-testimonial-person">
                  <div className="lv-testimonial-avatar lv-testimonial-avatar--1" aria-hidden="true">
                    {featuredTestimonial.initials}
                  </div>
                  <div className="lv-testimonial-person-meta">
                    <strong>{featuredTestimonial.name}</strong>
                    <small>{featuredTestimonial.role}</small>
                  </div>
                </div>
              </article>

              <div className="lv-testimonial-mini-grid">
                {secondaryTestimonials.map((item, index) => (
                  <article key={item.name} className="lv-testimonial-mini">
                    <span className="lv-testimonial-mini-quote" aria-hidden="true">”</span>
                    <div className={`lv-testimonial-avatar lv-testimonial-avatar--${index + 2}`} aria-hidden="true">
                      {item.initials}
                    </div>
                    <div className="lv-testimonial-person-meta">
                      <strong>{item.name}</strong>
                      <small>{item.role}</small>
                    </div>
                    <p>{item.quote}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lv-footer-mini">
        <div className="lv-footer-mini-inner">
          <p>© 2026 Atriveo. Built for ambitious students.</p>
          <div className="lv-footer-mini-actions">
            <nav className="lv-footer-mini-links" aria-label="Social links">
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">x</a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">in</a>
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.21.68-.48v-1.7c-2.78.61-3.37-1.18-3.37-1.18-.45-1.17-1.1-1.48-1.1-1.48-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.88 1.54 2.31 1.1 2.87.85.09-.66.35-1.1.63-1.36-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.03 1.02-2.75-.1-.26-.44-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.83 0 1.67.11 2.45.33 1.91-1.32 2.75-1.05 2.75-1.05.54 1.4.2 2.44.1 2.7.64.72 1.02 1.63 1.02 2.75 0 3.95-2.35 4.82-4.58 5.07.36.32.67.95.67 1.92v2.84c0 .27.18.58.68.48A10 10 0 0 0 12 2Z" />
                </svg>
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
              {authMode === "login" ? "Log in to Atriveo" : "Create your Atriveo account"}
            </h2>
            <p className="lp-auth-subtitle">
              {authMode === "login"
                ? "Use your email and password to continue."
                : "Start your tracker with a clean private workspace."}
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
              <label className="lp-auth-label" htmlFor="lp-password">
                Password
              </label>
              <input
                id="lp-password"
                className="lp-auth-input"
                type="password"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                placeholder={authMode === "signup" ? "Minimum 8 characters" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {authError ? <div className="lp-auth-error">{authError}</div> : null}
              <button type="submit" className="lp-auth-submit" disabled={authLoading}>
                {authLoading
                  ? authMode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : authMode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>
            <p className="lp-auth-switch">
              {authMode === "login" ? "No account? " : "Already have access? "}
              <button type="button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
                {authMode === "login" ? "Create one" : "Log in"}
              </button>
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
