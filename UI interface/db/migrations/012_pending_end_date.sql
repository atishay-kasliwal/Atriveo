ALTER TABLE pending_items
  ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE INDEX IF NOT EXISTS idx_pending_end_date
  ON pending_items(user_id, is_done, end_date DESC NULLS LAST, id DESC);
