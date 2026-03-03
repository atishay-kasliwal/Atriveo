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
import AuthPage from "./pages/AuthPage";
import SignupPage from "./pages/SignupPage";
import LandingPage from "./pages/LandingPage";
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

const BASENAME = (() => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  if (baseUrl === "/") return "/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
})();

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [checkingSession, setCheckingSession] = useState(true);

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
            element={session ? <Navigate to={withDashboardBase("")} replace /> : <LandingPage isAuthenticated={Boolean(session)} />}
          />
          <Route
            path="/login"
            element={
              session ? <Navigate to={withDashboardBase("")} replace /> : <AuthPage onAuthenticated={handleAuthenticated} />
            }
          />
          <Route
            path="/signup"
            element={
              session ? <Navigate to={withDashboardBase("")} replace /> : <SignupPage onAuthenticated={handleAuthenticated} />
            }
          />
          <Route
            path={`${DASHBOARD_BASE_PATH}/*`}
            element={
              session ? (
                <Layout userEmail={session.user.email} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
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
