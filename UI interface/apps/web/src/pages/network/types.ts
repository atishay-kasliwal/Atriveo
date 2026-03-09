import type { Dispatch, SetStateAction } from "react";
import type { BadgeCategory } from "../../constants/badges";

export type PrefillForm = {
  company: string;
  role: string;
  date_saved: string;
  job_link: string;
  job_application_id: string;
  oa_deadline_date: string;
  location_raw: string;
  oa_status: string;
  referral_status: string;
  keyword_matching: string;
  notes: string;
};

export type SetPrefillForm = Dispatch<SetStateAction<PrefillForm>>;

export type BadgeCategoryList = BadgeCategory[];
