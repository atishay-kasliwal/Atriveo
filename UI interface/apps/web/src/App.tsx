import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Layout from "./components/Layout";
import SiteShell from "./components/SiteShell";
import {
  clearStoredSession,
  getMe,
  getStoredSession,
  logout,
  setRuntimeAuthToken,
  setStoredSession,
  type AuthSession,
} from "./lib/api";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { DASHBOARD_BASE_PATH, withDashboardBase } from "./lib/paths";

type AppTheme = "light" | "dark";
const THEME_STORAGE_KEY = "atriveo_theme";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const PendingPage = lazy(() => import("./pages/PendingPage"));
const NotesPage = lazy(() => import("./pages/NotesPage"));
const NetworkPage = lazy(() => import("./pages/NetworkPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const HeaderTestPage = lazy(() => import("./pages/HeaderTestPage"));

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

function RouteLoader() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
    </div>
  );
}

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
                <Suspense fallback={<RouteLoader />}>
                  <LandingPage
                    isAuthenticated={Boolean(session)}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                  />
                </Suspense>
              )
            }
          />
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to={withDashboardBase("")} replace />
              ) : (
                <Suspense fallback={<RouteLoader />}>
                  <AuthPage
                    onAuthenticated={handleAuthenticated}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                  />
                </Suspense>
              )
            }
          />
          <Route
            path="/signup"
            element={
              session ? (
                <Navigate to={withDashboardBase("")} replace />
              ) : (
                <Suspense fallback={<RouteLoader />}>
                  <SignupPage
                    onAuthenticated={handleAuthenticated}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                  />
                </Suspense>
              )
            }
          />
          <Route
            path="/header-test"
            element={
              <Suspense fallback={<RouteLoader />}>
                <HeaderTestPage />
              </Suspense>
            }
          />
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
                <Navigate to="/login" replace />
              )
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<RouteLoader />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="jobs"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <JobsPage />
                </Suspense>
              }
            />
            <Route
              path="archive"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <JobsPage statusFilter="rejected" />
                </Suspense>
              }
            />
            <Route
              path="referrals"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <ReferralsPage />
                </Suspense>
              }
            />
            <Route
              path="pending"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <PendingPage />
                </Suspense>
              }
            />
            <Route
              path="notes"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <NotesPage />
                </Suspense>
              }
            />
            <Route
              path="network"
              element={
                <Suspense fallback={<RouteLoader />}>
                  <NetworkPage />
                </Suspense>
              }
            />
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
