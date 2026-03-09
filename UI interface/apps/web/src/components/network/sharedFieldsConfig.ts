import type { NetworkFieldVisibility } from "../../lib/api";

export const FIELD_META: Record<
  keyof NetworkFieldVisibility,
  { label: string; description: string }
> = {
  share_company: { label: "Company", description: "Company names are always shown for context" },
  share_role: { label: "Role", description: "Role titles are always shown for context" },
  share_applied_at: { label: "Applied Date", description: "Application date is always shown for trend consistency" },
  share_oa_status: { label: "OA Status", description: "See if friends passed the online assessment" },
  share_oa_deadline: { label: "OA Deadline", description: "Know upcoming deadlines friends are preparing for" },
  share_referral_used: { label: "Referral Used", description: "Understand where referrals are helping" },
  share_notes: { label: "Notes", description: "Share personal notes about the application" },
  share_job_application_id: { label: "Job/Application ID", description: "Let friends see your job or application IDs for reference" },
};

export const ALWAYS_SHARED_ORDER: Array<keyof NetworkFieldVisibility> = [
  "share_company",
  "share_role",
  "share_applied_at",
  "share_job_application_id",
];

export const OPTIONAL_ORDER: Array<keyof NetworkFieldVisibility> = [
  "share_oa_status",
  "share_oa_deadline",
  "share_referral_used",
  "share_notes",
];
