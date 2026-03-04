import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { login, setStoredSession, signup, type AuthSession } from "../lib/api";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "../lib/paths";

// Keep extended marketing sections disabled for now; flip to true when content is ready.
const SHOW_EXTENDED_LANDING = false;

const TAB_ITEMS = [
  {
    id: "job-matches",
    label: "Job Matches",
    title: "Get matched to relevant jobs with higher signal.",
  },
  {
    id: "copilot-extension",
    label: "Copilot Extension",
    title: "Autofill repetitive forms and speed up submissions.",
  },
  {
    id: "ai-resume-builder",
    label: "AI Resume Builder",
    title: "Generate targeted resume versions for each role.",
  },
  {
    id: "job-tracker",
    label: "Job Tracker",
    title: "Track every application stage without spreadsheets.",
  },
];

const CURATED_LISTS = [
  "Top Summer 2026 Internships",
  "Senior Software Jobs at Unicorn Startups",
  "New Grad Jobs in NYC",
  "Top Entry-Level Remote Jobs",
  "Internships in the SF Bay Area",
  "Top Marketing Internships",
  "Entry Level UI and UX Design Jobs",
  "Entry Level IT and Cybersecurity Jobs",
  "Internships at Unicorns",
];

const TOOLS = [
  {
    title: "Resume ATS Score",
    description:
      "Analyze keyword coverage and role fit before each application is submitted.",
  },
  {
    title: "Cover Letter Generator",
    description:
      "Create role-specific cover letters quickly, then refine tone and examples.",
  },
  {
    title: "Career Journal",
    description:
      "Capture wins, interview notes, and follow-up context in one running timeline.",
  },
  {
    title: "Networking Copilot",
    description:
      "Track outreach touches, referral paths, and warm intros without losing context.",
  },
  {
    title: "Job Lists",
    description:
      "Save high-signal themed lists to focus search effort where outcomes are strongest.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Atriveo helped me focus on quality opportunities instead of scrolling random listings.",
    name: "Albert",
    role: "Software Engineer Intern",
    company: "Jane Street",
  },
  {
    quote:
      "The application workflow is clear and actionable. I stopped missing deadlines.",
    name: "Divya",
    role: "Summer Associate",
    company: "Insight Partners",
  },
  {
    quote:
      "The tracker plus resume workflow saved hours every week during recruiting season.",
    name: "Rio",
    role: "Business Analyst",
    company: "Deloitte",
  },
];

const FAQS = [
  {
    question: "How does Atriveo work?",
    answer:
      "Create an account, define role preferences, and manage your full search pipeline from discovery to follow-up.",
  },
  {
    question: "How do you handle my data?",
    answer:
      "Passwords are PBKDF2 hashed and account data is scoped per user so records are isolated and protected.",
  },
  {
    question: "How are jobs sourced?",
    answer:
      "Jobs are indexed from public sources and ranked against your role, location, level, and preference constraints.",
  },
];

type LandingPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onAuthenticated: (session: AuthSession) => void;
};

type MockupProps = {
  compact?: boolean;
};

function ProductMockup({ compact = false }: MockupProps) {
  return (
    <div className={`lp-mockup ${compact ? "lp-mockup--compact" : ""}`} aria-hidden>
      <div className="lp-mockup-top">
        <span />
        <span />
        <span />
      </div>
      <div className="lp-mockup-body">
        <div className="lp-mock-line lp-mock-line--lg" />
        <div className="lp-mock-line lp-mock-line--md" />
        <div className="lp-mock-line lp-mock-line--sm" />
        <div className="lp-mock-grid">
          <article />
          <article />
          <article />
        </div>
      </div>
    </div>
  );
}

type SectionLabelProps = {
  text: string;
};

function SectionLabel({ text }: SectionLabelProps) {
  return (
    <p className="lp-label">
      <span className="lp-label-icon" aria-hidden />
      {text}
    </p>
  );
}

type FaqRowProps = {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
};

function FaqRow({ question, answer, open, onToggle }: FaqRowProps) {
  return (
    <article className={`lp-faq-row ${open ? "lp-faq-row--open" : ""}`}>
      <button type="button" className="lp-faq-trigger" aria-expanded={open} onClick={onToggle}>
        <span>{question}</span>
        <span>{open ? "-" : "+"}</span>
      </button>
      <div className="lp-faq-answer-wrap" aria-hidden={!open}>
        <p>{answer}</p>
      </div>
    </article>
  );
}

export default function LandingPage({
  isAuthenticated,
  theme,
  onToggleTheme,
  onAuthenticated,
}: LandingPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB_ITEMS[0].id);
  const [openFaq, setOpenFaq] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const activeTabTitle = useMemo(
    () => TAB_ITEMS.find((item) => item.id === activeTab)?.title ?? TAB_ITEMS[0].title,
    [activeTab]
  );

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode);
    setAuthError("");
    setAuthOpen(true);
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
      setAuthError("Email and password are required.");
      return;
    }
    if (authMode === "signup" && password.trim().length < 8) {
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
      navigate(withDashboardBase(""), { replace: true });
    } catch (err) {
      setAuthError((err as Error).message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="lp-shell">
      <header className="lp-navbar">
        <div className="lp-container lp-navbar-inner">
          <Link to="/" className="lp-logo" aria-label="Atriveo">
            Atriveo<span>.</span>
          </Link>
          <div className="lp-nav-right">
            {isAuthenticated ? (
              <Link to={DASHBOARD_BASE_PATH} className="lp-dashboard-button">
                Dashboard
              </Link>
            ) : (
              <button
                type="button"
                className="lp-dashboard-button lp-dashboard-button--minimal"
                onClick={() => openAuth("login")}
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-section lp-hero lp-reveal">
          <div className="lp-container lp-hero-inner">
            <h1>
              <span className="lp-headline-line">Your job search, organized.</span>
              <span className="lp-headline-line lp-highlight">From first apply to final offer.</span>
            </h1>
            <p>
              Run your search with clarity: track applications, manage referrals, and never miss a
              follow-up.
            </p>
            <div className="lp-hero-actions">
              <button type="button" className="lp-btn lp-btn-primary" onClick={() => openAuth("signup")}>
                Get Started Free
              </button>
            </div>
            <div className="lp-hero-proof">
              <span>No spreadsheets. No missed follow-ups.</span>
            </div>
            <div className="lp-hero-preview">
              <ProductMockup />
            </div>
          </div>
        </section>
        {SHOW_EXTENDED_LANDING ? (
          <>
            <section className="lp-section lp-tabs-section lp-reveal lp-reveal-d1">
              <div className="lp-container lp-tabs-inner">
                <div className="lp-tab-strip" role="tablist" aria-label="Feature tabs">
                  {TAB_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === item.id}
                      className={`lp-tab ${activeTab === item.id ? "lp-tab--active" : ""}`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="lp-tab-caption">{activeTabTitle}</p>
                <div className="lp-tabs-preview">
                  <ProductMockup />
                </div>
              </div>
            </section>

            <section className="lp-section lp-step-section lp-reveal lp-reveal-d1">
              <div className="lp-container">
                <h2 className="lp-center-title">
                  We are here for <span className="lp-highlight">every step</span> of your search.
                </h2>
                <div className="lp-split">
                  <div className="lp-copy">
                    <SectionLabel text="Job Matches" />
                    <h3>Get matched to relevant jobs, personalized to you</h3>
                    <p>
                      Tell us your preferences and dealbreakers. Atriveo helps you focus on openings
                      that align with your target outcomes.
                    </p>
                    <button type="button" className="lp-btn lp-btn-primary" onClick={() => openAuth("signup")}>
                      Get Matched Now
                    </button>
                  </div>
                  <div className="lp-visual-card">
                    <ProductMockup />
                  </div>
                </div>
              </div>
            </section>

            <section id="curated-lists" className="lp-section lp-curated-section lp-reveal lp-reveal-d2">
              <div className="lp-container">
                <h2 className="lp-center-title">Explore our expert-curated job lists.</h2>
                <p className="lp-center-copy">
                  High-signal themed lists are updated regularly so you can find better opportunities
                  with less noise.
                </p>
                <div className="lp-curated-grid">
                  {CURATED_LISTS.map((item) => (
                    <article key={item} className="lp-curated-card">
                      <span className="lp-curated-icon" aria-hidden />
                      <strong>{item}</strong>
                      <span className="lp-curated-go">Go</span>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="lp-section lp-tools-section lp-reveal lp-reveal-d1">
              <div className="lp-container">
                <h2 className="lp-center-title">More tools to help you stand out from the crowd.</h2>
                <div className="lp-tools-grid">
                  {TOOLS.map((tool) => (
                    <article key={tool.title} className="lp-tool-card">
                      <h3>{tool.title}</h3>
                      <p>{tool.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="tracker" className="lp-section lp-tracker-section lp-reveal">
              <div className="lp-container lp-split">
                <div className="lp-visual-card">
                  <ProductMockup />
                </div>
                <div className="lp-copy">
                  <SectionLabel text="Job Tracker" />
                  <h3>Bookmark jobs and track your search</h3>
                  <p>
                    Keep applications, follow-ups, and outcomes in one timeline so your search stays
                    organized and visible.
                  </p>
                  <button type="button" className="lp-btn lp-btn-primary" onClick={() => openAuth("signup")}>
                    Track Your Applications
                  </button>
                </div>
              </div>
            </section>

            <section className="lp-section lp-testimonial-section lp-reveal lp-reveal-d1">
              <div className="lp-container">
                <h2 className="lp-center-title">
                  Join over 1,000,000 candidates who hear back more with structured search execution.
                </h2>
                <div className="lp-testimonial-track">
                  {TESTIMONIALS.map((item) => (
                    <article key={`${item.name}-${item.company}`} className="lp-testimonial-card">
                      <div className="lp-avatar" aria-hidden>
                        {item.name.slice(0, 1)}
                      </div>
                      <p>{item.quote}</p>
                      <strong>{item.name}</strong>
                      <span>{item.role}</span>
                      <em>{item.company}</em>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="autofill" className="lp-section lp-autofill-section lp-reveal lp-reveal-d2">
              <div className="lp-container lp-split">
                <div className="lp-visual-card">
                  <ProductMockup />
                </div>
                <div className="lp-copy">
                  <SectionLabel text="Autofill Applications" />
                  <h3>Autofill repetitive job application questions</h3>
                  <p>
                    Reduce repetitive form typing and keep application quality high with a repeatable,
                    faster submission workflow.
                  </p>
                  <div className="lp-inline-actions">
                    <button type="button" className="lp-btn lp-btn-primary" onClick={() => openAuth("signup")}>
                      Add to Chrome
                    </button>
                    <button type="button" className="lp-btn lp-btn-outline" onClick={() => openAuth("signup")}>
                      Learn More
                    </button>
                  </div>
                  <p className="lp-proof-line">
                    <span className="lp-stars" aria-hidden>
                      *****
                    </span>
                    200,000,000+ applications submitted
                  </p>
                </div>
              </div>
            </section>

            <section id="resume-builder" className="lp-section lp-resume-section lp-reveal lp-reveal-d1">
              <div className="lp-container lp-split lp-split--reverse">
                <div className="lp-copy">
                  <SectionLabel text="AI Resume Builder" />
                  <h3>Craft the perfect tailored resume for every job</h3>
                  <p>
                    Generate role-specific resume versions and close keyword gaps before you submit.
                  </p>
                  <button type="button" className="lp-btn lp-btn-primary" onClick={() => openAuth("signup")}>
                    Get a Free Resume
                  </button>
                </div>
                <div className="lp-visual-card">
                  <ProductMockup />
                </div>
              </div>
            </section>

            <section id="faq" className="lp-section lp-faq-section lp-reveal lp-reveal-d2">
              <div className="lp-container">
                <h2 className="lp-center-title">Got questions?</h2>
                <p className="lp-center-copy">Explore our FAQ section to learn more.</p>
                <div className="lp-faq-list">
                  {FAQS.map((item, index) => (
                    <FaqRow
                      key={item.question}
                      question={item.question}
                      answer={item.answer}
                      open={openFaq === index}
                      onToggle={() => setOpenFaq(openFaq === index ? -1 : index)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
      <footer className="lp-footer-minimal">
        <div className="lp-container lp-footer-minimal-inner">
          <div className="lp-footer-top-grid">
            <section className="lp-footer-brand">
              <h3 className="lp-logo lp-logo--footer-minimal">
                Atriveo<span>.</span>
              </h3>
              <p className="lp-footer-tagline">
                Track applications. Compete with friends. Stay accountable.
              </p>
            </section>
            <section className="lp-footer-columns" aria-label="Footer navigation">
              <div className="lp-footer-column">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#how-it-works">How It Works</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div className="lp-footer-column">
                <h4>Resources</h4>
                <a href="#help-center">Help Center</a>
                <a href="#faq">FAQ</a>
                <a href="#blog">Blog</a>
                <a href="#contact">Contact</a>
              </div>
              <div className="lp-footer-column">
                <h4>Legal</h4>
                <a href="#privacy-policy">Privacy Policy</a>
                <a href="#terms-of-use">Terms of Use</a>
                <a href="#cookie-policy">Cookie Policy</a>
              </div>
            </section>
            <aside className="lp-footer-cta-card" aria-label="Footer callout">
              <p className="lp-footer-cta-title">Built for ambitious students.</p>
              <p className="lp-footer-cta-copy">
                Designed to help you stay consistent and land better opportunities.
              </p>
            </aside>
          </div>
          <div className="lp-footer-bottom-strip">
            <p className="lp-footer-bottom-copy">© 2026 Atriveo. Built for ambitious students.</p>
            <div className="lp-footer-bottom-actions">
              <nav className="lp-footer-social-row" aria-label="Social links">
                <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Twitter">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M18.36 5H21l-5.76 6.58L22 19h-5.31l-4.15-5.42L7.8 19H5.15l6.16-7.05L4 5h5.45l3.75 4.95L18.36 5Z" fill="currentColor" />
                  </svg>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6.75 8.25A1.5 1.5 0 1 0 6.75 5.25A1.5 1.5 0 1 0 6.75 8.25Z" fill="currentColor" />
                    <path d="M5.5 9.75H8V18.5H5.5V9.75Z" fill="currentColor" />
                    <path d="M10 9.75H12.4V11H12.45C12.78 10.37 13.58 9.7 14.78 9.7C17.28 9.7 17.75 11.25 17.75 13.28V18.5H15.25V13.88C15.25 12.78 15.23 11.37 13.72 11.37C12.18 11.37 11.94 12.57 11.94 13.8V18.5H10V9.75Z" fill="currentColor" />
                  </svg>
                </a>
                <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3.75C7.44 3.75 3.75 7.52 3.75 12.17C3.75 15.89 6.11 19.05 9.38 20.16C9.79 20.24 9.94 19.98 9.94 19.76C9.94 19.55 9.93 18.98 9.93 18.26C7.75 18.74 7.29 17.18 7.29 17.18C6.94 16.27 6.44 16.03 6.44 16.03C5.75 15.53 6.5 15.54 6.5 15.54C7.27 15.6 7.67 16.35 7.67 16.35C8.34 17.54 9.43 17.19 9.86 16.98C9.93 16.48 10.12 16.15 10.33 15.96C8.59 15.75 6.76 15.06 6.76 11.95C6.76 11.06 7.07 10.34 7.57 9.77C7.49 9.56 7.21 8.7 7.65 7.53C7.65 7.53 8.34 7.31 9.93 8.42C10.59 8.23 11.3 8.13 12 8.12C12.7 8.13 13.41 8.23 14.07 8.42C15.66 7.31 16.35 7.53 16.35 7.53C16.79 8.7 16.51 9.56 16.43 9.77C16.93 10.34 17.24 11.06 17.24 11.95C17.24 15.07 15.4 15.75 13.66 15.96C13.93 16.2 14.17 16.67 14.17 17.38C14.17 18.39 14.16 19.48 14.16 19.76C14.16 19.98 14.31 20.25 14.73 20.16C17.99 19.05 20.25 15.89 20.25 12.17C20.25 7.52 16.56 3.75 12 3.75Z" fill="currentColor" />
                  </svg>
                </a>
              </nav>
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="lp-footer-theme-toggle" />
            </div>
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
