CREATE TABLE IF NOT EXISTS user_field_visibility (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES dashboard_users(id) ON DELETE CASCADE,
  share_company BOOLEAN NOT NULL DEFAULT TRUE,
  share_role BOOLEAN NOT NULL DEFAULT TRUE,
  share_applied_at BOOLEAN NOT NULL DEFAULT TRUE,
  share_oa_status BOOLEAN NOT NULL DEFAULT TRUE,
  share_oa_deadline BOOLEAN NOT NULL DEFAULT TRUE,
  share_referral_used BOOLEAN NOT NULL DEFAULT TRUE,
  share_notes BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_field_visibility_user_id ON user_field_visibility(user_id);

INSERT INTO user_field_visibility (user_id)
SELECT u.id
FROM dashboard_users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_field_visibility v WHERE v.user_id = u.id
);

DROP TRIGGER IF EXISTS user_field_visibility_set_updated_at ON user_field_visibility;
CREATE TRIGGER user_field_visibility_set_updated_at
BEFORE UPDATE ON user_field_visibility
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
