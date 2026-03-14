-- Add extended profile fields to dashboard_users for personalization and friend activity feed.

ALTER TABLE dashboard_users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS grad_year INTEGER,
  ADD COLUMN IF NOT EXISTS target_roles TEXT,
  ADD COLUMN IF NOT EXISTS target_companies TEXT,
  ADD COLUMN IF NOT EXISTS location_pref TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS share_applications INTEGER NOT NULL DEFAULT 1;
