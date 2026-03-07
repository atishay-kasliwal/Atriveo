-- Backfill historical extension-v1 rows where date_saved was derived from UTC day.
-- This only updates records where:
-- 1) date_saved currently matches the UTC day of applied_at, and
-- 2) UTC day differs from America/New_York local day (the affected boundary window).
UPDATE jobs
SET
  date_saved = ((applied_at AT TIME ZONE 'America/New_York')::date)::timestamp,
  updated_at = NOW()
WHERE source = 'extension-v1'
  AND applied_at IS NOT NULL
  AND date_saved IS NOT NULL
  AND date_saved::date = (applied_at AT TIME ZONE 'UTC')::date
  AND (applied_at AT TIME ZONE 'UTC')::date <> (applied_at AT TIME ZONE 'America/New_York')::date;
