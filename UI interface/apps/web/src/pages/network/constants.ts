import type { NetworkFieldVisibility } from "../../lib/api";

export const ENTERPRISE_CHART_COLORS = [
  "#2563EB",
  "#3B82F6",
  "#0EA5E9",
  "#14B8A6",
  "#64748B",
  "#7C8FB5",
  "#5C739B",
  "#4A678F",
  "#7A8FB4",
  "#6B7FA3",
];

export const MAX_NETWORK_BOARD_ENTRIES = 11; // You + up to 10 friends
export const MAX_NETWORK_TODAY_BARS = 5;

export const NETWORK_CHART_THEME = {
  grid: "var(--network-chart-grid, var(--chart-grid))",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  tooltipShadow: "var(--chart-tooltip-shadow)",
  axis: "var(--chart-axis)",
  textSecondary: "var(--chart-text-secondary)",
  textPrimary: "var(--chart-text)",
  accentSoft: "var(--accent-soft)",
  accentDim: "var(--accent-dim)",
  textMain: "var(--chart-text)",
};

export const WEEKLY_LINE_PALETTE = [
  ENTERPRISE_CHART_COLORS[0],
  ENTERPRISE_CHART_COLORS[1],
  ENTERPRISE_CHART_COLORS[2],
  ENTERPRISE_CHART_COLORS[3],
  ENTERPRISE_CHART_COLORS[4],
];

export const REQUIRED_VISIBILITY_KEYS: Array<keyof NetworkFieldVisibility> = [
  "share_company",
  "share_role",
  "share_applied_at",
  "share_job_application_id",
];

export const NETWORK_VISIBILITY_FIELDS: Array<{ key: keyof NetworkFieldVisibility; label: string }> = [
  { key: "share_company", label: "Company" },
  { key: "share_role", label: "Role" },
  { key: "share_applied_at", label: "Applied Date" },
  { key: "share_oa_status", label: "OA Status" },
  { key: "share_oa_deadline", label: "OA Deadline" },
  { key: "share_referral_used", label: "Referral Used" },
  { key: "share_notes", label: "Notes" },
  { key: "share_job_application_id", label: "Job/Application ID" },
];

export const OPTIONAL_SHARE_KEYS: Array<keyof NetworkFieldVisibility> = [
  "share_oa_status",
  "share_oa_deadline",
  "share_referral_used",
  "share_notes",
];
