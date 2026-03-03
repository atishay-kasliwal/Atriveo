import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { DASHBOARD_BASE_PATH } from "../lib/paths";

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

const FOOTER_COLUMNS = [
  {
    title: "Features",
    links: ["Copilot", "Job Tracker", "Resume Builder", "Resume Review", "Employers"],
  },
  {
    title: "Opportunities",
    links: [
      "Search All Jobs",
      "Internships",
      "Entry Level and New Grad",
      "Experienced Job Seeker",
      "Remote Work",
      "Curated Job Lists",
    ],
  },
  {
    title: "Company",
    links: ["Blog", "About", "Careers", "Support and FAQ", "Terms", "Privacy"],
  },
];

type LandingPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
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
}: LandingPageProps) {
  const [activeTab, setActiveTab] = useState(TAB_ITEMS[0].id);
  const [openFaq, setOpenFaq] = useState(0);

  const activeTabTitle = useMemo(
    () => TAB_ITEMS.find((item) => item.id === activeTab)?.title ?? TAB_ITEMS[0].title,
    [activeTab]
  );

  return (
    <div className="lp-shell">
      <header className="lp-navbar">
        <div className="lp-container lp-navbar-inner">
          <Link to="/" className="lp-logo" aria-label="Atriveo">
            Atriveo<span>.</span>
          </Link>
          <div className="lp-nav-right">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Link
              to={isAuthenticated ? DASHBOARD_BASE_PATH : "/login"}
              className="lp-dashboard-button"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-section lp-hero lp-reveal">
          <div className="lp-container lp-hero-inner">
            <h1>
              Your entire job search.
              <br />
              <span className="lp-highlight">Powered by one profile.</span>
            </h1>
            <p>
              Get personalized recommendations, manage applications, and run a consistent job
              search workflow from one focused workspace.
            </p>
            <div className="lp-hero-actions">
              <Link className="lp-btn lp-btn-primary" to="/signup">
                Join Now - It Is Free
              </Link>
            </div>
            <div className="lp-hero-proof">
              <span className="lp-stars" aria-hidden>
                *****
              </span>
              <span>Join 1,000,000+ job seekers</span>
            </div>
            <div className="lp-hero-preview">
              <ProductMockup />
            </div>
          </div>
        </section>

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
                <Link className="lp-btn lp-btn-primary" to="/signup">
                  Get Matched Now
                </Link>
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
              <Link className="lp-btn lp-btn-primary" to="/signup">
                Track Your Applications
              </Link>
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
                <Link className="lp-btn lp-btn-primary" to="/signup">
                  Add to Chrome
                </Link>
                <Link className="lp-btn lp-btn-outline" to="/signup">
                  Learn More
                </Link>
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
              <Link className="lp-btn lp-btn-primary" to="/signup">
                Get a Free Resume
              </Link>
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
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <section>
              <h3 className="lp-logo lp-logo--footer">Atriveo<span>.</span></h3>
              <div className="lp-social-row">
                <a href="#faq">IG</a>
                <a href="#faq">TT</a>
                <a href="#faq">IN</a>
                <a href="#faq">X</a>
              </div>
              <div className="lp-status-pill">
                <span aria-hidden />
                All systems operational
              </div>
            </section>
            {FOOTER_COLUMNS.map((column) => (
              <section key={column.title}>
                <h4>{column.title}</h4>
                {column.links.map((label) => (
                  <a key={label} href="#faq">
                    {label}
                  </a>
                ))}
              </section>
            ))}
          </div>
          <div className="lp-footer-bottom">
            <p>(c) 2026 Atriveo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
