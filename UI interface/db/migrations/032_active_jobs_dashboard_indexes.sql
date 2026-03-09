-- Improve active dashboard query performance for user-scoped filters/sorts.

CREATE INDEX IF NOT EXISTS idx_jobs_user_applied_at_desc
  ON jobs (user_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_user_date_saved_desc
  ON jobs (user_id, date_saved DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_user_application_status
  ON jobs (user_id, application_status);

CREATE INDEX IF NOT EXISTS idx_jobs_user_referral_status
  ON jobs (user_id, referral_status);

CREATE INDEX IF NOT EXISTS idx_jobs_user_oa_status
  ON jobs (user_id, oa_status);

CREATE INDEX IF NOT EXISTS idx_referrals_user_request_date_desc
  ON referrals (user_id, request_date DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_user_company
  ON referrals (user_id, company);

CREATE INDEX IF NOT EXISTS idx_referrals_user_request_log
  ON referrals (user_id, request_log);

CREATE INDEX IF NOT EXISTS idx_referrals_user_referred_by_name
  ON referrals (user_id, referred_by_name);
