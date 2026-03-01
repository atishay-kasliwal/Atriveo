ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

-- Backfill historical rows with a stable default time: 12:07 AM on the applied date.
UPDATE jobs
SET applied_at = ((COALESCE(date_saved, created_at)::date)::timestamp + INTERVAL '7 minutes')
WHERE applied_at IS NULL;

ALTER TABLE jobs
  ALTER COLUMN applied_at SET DEFAULT NOW();

ALTER TABLE jobs
  ALTER COLUMN applied_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_applied_at ON jobs(applied_at DESC);
