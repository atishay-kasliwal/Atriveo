const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";
const DASHBOARD_SESSION_KEY = "dashboard_auth_session";

import { getLocalISODate } from "./formatDate";
import { ANALYTICS_EVENTS, trackErrorEvent } from "../analytics/events";

export type AuthUser = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type AuthResponse = {
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

function trackApiFailure(path: string, method: string, statusCode: number | null, errorType: string) {
  trackErrorEvent(ANALYTICS_EVENTS.api_request_failed, {
    component_name: "api_client",
    error_type: errorType,
    endpoint: path.split("?")[0] || path,
    http_method: method,
    status_code: statusCode ?? -1,
  });
}

async function request<T>(path: string, init?: RequestInit, options?: { skipAuth?: boolean }): Promise<T> {
  const authToken = runtimeToken || API_TOKEN;
  const method = String(init?.method || "GET").toUpperCase();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(!options?.skipAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init?.headers || {}),
  };
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (err) {
    trackApiFailure(path, method, null, "network_error");
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    trackApiFailure(path, method, res.status, res.status === 401 ? "unauthorized" : "http_error");
    if (res.status === 401) {
      throw new Error(
        "Unauthorized. Please login again to continue."
      );
    }
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: unknown; message?: unknown };
      const err = j?.error ?? j?.message;
      if (typeof err === "string") msg = err;
      else if (err !== undefined) msg = JSON.stringify(err);
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
  return request<AuthResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { skipAuth: true },
  );
}

export function signup(payload: { email: string; password: string; first_name?: string; last_name?: string }) {
  return request<AuthResponse>(
    "/auth/signup",
    { method: "POST", body: JSON.stringify(payload) },
    { skipAuth: true },
  );
}

export function googleAuth(idToken: string) {
  return request<AuthResponse>(
    "/auth/google",
    { method: "POST", body: JSON.stringify({ id_token: idToken }) },
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
  sort?: "date_saved" | "applied_at" | "company" | "role" | "referral_status" | "job_link";
  order?: "asc" | "desc";
  status?: string; // 'active' | 'rejected' | 'all'
};

export function getJobs(params: GetJobsParams = {}) {
  const { page = 1, limit = 25, company, sort = "applied_at", order = "desc" } = params;
  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("limit", String(Math.min(limit, 100)));
  if (company?.trim()) search.set("company", company.trim());
  search.set("sort", sort);
  search.set("order", order);
  if ((params as any).status) search.set("status", String((params as any).status));
  return request<{ page: number; limit: number; total: number; data: Array<Record<string, unknown>> }>(
    `/api/jobs?${search.toString()}`,
    { cache: "no-store" }
  );
}

export type JobsCsvExportRange = "30" | "60" | "90" | "all";

export function importJobsCsv(csv: string) {
  return request<{
    imported: number;
    skippedEmptyRows: number;
    skippedMissingRequired: number;
    skippedInvalidDate: number;
    defaultsApplied: number;
    rowsReceived: number;
    requiredHeaders: string[];
    optionalHeaders: string[];
    warnings: string[];
  }>("/api/jobs/import/csv", {
    method: "POST",
    body: JSON.stringify({ csv }),
  });
}

export async function exportJobsCsv(range: JobsCsvExportRange): Promise<Blob> {
  const authToken = runtimeToken || API_TOKEN;
  const headers: HeadersInit = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/jobs/export/csv?range=${encodeURIComponent(range)}`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    trackApiFailure("/api/jobs/export/csv", "GET", null, "network_error");
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    trackApiFailure("/api/jobs/export/csv", "GET", res.status, res.status === 401 ? "unauthorized" : "http_error");
    if (res.status === 401) throw new Error("Unauthorized. Please login again to continue.");
    let msg = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json?.error) msg = json.error;
    } catch {
      // Keep plain text.
    }
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.blob();
}

export type GetListParams = { page?: number; limit?: number };

export type GetReferralsParams = GetListParams & { filter?: "open" | "applied" };

export function getReferrals(params: GetReferralsParams = {}) {
  const { page = 1, limit = 25, filter } = params;
  const search = new URLSearchParams({ page: String(page), limit: String(Math.min(limit, 100)) });
  if (filter === "open" || filter === "applied") search.set("filter", filter);
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

export type ActiveOaRecord = {
  id: number;
  role: string | null;
  company: string | null;
  oa_deadline_date: string | null;
  oa_urgency: "overdue" | "today" | "upcoming" | "no_deadline";
  days_to_deadline: number | null;
  notes: string | null;
  date_saved: string | null;
  job_application_id: string | null;
};

export function getActiveOa() {
  const search = new URLSearchParams();
  search.set("anchorDay", getLocalISODate());
  return request<{ anchorDay: string | null; data: ActiveOaRecord[] }>(
    `/api/oa/active?${search.toString()}`
  );
}

export function completeOa(jobId: number | string, payload?: { oa_completed_date?: string }) {
  return request<{ already_completed: boolean; record: Record<string, unknown> }>(
    `/api/oa/complete/${jobId}`,
    { method: "POST", body: JSON.stringify(payload ?? {}) },
  );
}

export function getOaArchive() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/oa/archive");
}

export function updateOaArchive(id: number | string, payload: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/api/oa/archive/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteOaArchive(id: number | string) {
  return request<{ ok: boolean }>(`/api/oa/archive/${id}`, {
    method: "DELETE",
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

export type FriendRecord = {
  friendship_id: number | string;
  status: string;
  created_at: string;
  accepted_at?: string | null;
  friend_id: number | string;
  friend_email: string;
  friend_name?: string;
};

export type IncomingFriendRequest = {
  friendship_id: number | string;
  requester_id: number | string;
  requester_email: string;
  requester_name?: string;
  created_at: string;
};

export type OutgoingFriendRequest = {
  friendship_id: number | string;
  receiver_id: number | string;
  receiver_email: string;
  receiver_name?: string;
  created_at: string;
};

export function getFriends() {
  return request<{ data: FriendRecord[]; maxFriends: number }>("/api/friends");
}

export function getFriendRequests() {
  return request<{ incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>("/api/friends/requests");
}

export function sendFriendRequest(payload: { email?: string; receiver_id?: number | string }) {
  return request<{ ok: boolean; friendship: { id: number | string; status: string } }>("/api/friends/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function acceptFriendRequest(friendshipId: number | string) {
  return request<{ ok: boolean; friendship: Record<string, unknown>; maxFriends: number }>(
    `/api/friends/${friendshipId}/accept`,
    { method: "POST" },
  );
}

export function rejectFriendRequest(friendshipId: number | string) {
  return request<{ ok: boolean; friendship: Record<string, unknown> }>(
    `/api/friends/${friendshipId}/reject`,
    { method: "POST" },
  );
}

export function blockFriendship(friendshipId: number | string) {
  return request<{ ok: boolean; friendship: Record<string, unknown> }>(
    `/api/friends/${friendshipId}/block`,
    { method: "POST" },
  );
}

export type NetworkTrendPoint = { day: string; total: number };
export type NetworkTrendFriend = {
  friend_id: number;
  friend_email: string;
  friend_name?: string;
  is_self?: boolean;
  trend: NetworkTrendPoint[];
};

export function getNetworkTrend(days = 10) {
  const search = new URLSearchParams();
  search.set("days", String(days));
  search.set("anchorDay", getLocalISODate());
  return request<{ days: number; anchorDay: string | null; data: NetworkTrendFriend[] }>(
    `/api/network/trend?${search.toString()}`
  );
}

export type NetworkTodayJob = {
  id: number;
  company: string | null;
  role: string | null;
  date_saved: string | null;
  applied_at: string | null;
  application_status: string | null;
  referral_status: string | null;
  oa_status: string | null;
  job_application_id: string | null;
  oa_deadline_date: string | null;
  job_link: string | null;
  notes: string | null;
  can_view_company: boolean;
  can_view_role: boolean;
  can_view_applied_at: boolean;
  can_view_oa_status: boolean;
  can_view_oa_deadline: boolean;
  can_view_referral_used: boolean;
  can_view_notes: boolean;
};

export type NetworkTodayFriend = {
  friend_id: number;
  friend_email: string;
  friend_name?: string;
  jobs: NetworkTodayJob[];
};

export function getNetworkToday() {
  const search = new URLSearchParams();
  search.set("anchorDay", getLocalISODate());
  return request<{ anchorDay: string | null; data: NetworkTodayFriend[] }>(
    `/api/network/today?${search.toString()}`
  );
}

export type NetworkFieldVisibility = {
  share_company: boolean;
  share_role: boolean;
  share_applied_at: boolean;
  share_oa_status: boolean;
  share_oa_deadline: boolean;
  share_referral_used: boolean;
  share_notes: boolean;
};

export function getNetworkFieldVisibility() {
  return request<{ data: NetworkFieldVisibility; required_fields: Array<keyof NetworkFieldVisibility> }>(
    "/api/network/field-visibility",
  );
}

export function updateNetworkFieldVisibility(payload: Partial<NetworkFieldVisibility>) {
  return request<{ data: NetworkFieldVisibility; required_fields: Array<keyof NetworkFieldVisibility> }>(
    "/api/network/field-visibility",
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export type NetworkDeadlineRecord = {
  friend_id: number;
  friend_email: string;
  friend_name?: string;
  job_id: number;
  company: string | null;
  role: string | null;
  oa_deadline_date: string | null;
  deadline_state: "overdue" | "today";
  days_to_deadline: number | null;
  job_link: string | null;
  job_application_id: string | null;
};

export function getNetworkDeadlines() {
  const search = new URLSearchParams();
  search.set("anchorDay", getLocalISODate());
  return request<{ anchorDay: string | null; data: NetworkDeadlineRecord[] }>(
    `/api/network/deadlines?${search.toString()}`
  );
}

export type TargetProgress = {
  anchorDay: string | null;
  daily: { current: number; target: number | null };
  weekly: { current: number; target: number | null };
  monthly: { current: number; target: number | null };
};

export function getTargetProgress() {
  const search = new URLSearchParams();
  search.set("anchorDay", getLocalISODate());
  return request<TargetProgress>(`/api/targets/progress?${search.toString()}`);
}

export function updateTargets(payload: {
  daily_target?: number | null;
  weekly_target?: number | null;
  monthly_target?: number | null;
}) {
  return request<{ ok: boolean; daily_target: number | null; weekly_target: number | null; monthly_target: number | null }>(
    "/api/targets",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
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
