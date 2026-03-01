-- Per-user application targets (daily/weekly/monthly).
-- Independent feature: no coupling to pending tasks.

CREATE TABLE IF NOT EXISTS user_targets (
  user_id BIGINT PRIMARY KEY REFERENCES dashboard_users(id) ON DELETE CASCADE,
  daily_target INTEGER,
  weekly_target INTEGER,
  monthly_target INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_targets_daily_non_negative CHECK (daily_target IS NULL OR daily_target >= 0),
  CONSTRAINT user_targets_weekly_non_negative CHECK (weekly_target IS NULL OR weekly_target >= 0),
  CONSTRAINT user_targets_monthly_non_negative CHECK (monthly_target IS NULL OR monthly_target >= 0)
);

DROP TRIGGER IF EXISTS user_targets_set_updated_at ON user_targets;
CREATE TRIGGER user_targets_set_updated_at
BEFORE UPDATE ON user_targets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
