-- Social graph foundation: friend requests and relationships.
-- Additive migration only; existing product flows remain unchanged.

CREATE TABLE IF NOT EXISTS friendships (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  CONSTRAINT friendships_no_self_request CHECK (requester_id <> receiver_id),
  CONSTRAINT friendships_status_valid CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked'))
);

-- Ensure only one relationship row exists between any two users (direction-agnostic).
CREATE UNIQUE INDEX IF NOT EXISTS ux_friendships_user_pair
  ON friendships (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));

CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships (requester_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_receiver_status
  ON friendships (receiver_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_status
  ON friendships (status);

DROP TRIGGER IF EXISTS friendships_set_updated_at ON friendships;
CREATE TRIGGER friendships_set_updated_at
BEFORE UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
