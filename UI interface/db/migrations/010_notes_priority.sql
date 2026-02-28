ALTER TABLE daily_notes
  ADD COLUMN IF NOT EXISTS priority TEXT;

UPDATE daily_notes
SET priority = 'Medium'
WHERE priority IS NULL;

ALTER TABLE daily_notes
  ALTER COLUMN priority SET DEFAULT 'Medium';

ALTER TABLE daily_notes
  ALTER COLUMN priority SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_notes_priority_check'
  ) THEN
    ALTER TABLE daily_notes
      ADD CONSTRAINT daily_notes_priority_check
      CHECK (priority IN ('High', 'Medium', 'Low', 'Archive'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_daily_notes_priority
  ON daily_notes(user_id, is_done, priority, id DESC);
