import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { withDashboardBase } from "../lib/paths";

type PrivacyPolicyPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const LAST_UPDATED = "March 6, 2026";

export default function PrivacyPolicyPage({
  isAuthenticated,
  theme,
  onToggleTheme,
}: PrivacyPolicyPageProps) {
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
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

          <section className="legal-section">
            <h2>1. Scope</h2>
            <p>
              This Privacy Policy explains how Atriveo collects, uses, and protects data when you use
              atriveo.com, the Atriveo web app, and the Atriveo Job Assistant Chrome extension.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Data We Collect</h2>
            <ul>
              <li>Account data such as email, name, and authentication/session identifiers.</li>
              <li>
                Job tracking data you provide or edit, including company, role, job link, application ID,
                notes, referral context, and status fields.
              </li>
              <li>
                ATS page data extracted by the extension on supported sites (Workday, Greenhouse, Lever)
                to prefill your application workflow.
              </li>
              <li>
                Local extension storage data required for temporary caching, popup rendering, and session
                state.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Chrome Extension Permissions</h2>
            <p>The Atriveo Job Assistant extension uses these permissions for core functionality:</p>
            <ul>
              <li>
                <strong>activeTab</strong>: access the current ATS tab only when the user opens/runs the
                extension.
              </li>
              <li>
                <strong>scripting</strong>: run packaged extraction/session scripts in supported tabs.
              </li>
              <li>
                <strong>storage</strong>: store extracted data and extension session state locally.
              </li>
              <li>
                <strong>tabs</strong>: read active tab URL and focus/open Atriveo login tabs.
              </li>
              <li>
                <strong>Host permissions</strong>: limited to supported ATS hosts, Atriveo domains, and
                Atriveo API endpoints needed for login and submission.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. How We Use Data</h2>
            <ul>
              <li>Provide job tracking, referral tracking, and workflow features.</li>
              <li>Enable extension-assisted extraction and application creation.</li>
              <li>Maintain account security, session integrity, and product reliability.</li>
              <li>Operate analytics and diagnostics needed to improve core product quality.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Sharing and Selling</h2>
            <p>
              Atriveo does not sell your personal data. We may use service providers (for hosting,
              infrastructure, analytics, and authentication support) under contractual obligations to
              operate the service.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Data Retention</h2>
            <p>
              We retain data while your account is active and for a limited period afterward as necessary
              for legal, security, backup, and fraud-prevention obligations.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Security</h2>
            <p>
              We apply reasonable administrative, technical, and organizational safeguards to protect data.
              No method of storage or transmission is fully secure, so absolute security cannot be
              guaranteed.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Your Choices</h2>
            <ul>
              <li>You can edit or remove job entries in your workspace.</li>
              <li>You can uninstall the extension at any time from Chrome.</li>
              <li>You can request account/data support through the contact below.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>9. Contact</h2>
            <p>
              For privacy questions, contact{" "}
              <a href="mailto:katishay@gmail.com">katishay@gmail.com</a>.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
