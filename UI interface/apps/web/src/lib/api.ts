const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";
const DASHBOARD_SESSION_KEY = "dashboard_auth_session";

import { getLocalISODate } from "./formatDate";

export type AuthUser = {
  id: number;
  email: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

let runtimeToken =
  typeof window !== "undefined"
    ? (() => {
        try {
          const raw = window.localStorage.getItem(DASHBOARD_SESSION_KEY);
          if (!raw) return "";
          const parsed = JSON.parse(raw) as AuthSession;
          return parsed?.token || "";
        } catch {
          return "";
        }
      })()
    : "";

async function request<T>(path: string, init?: RequestInit, options?: { skipAuth?: boolean }): Promise<T> {
  const authToken = runtimeToken || API_TOKEN;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(!options?.skipAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init?.headers || {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new Error(
        "Unauthorized. Please login again to continue."
      );
    }
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* use text as-is */
    }
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(DASHBOARD_SESSION_KEY);
    runtimeToken = "";
    return;
  }
  window.localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(session));
  runtimeToken = session.token;
}

export function clearStoredSession() {
  setStoredSession(null);
}

export function setRuntimeAuthToken(token: string) {
  runtimeToken = token;
}

export function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { skipAuth: true },
  );
}

export function getMe() {
  return request<{ user: AuthUser }>("/api/auth/me");
}

export function logout() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export type DashboardSummary = {
  kpis: {
    jobs: number;
    referrals: number;
    pending: number;
    rejected?: number;
    jobsThisMonth: number;
    jobsThisWeek: number;
    jobsToday: number;
    jobsWithReferral: number;
  };
  dailyTrend: Array<{ day: string; total: number }>;
  referralDailyTrend?: Array<{ day: string; total: number }>;
  rejectedDailyTrend?: Array<{ day: string; total: number }>;
  pendingDailyTrend?: Array<{ day: string; total: number }>;
  referralTrend: Array<{ referral_status: string; total: number }>;
  weeklyTrend: Array<{ week: string; total: number }>;
  responseStatusTrend: Array<{ response_status: string; total: number }>;
  oaStatusTrend: Array<{ oa_status: string; total: number }>;
  monthlyTrend: Array<{ month: string; total: number }>;
};

export function getDashboardSummary(days?: number) {
  const search = new URLSearchParams();
  if (days) search.set("days", String(days));
  // Anchor "today" to the user's local timezone so charts/KPIs use local days.
  search.set("anchorDay", getLocalISODate());
  const q = search.toString();
  return request<DashboardSummary>(`/api/dashboard/summary${q ? `?${q}` : ""}`);
}

export type GetJobsParams = {
  page?: number;
  limit?: number;
  company?: string;
  sort?: "date_saved" | "company" | "role" | "referral_status" | "job_link";
  order?: "asc" | "desc";
  status?: string; // 'active' | 'rejected' | 'all'
};

export function getJobs(params: GetJobsParams = {}) {
  const { page = 1, limit = 25, company, sort = "date_saved", order = "desc" } = params;
  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("limit", String(Math.min(limit, 100)));
  if (company?.trim()) search.set("company", company.trim());
  search.set("sort", sort);
  search.set("order", order);
  if ((params as any).status) search.set("status", String((params as any).status));
  return request<{ page: number; limit: number; data: Array<Record<string, unknown>> }>(
    `/api/jobs?${search.toString()}`,
    { cache: "no-store" }
  );
}

export type GetListParams = { page?: number; limit?: number };

export type GetReferralsParams = GetListParams & { filter?: "open" };

export function getReferrals(params: GetReferralsParams = {}) {
  const { page = 1, limit = 25, filter } = params;
  const search = new URLSearchParams({ page: String(page), limit: String(Math.min(limit, 100)) });
  if (filter === "open") search.set("filter", "open");
  return request<{ page: number; limit: number; data: Array<Record<string, unknown>> }>(
    `/api/referrals?${search.toString()}`
  );
}

export function getNotes(params: GetListParams & { archive?: boolean; show_on_dashboard?: boolean } = {}) {
  const { page = 1, limit = 25, archive, show_on_dashboard } = params as GetListParams & {
    archive?: boolean;
    show_on_dashboard?: boolean;
  };
  const search = new URLSearchParams({ page: String(page), limit: String(Math.min(limit, 100)) });
  if (archive) search.set("archive", "true");
  if (show_on_dashboard) search.set("show_on_dashboard", "true");
  return request<{ page: number; limit: number; data: Array<Record<string, unknown>> }>(
    `/api/notes?${search.toString()}`
  );
}

export function getPending(archive = false) {
  const q = archive ? "?archive=true" : "";
  return request<{ data: Array<Record<string, unknown>> }>(`/api/pending${q}`);
}

export function editPending(
  id: number | string,
  payload: {
    company?: string;
    position_name?: string;
    pending_date?: string;
    end_date?: string;
    comment?: string;
    link?: string;
    is_done?: boolean;
  }
) {
  return request<{ data: Record<string, unknown> }>(
    `/api/pending/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export function createPending(payload: {
  company: string;
  position_name?: string;
  pending_date?: string;
  end_date?: string;
  comment?: string;
  link?: string;
}) {
  return request<Record<string, unknown>>("/api/pending", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createJob(payload: Record<string, unknown>) {
  return request("/api/jobs", { method: "POST", body: JSON.stringify(payload) });
}

export function updateJob(id: number | string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/jobs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteJob(id: number | string) {
  return request<{ ok: boolean }>(`/api/jobs/${id}`, {
    method: "DELETE",
  });
}

export function createReferral(payload: Record<string, unknown>) {
  return request("/api/referrals", { method: "POST", body: JSON.stringify(payload) });
}

export function updateReferral(id: number | string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/referrals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteReferral(id: number | string) {
  return request<{ ok: boolean }>(`/api/referrals/${id}`, {
    method: "DELETE",
  });
}

export function createNote(payload: Record<string, unknown>) {
  return request("/api/notes", { method: "POST", body: JSON.stringify(payload) });
}

export function updateNote(id: number | string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteNote(id: number | string) {
  return request<{ ok: boolean }>(`/api/notes/${id}`, {
    method: "DELETE",
  });
}

export function markPendingDone(id: number | string) {
  return request<Record<string, unknown>>(`/api/pending/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_done: true }),
  });
}

export type JobsTrendData = Array<{ day: string; applied: number; rejected: number }>;

export function getJobsTrend(days?: number) {
  const search = new URLSearchParams();
  if (days) search.set("days", String(days));
  search.set("anchorDay", getLocalISODate());
  return request<{ data: JobsTrendData }>(`/api/jobs/trend?${search.toString()}`);
}

export type ReferralsTrendData = Array<{ day: string; requested: number; received: number }>;

export function getReferralsTrend(days?: number) {
  const search = new URLSearchParams();
  if (days) search.set("days", String(days));
  search.set("anchorDay", getLocalISODate());
  return request<{ data: ReferralsTrendData }>(`/api/referrals/trend?${search.toString()}`);
}
