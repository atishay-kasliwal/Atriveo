ALTER TABLE daily_notes
  ADD COLUMN IF NOT EXISTS show_on_dashboard BOOLEAN;

UPDATE daily_notes
SET show_on_dashboard = TRUE
WHERE show_on_dashboard IS NULL;

ALTER TABLE daily_notes
  ALTER COLUMN show_on_dashboard SET DEFAULT TRUE;

ALTER TABLE daily_notes
  ALTER COLUMN show_on_dashboard SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_notes_dashboard
  ON daily_notes(user_id, is_done, show_on_dashboard, id DESC);
