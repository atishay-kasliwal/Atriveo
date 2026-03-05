import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import SiteShell from "./components/SiteShell";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import ReferralsPage from "./pages/ReferralsPage";
import PendingPage from "./pages/PendingPage";
import NotesPage from "./pages/NotesPage";
import NetworkPage from "./pages/NetworkPage";
import LandingPage from "./pages/LandingPage";
import HeaderTestPage from "./pages/HeaderTestPage";
import {
  clearStoredSession,
  getMe,
  getStoredSession,
  logout,
  setRuntimeAuthToken,
  setStoredSession,
  type AuthSession,
} from "./lib/api";
import { initAnalytics, setSessionContext, trackPageView } from "./analytics/analytics";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "./lib/paths";

type AppTheme = "light" | "dark";
const THEME_STORAGE_KEY = "atriveo_theme";

function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const BASENAME = (() => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  if (baseUrl === "/") return "/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
})();

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    const existing = getStoredSession();
    if (!existing?.token) {
      setSession(null);
      setCheckingSession(false);
      return;
    }
    setRuntimeAuthToken(existing.token);
    getMe()
      .then(({ user }) => {
        const normalized: AuthSession = { token: existing.token, user };
        setStoredSession(normalized);
        setSession(normalized);
      })
      .catch(() => {
        clearStoredSession();
        setSession(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    setSessionContext({
      user_type: session ? "logged_in" : "guest",
      plan_type: "free",
    });
  }, [session]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Best-effort logout.
    } finally {
      clearStoredSession();
      setSession(null);
    }
  }

  function handleAuthenticated(nextSession: AuthSession) {
    setStoredSession(nextSession);
    setSession(nextSession);
  }

  function handleToggleTheme() {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  if (checkingSession) {
    return (
      <BrowserRouter basename={BASENAME}>
        <SiteShell>
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        </SiteShell>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={BASENAME}>
      <AnalyticsTracker />
      <SiteShell>
        <Routes>
          <Route
            path="/"
            element={
              session ? (
                <Navigate to={withDashboardBase("")} replace />
              ) : (
                <LandingPage
                  isAuthenticated={Boolean(session)}
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                  onAuthenticated={handleAuthenticated}
                />
              )
            }
          />
          <Route path="/header-test" element={<HeaderTestPage />} />
          <Route
            path={`${DASHBOARD_BASE_PATH}/*`}
            element={
              session ? (
                <Layout
                  userEmail={session.user.email}
                  onLogout={handleLogout}
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="archive" element={<JobsPage statusFilter="rejected" />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="pending" element={<PendingPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="network" element={<NetworkPage />} />
            <Route path="friends" element={<Navigate to="network" replace />} />
          </Route>
          <Route path="/app/*" element={<Navigate to={withDashboardBase("")} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SiteShell>
    </BrowserRouter>
  );
}

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const search = location.search || "";
    const hash = location.hash || "";
    trackPageView(`${location.pathname}${search}${hash}`);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
