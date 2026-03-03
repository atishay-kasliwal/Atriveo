export const DASHBOARD_BASE_PATH = "/dashboard";

export function withDashboardBase(path = ""): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  if (!clean) return DASHBOARD_BASE_PATH;
  return `${DASHBOARD_BASE_PATH}/${clean}`.replace(/\/+$/, "");
}
