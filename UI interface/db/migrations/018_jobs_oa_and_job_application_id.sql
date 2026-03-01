-- Add job/application id and enforce OA defaults for all existing + future rows.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_application_id TEXT;

-- Requirement: all previous rows should read as OA = No and Job/Application ID = '-'.
UPDATE jobs
SET
  oa_status = 'No',
  job_application_id = '-';

-- Enforce safe defaults going forward.
ALTER TABLE jobs
  ALTER COLUMN oa_status SET DEFAULT 'No';

ALTER TABLE jobs
  ALTER COLUMN oa_status SET NOT NULL;

ALTER TABLE jobs
  ALTER COLUMN job_application_id SET DEFAULT '-';

ALTER TABLE jobs
  ALTER COLUMN job_application_id SET NOT NULL;
