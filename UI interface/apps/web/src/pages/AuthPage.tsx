import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setStoredSession, type AuthSession } from "../lib/api";
import { AuthHero } from "../components/AuthHero";
import { GoogleAuthButton } from "../components/GoogleAuthButton";
import { ThemeToggle } from "../components/ThemeToggle";
import { withDashboardBase } from "../lib/paths";
import { ANALYTICS_EVENTS, trackErrorEvent, trackProductEvent } from "../analytics/events";

type AuthPageProps = {
  onAuthenticated: (session: AuthSession) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export default function AuthPage({ onAuthenticated, theme, onToggleTheme }: AuthPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function completeLogin(
    response: { token: string; user: AuthSession["user"] },
    source: string,
    authProvider: "password" | "google",
  ) {
    const session: AuthSession = {
      token: response.token,
      user: response.user,
    };
    setStoredSession(session);
    onAuthenticated(session);
    trackProductEvent(ANALYTICS_EVENTS.login_completed, {
      source,
      auth_provider: authProvider,
    });
    navigate(withDashboardBase(""), { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "login_form",
        error_type: "missing_required_field",
      });
      setError("Email and password are required.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await login(email, password);
      completeLogin(response, "login_page_email", "password");
    } catch (err) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "login_form",
        error_type: "auth_submit_failed",
      });
      setError((err as Error).message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Link to="/" className="auth-top-logo" aria-label="Atriveo home">
        Atriveo<span>.</span>
      </Link>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="auth-theme-toggle" />
      <div className="auth-page auth-page--marketing">
        <AuthHero
          kicker="Welcome back"
          title="Sign in to Atriveo"
          subtitle="Continue your job search workflow with one focused workspace."
          description="Use your existing account on atriveo.com. Your data remains scoped to your login."
          footnote="Use your account credentials to access your dashboard."
        />

        <section className="auth-card-wrap" aria-label="Dashboard login">
          <div className="auth-card">
            <div className="auth-card-accent" aria-hidden />
            <div className="auth-card-icon" aria-hidden>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="auth-card-title">Log in</h1>
            <p className="auth-card-subtitle">Use the email and password from signup.</p>
            <form className="auth-form" onSubmit={onSubmit}>
              <label className="auth-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <label className="auth-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="auth-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              {error ? <div className="auth-error">{error}</div> : null}
              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="auth-submit-loading">
                    <span className="auth-spinner" aria-hidden /> Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
              <div className="auth-divider" role="separator" aria-label="or">
                <span>or</span>
              </div>
              <GoogleAuthButton
                mode="login"
                theme={theme}
                disabled={isLoading}
                onSuccess={(response) => completeLogin(response, "login_page_google", "google")}
                onError={(message) => {
                  trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
                    component_name: "login_form",
                    error_type: "google_auth_failed",
                  });
                  setError(message);
                }}
              />
            </form>
            <p className="auth-switch">
              New to Atriveo? <Link to="/signup">Create an account</Link>
              <span className="auth-switch-separator">|</span>
              <Link to="/">Back to landing</Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
