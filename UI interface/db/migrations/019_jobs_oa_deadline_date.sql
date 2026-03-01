-- Optional OA deadline date supplied by user.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS oa_deadline_date DATE;
