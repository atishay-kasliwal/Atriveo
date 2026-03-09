import { getLocalISODate } from "../../lib/formatDate";

function getLocalISODatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalISODate(d);
}

export const emptyJobForm = {
  role: "",
  company: "",
  location_raw: "United States",
  job_link: "",
  job_application_id: "",
  oa_deadline_date: "",
  keyword_matching: "Medium",
  oa_status: "No",
  referral_status: "No",
  referred_by_name: "",
  notes: "",
  date_saved: getLocalISODate(),
};

export const emptyPendingForm = {
  company: "",
  position_name: "",
  pending_date: getLocalISODate(),
  end_date: "",
  comment: "",
  link: "",
};

export const emptyNoteForm = {
  title: "",
  currentDate: getLocalISODate(),
  lastDate: getLocalISODatePlusDays(7),
  priority: "High",
  show_on_dashboard: "Yes",
  note: "",
};

export const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "India",
  "Germany",
  "Australia",
];

export const SLOW_APPLICATION_CREATE_THRESHOLD_MS = 1500;
