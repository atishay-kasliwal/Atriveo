-- Archive table for completed online assessments.
CREATE TABLE IF NOT EXISTS online_assessment_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL,
  source TEXT DEFAULT 'oa-completed',
  role TEXT,
  company TEXT,
  location_raw TEXT,
  job_link TEXT,
  job_application_id TEXT,
  oa_deadline_date DATE,
  keyword_matching TEXT,
  oa_status TEXT,
  referral_status TEXT,
  response_status TEXT,
  application_status TEXT,
  notes TEXT,
  date_saved TIMESTAMP,
  applied_at TIMESTAMP,
  archive_date DATE,
  oa_completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  oa_completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_oa_records_job_id UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_oa_records_user_completed
  ON online_assessment_records (user_id, oa_completed_date DESC, id DESC);
