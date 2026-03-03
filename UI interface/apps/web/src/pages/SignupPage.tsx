import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, setStoredSession, type AuthSession } from "../lib/api";
import { AuthHero } from "../components/AuthHero";
import { ThemeToggle } from "../components/ThemeToggle";
import { withDashboardBase } from "../lib/paths";

type SignupPageProps = {
  onAuthenticated: (session: AuthSession) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export default function SignupPage({ onAuthenticated, theme, onToggleTheme }: SignupPageProps) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await signup({
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      const session: AuthSession = {
        token: response.token,
        user: response.user,
      };
      setStoredSession(session);
      onAuthenticated(session);
      navigate(withDashboardBase(""), { replace: true });
    } catch (err) {
      setError((err as Error).message || "Signup failed.");
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
          kicker="New on Atriveo"
          title="Create your Atriveo account"
          subtitle="Start your tracker in minutes with a clean private workspace."
          description="Existing user data remains unchanged. New accounts begin empty and isolated."
          footnote="Signup is currently enabled for launch and can be toggled by environment."
        />

        <section className="auth-card-wrap" aria-label="Dashboard signup">
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
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </div>
            <h1 className="auth-card-title">Create your Atriveo account</h1>
            <p className="auth-card-subtitle">
              No invite needed. Start your private workspace in under a minute.
            </p>
            <form className="auth-form" onSubmit={onSubmit}>
              <div className="auth-name-row">
                <div>
                  <label className="auth-label" htmlFor="firstName">
                    First name (optional)
                  </label>
                  <input
                    id="firstName"
                    className="auth-input"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                  />
                </div>
                <div>
                  <label className="auth-label" htmlFor="lastName">
                    Last name (optional)
                  </label>
                  <input
                    id="lastName"
                    className="auth-input"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rivera"
                  />
                </div>
              </div>

              <label className="auth-label" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <label className="auth-label" htmlFor="signup-password">
                Password (min 8 characters)
              </label>
              <input
                id="signup-password"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {error ? <div className="auth-error">{error}</div> : null}
              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="auth-submit-loading">
                    <span className="auth-spinner" aria-hidden /> Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
            <p className="auth-switch">
              Already have access? <Link to="/login">Log in</Link>
              <span className="auth-switch-separator">|</span>
              <Link to="/">Back to landing</Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
