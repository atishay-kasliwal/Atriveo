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

const ACTIVE_JOBS_SAMPLE_CARDS_BASE = [
  {
    company: "Google",
    role: "Software Engineer, Core",
    appliedOn: "2026-03-07",
    appliedDate: "Mar 7, 2026",
    appliedDateTime: "Mar 7, 2026 11:07 AM",
    owner: "Atishay Kasliwal",
    statusMessage: "Due in 2 days",
    referralUsed: true,
    oaStatus: "Yes",
    applicationStatus: "Active",
    referredBy: "Alex Johnson",
    jobId: "48293",
    keywordMatch: 78,
    progress: 1,
  },
  {
    company: "Amazon",
    role: "SDE I, Platform",
    appliedOn: "2026-03-06",
    appliedDate: "Mar 6, 2026",
    appliedDateTime: "Mar 6, 2026 09:34 AM",
    owner: "Atishay Kasliwal",
    statusMessage: "OA requested",
    referralUsed: true,
    oaStatus: "Yes",
    applicationStatus: "Active",
    referredBy: "Maya Patel",
    jobId: "51982",
    keywordMatch: 72,
    progress: 2,
  },
  {
    company: "Microsoft",
    role: "Software Engineer, AI Infra",
    appliedOn: "2026-03-05",
    appliedDate: "Mar 5, 2026",
    appliedDateTime: "Mar 5, 2026 02:18 PM",
    owner: "Atishay Kasliwal",
    statusMessage: "Interview soon",
    referralUsed: true,
    oaStatus: "Yes",
    applicationStatus: "Active",
    referredBy: "Chris Lee",
    jobId: "64012",
    keywordMatch: 84,
    progress: 2,
  },
  {
    company: "Stripe",
    role: "Backend Engineer",
    appliedOn: "2026-03-04",
    appliedDate: "Mar 4, 2026",
    appliedDateTime: "Mar 4, 2026 10:42 AM",
    owner: "Atishay Kasliwal",
    statusMessage: "Archived last week",
    referralUsed: false,
    oaStatus: "No",
    applicationStatus: "Archive",
    referredBy: "No referral",
    jobId: "70354",
    keywordMatch: 88,
    progress: 4,
  },
];

export const ACTIVE_JOBS_SAMPLE_CARDS = [
  ...ACTIVE_JOBS_SAMPLE_CARDS_BASE,
  ...ACTIVE_JOBS_SAMPLE_CARDS_BASE,
  ACTIVE_JOBS_SAMPLE_CARDS_BASE[0],
  ACTIVE_JOBS_SAMPLE_CARDS_BASE[1],
  ACTIVE_JOBS_SAMPLE_CARDS_BASE[2],
  ACTIVE_JOBS_SAMPLE_CARDS_BASE[3],
  ACTIVE_JOBS_SAMPLE_CARDS_BASE[0],
];

export const ACTIVE_JOBS_PREMIUM_KPIS = {
  monthly: {
    label: "This month applications",
    value: "68",
    delta: "+12%",
    status: "On track",
    sparkPath: "M0 68 L24 58 L48 62 L72 41 L96 49 L120 34 L144 56 L168 46 L192 60 L216 44 L240 38",
  },
  oa: {
    label: "OA completion rate",
    value: "82%",
    delta: "+4%",
    status: "Healthy pipeline",
    bars: [62, 44, 78, 53, 70, 82, 47],
  },
} as const;

export const ACTIVE_JOBS_REFERRAL_ACTIVITY = [
  { company: "Meta", referrals: 5 },
  { company: "Google", referrals: 3 },
  { company: "Microsoft", referrals: 2 },
  { company: "Amazon", referrals: 1 },
  { company: "Apple", referrals: 1 },
] as const;

export const ACTIVE_JOBS_WEEKLY_APPLICATION_COUNTS = [
  { week: "Week 1", count: 8 },
  { week: "Week 2", count: 12 },
  { week: "Week 3", count: 9 },
  { week: "Week 4", count: 6 },
  { week: "Week 5", count: 10 },
] as const;

export const ACTIVE_JOBS_CURRENT_WEEK_DAILY_COUNTS = [
  { day: "Mon", count: 1 },
  { day: "Tue", count: 2 },
  { day: "Wed", count: 3 },
  { day: "Thu", count: 0 },
  { day: "Fri", count: 1 },
  { day: "Sat", count: 1 },
  { day: "Sun", count: 2 },
] as const;

export const ACTIVE_JOBS_REFERRAL_ROWS: Array<{
  name: string;
  company: string;
  role: string;
}> = [
  { name: "Alex Shah", company: "Google", role: "SWE Core" },
  { name: "Maya Patel", company: "Amazon", role: "SDE I" },
  { name: "Chris Lee", company: "Microsoft", role: "AI Infra" },
  { name: "Rhea Singh", company: "Stripe", role: "Backend" },
  { name: "Jordan Kim", company: "Datadog", role: "Platform" },
  { name: "Priya Nair", company: "Meta", role: "Product Infra" },
  { name: "Ethan Park", company: "Apple", role: "ML Platform" },
  { name: "Sara Khan", company: "NVIDIA", role: "Systems" },
  { name: "Noah Chen", company: "Uber", role: "Marketplace" },
  { name: "Ava Thompson", company: "Airbnb", role: "Data" },
];
