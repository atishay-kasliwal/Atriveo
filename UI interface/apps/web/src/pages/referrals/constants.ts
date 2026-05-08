import { getLocalISODate } from "../../lib/formatDate";

export const LIMIT = 25;
export const REFERRAL_SHEET_STATUSES = ["Requested"] as const;
export const JOB_STATUSES = ["Yes", "No"] as const;
export const ALL_STATUS_OPTIONS = [...REFERRAL_SHEET_STATUSES, ...JOB_STATUSES] as const;

export const CREATE_REFERRAL_INITIAL = {
  company: "",
  request_log: "",
  request_date: getLocalISODate(),
  request_link: "",
  referred_by_name: "",
  comment: "",
  keyword_matching: "Medium",
  source: "",
};

export const REFERRAL_SOURCE_OPTIONS = [
  "LinkedIn",
  "Email",
  "Network",
  "Conference",
  "Direct",
  "Manual",
] as const;

export const CHART_COLORS = {
  requestedLine: "#2563eb",
  receivedBar: "#0ea5e9",
  grid: "var(--chart-grid)",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  axis: "var(--chart-axis)",
  text: "var(--chart-text)",
  textSecondary: "var(--chart-text-secondary)",
};
