import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { withDashboardBase } from "../lib/paths";

type TermsOfServicePageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const LAST_UPDATED = "March 6, 2026";

export default function TermsOfServicePage({
  isAuthenticated,
  theme,
  onToggleTheme,
}: TermsOfServicePageProps) {
  const homeLink = isAuthenticated ? withDashboardBase("") : "/";

  return (
    <>
      <Link to={homeLink} className="auth-top-logo" aria-label="Atriveo home">
        Atriveo<span>.</span>
      </Link>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="auth-theme-toggle" />

      <main className="legal-page">
        <article className="legal-card">
          <p className="legal-kicker">Legal</p>
          <h1>Terms of Service</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

          <section className="legal-section">
            <h2>1. Acceptance</h2>
            <p>
              By accessing or using Atriveo (including the web application and Atriveo Job Assistant
              extension), you agree to these Terms of Service.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Eligibility and Accounts</h2>
            <ul>
              <li>You are responsible for account credentials and account activity.</li>
              <li>You must provide accurate information and keep it current.</li>
              <li>You may not use another person&apos;s account without authorization.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Service Description</h2>
            <p>
              Atriveo helps users organize job applications, referrals, follow-ups, and related workflow
              data. The extension can detect supported ATS pages and prefill fields for faster entry.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. User Content and Responsibility</h2>
            <ul>
              <li>You retain responsibility for the data and notes you submit.</li>
              <li>You agree not to submit unlawful, infringing, or harmful content.</li>
              <li>You must comply with applicable laws and third-party platform terms.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Prohibited Conduct</h2>
            <ul>
              <li>No reverse engineering, abuse, scraping, or attempts to bypass security controls.</li>
              <li>No interference with service operation, other users, or infrastructure.</li>
              <li>No misuse of automation or extracted content for unauthorized purposes.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Third-Party Services</h2>
            <p>
              Atriveo may interact with third-party services and websites (such as ATS platforms). Atriveo
              is not responsible for third-party content, availability, or policies.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Suspension and Termination</h2>
            <p>
              We may suspend or terminate access if these Terms are violated or if required for security,
              legal, or operational reasons.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Disclaimer and Limitation</h2>
            <p>
              The service is provided &quot;as is&quot; without warranties of uninterrupted availability or
              fitness for a particular purpose. To the maximum extent permitted by law, Atriveo is not
              liable for indirect, incidental, or consequential damages.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use after updates constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Contact</h2>
            <p>
              For legal questions, contact <a href="mailto:katishay@gmail.com">katishay@gmail.com</a>.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
