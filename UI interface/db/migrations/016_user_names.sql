-- Add optional user profile names for friend/network display.
-- Keeps email as canonical login identifier.

ALTER TABLE dashboard_users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

CREATE INDEX IF NOT EXISTS idx_dashboard_users_first_last
  ON dashboard_users (LOWER(COALESCE(first_name, '')), LOWER(COALESCE(last_name, '')));

