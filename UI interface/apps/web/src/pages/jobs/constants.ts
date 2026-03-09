import type {
  SortField,
  ToolbarBooleanFilter,
  ToolbarStageFilter,
  ToolbarStatusFilter,
  ToolbarTimeRange,
} from "./types";

export const LIMIT = 25;
export const CARD_LIMIT = 10;
export const REFERRAL_OPTIONS = ["", "Requested", "Yes", "No"];

export const BASE_SORT_CONFIG: { key: SortField; label: string }[] = [
  { key: "applied_at", label: "Applied At" },
  { key: "company", label: "Company" },
  { key: "role", label: "Position" },
  { key: "referral_status", label: "Referral" },
  { key: "job_link", label: "Link" },
];

export const CHART_COLORS = {
  applied: "#2563eb",
  rejected: "#0ea5e9",
  grid: "var(--chart-grid)",
  tooltipBg: "var(--chart-tooltip-bg)",
  tooltipBorder: "var(--chart-tooltip-border)",
  axis: "var(--chart-axis)",
  text: "var(--chart-text)",
  textSecondary: "var(--chart-text-secondary)",
};

export const APPLICATION_PIPELINE_STAGES = ["Applied", "OA", "Interview", "Offer", "Archive"] as const;

export const TIME_OPTIONS: Array<{ value: ToolbarTimeRange; label: string }> = [
  { value: "0", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "21", label: "Last 21 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export const REFERRAL_OPTIONS_TOOLBAR: Array<{ value: ToolbarBooleanFilter; label: string }> = [
  { value: "yes", label: "With referral" },
  { value: "no", label: "Without referral" },
  { value: "all", label: "All" },
];

export const OA_OPTIONS_TOOLBAR: Array<{ value: ToolbarBooleanFilter; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "all", label: "All" },
];

export const STATUS_OPTIONS_TOOLBAR: Array<{ value: ToolbarStatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archive", label: "Archive" },
  { value: "all", label: "All" },
];

export const STAGE_OPTIONS_TOOLBAR: Array<{ value: ToolbarStageFilter; label: string }> = [
  { value: "All", label: "All" },
  ...APPLICATION_PIPELINE_STAGES.map((stage) => ({ value: stage, label: stage })),
];

export const TIME_CHIP_LABEL: Record<ToolbarTimeRange, string> = {
  "0": "Today",
  "7": "7d",
  "14": "14d",
  "21": "21d",
  "30": "30d",
  all: "All",
};

export const BOOLEAN_CHIP_LABEL: Record<ToolbarBooleanFilter, string> = {
  yes: "Yes",
  no: "No",
  all: "All",
};

export const STATUS_CHIP_LABEL: Record<ToolbarStatusFilter, string> = {
  active: "Active",
  archive: "Archive",
  all: "All",
};

export const TIME_FILTER_SEQUENCE: ToolbarTimeRange[] = ["7", "14", "21", "30", "all", "0"];
export const REFERRAL_FILTER_SEQUENCE: ToolbarBooleanFilter[] = ["yes", "no", "all"];
export const OA_FILTER_SEQUENCE: ToolbarBooleanFilter[] = ["yes", "no", "all"];
export const STATUS_FILTER_SEQUENCE: ToolbarStatusFilter[] = ["active", "archive", "all"];
export const STAGE_FILTER_SEQUENCE: ToolbarStageFilter[] = ["All", ...APPLICATION_PIPELINE_STAGES];
