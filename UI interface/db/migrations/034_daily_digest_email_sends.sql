CREATE TABLE IF NOT EXISTS daily_digest_email_sends (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  digest_type TEXT NOT NULL DEFAULT 'daily_network_digest',
  status TEXT NOT NULL DEFAULT 'sent',
  email_to TEXT,
  subject TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_digest_email_sends_status_check CHECK (status IN ('sent', 'skipped', 'failed')),
  CONSTRAINT daily_digest_email_sends_unique UNIQUE (user_id, digest_date, digest_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_digest_email_sends_date
  ON daily_digest_email_sends(digest_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_digest_email_sends_user_date
  ON daily_digest_email_sends(user_id, digest_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_digest_email_sends_status
  ON daily_digest_email_sends(status);
