import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { withDashboardBase } from "../lib/paths";

type ExtensionInstallPageProps = {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const EXTENSION_VERSION = "1.0.3";
const EXTENSION_DOWNLOAD_PATH = `/downloads/atriveo-job-assistant-v${EXTENSION_VERSION}.zip`;
const INSTALL_STEPS = [
  "Click Download Extension (.zip).",
  "Unzip it first so you have a normal folder.",
  "Open chrome://extensions and switch Developer mode ON.",
  "Click Load unpacked and pick the unzipped folder.",
  "Open the Extensions menu and pin Atriveo Job Assistant.",
];

const QUICK_TEST_STEPS = [
  "Open any Workday, Greenhouse, or Lever job page.",
  "Click the Atriveo extension icon.",
  "Confirm the fields are auto-filled.",
  "Edit anything you want, then click Add Application.",
  "Check your Atriveo dashboard for the new row.",
];

const VISUAL_GUIDE = [
  {
    title: "Turn On Developer Mode",
    caption: "On chrome://extensions, switch Developer mode ON at top-right.",
    src: "/install-guide/step-1-developer-mode-on.png",
  },
  {
    title: "Click Load Unpacked",
    caption: "Choose the unzipped Atriveo folder (not the .zip file).",
    src: "/install-guide/step-2-load-unpacked-picker.png",
  },
  {
    title: "Pin Atriveo",
    caption: "Open the puzzle icon menu and click Pin for Atriveo Job Assistant.",
    src: "/install-guide/step-3-pin-extension.png",
  },
  {
    title: "Open and Use",
    caption: "Click the pinned icon on a job page to open the popup and add the application.",
    src: "/install-guide/step-4-ready-to-use.png",
  },
];

export default function ExtensionInstallPage({
  isAuthenticated,
  theme,
  onToggleTheme,
}: ExtensionInstallPageProps) {
  const homeLink = isAuthenticated ? withDashboardBase("") : "/";

  return (
    <>
      <Link to={homeLink} className="auth-top-logo" aria-label="Atriveo home">
        Atriveo<span>.</span>
      </Link>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="auth-theme-toggle" />

      <main className="legal-page">
        <article className="legal-card extension-install-card">
          <section className="extension-install-hero">
            <div>
              <p className="legal-kicker">Chrome Extension</p>
              <h1>Add Atriveo Job Assistant</h1>
              <p className="legal-meta">
                Chrome Web Store review is in progress. You can install right now using the secure unpacked flow.
              </p>

              <div className="extension-install-status">
                <span className="extension-install-status-badge">Latest Build</span>
                <span>Manual install is available now. Current package: v{EXTENSION_VERSION}.</span>
              </div>

              <div className="extension-install-actions">
                <a className="lv-btn lv-btn-primary" href={EXTENSION_DOWNLOAD_PATH} download>
                  Download Extension (.zip)
                </a>
                <a className="lv-btn lv-btn-outline" href="chrome://extensions">
                  Open chrome://extensions
                </a>
              </div>
            </div>

            <aside className="extension-install-preview" aria-hidden="true">
              <div className="extension-install-preview-head">
                <strong>Atriveo Job Assistant</strong>
                <span className="extension-install-version">
                  <span className="extension-install-version-dot" />
                  v{EXTENSION_VERSION}
                </span>
              </div>
              <div className="extension-install-preview-list">
                <div>
                  <small>Supported ATS</small>
                  <strong>25+ ATS incl. Workday, Greenhouse, Lever, LinkedIn</strong>
                </div>
                <div>
                  <small>Flow</small>
                  <strong>Detect -&gt; Review -&gt; Add Application</strong>
                </div>
                <div>
                  <small>Data Sync</small>
                  <strong>Same Atriveo dashboard + tables</strong>
                </div>
              </div>
            </aside>
          </section>

          <section className="legal-section extension-install-visuals">
            <div className="extension-install-visuals-head">
              <h2>Visual Walkthrough</h2>
              <p>Match your screen to these 4 images, left to right.</p>
            </div>
            <div className="extension-install-visual-grid">
              {VISUAL_GUIDE.map((item, index) => (
                <figure key={item.src} className="extension-install-shot">
                  <div className="extension-install-shot-label">
                    <span>Step {index + 1}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <a
                    className="extension-install-shot-image-link"
                    href={item.src}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.title} screenshot`}
                  >
                    <img src={item.src} alt={`${item.title} screenshot`} loading="lazy" decoding="async" />
                  </a>
                  <figcaption>
                    <p>{item.caption}</p>
                    <a className="extension-install-shot-open-link" href={item.src} target="_blank" rel="noreferrer">
                      Open full image
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <div className="extension-install-grid">
            <section className="legal-section extension-install-panel">
              <h2>Install Steps</h2>
              <ol className="extension-install-list">
                {INSTALL_STEPS.map((step, index) => (
                  <li key={step}>
                    <span className="extension-install-step-number">{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="legal-section extension-install-panel">
              <h2>Quick Test</h2>
              <ol className="extension-install-list">
                {QUICK_TEST_STEPS.map((step, index) => (
                  <li key={step}>
                    <span className="extension-install-step-number">{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="legal-section extension-install-note">
            <h2>Note</h2>
            <p>
              This manual path is for early users before store approval. Once approved, this page will route
              directly to the Chrome Web Store listing.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
