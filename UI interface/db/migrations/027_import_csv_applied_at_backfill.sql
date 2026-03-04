-- Realign historical CSV-imported rows where applied_at drifted from date_saved.
-- Older CSV imports did not provide applied_at, so rows inherited import-time timestamps.
-- Use 12:00 UTC on date_saved as a stable fallback that keeps the same calendar day in common timezones.
UPDATE jobs
SET
  applied_at = (to_char(date_saved::date, 'YYYY-MM-DD') || 'T12:00:00Z')::timestamptz,
  updated_at = NOW()
WHERE source = 'import-csv'
  AND date_saved IS NOT NULL
  AND (
    applied_at IS NULL
    OR DATE(applied_at AT TIME ZONE 'UTC') <> date_saved::date
  );
