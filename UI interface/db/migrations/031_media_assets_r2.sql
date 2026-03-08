-- Metadata table for images/files stored in object storage (R2).
-- Keep blobs out of Postgres; store only references and searchable metadata.
CREATE TABLE IF NOT EXISTS media_assets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  bucket_name TEXT NOT NULL DEFAULT 'MEDIA_BUCKET',
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256_hex CHAR(64) NOT NULL,
  source_url TEXT,
  kind TEXT NOT NULL DEFAULT 'general',
  related_job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
  related_note_id BIGINT REFERENCES daily_notes(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_user_created
  ON media_assets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_user_kind_created
  ON media_assets(user_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_related_job
  ON media_assets(related_job_id)
  WHERE related_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_related_note
  ON media_assets(related_note_id)
  WHERE related_note_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_user_sha_active
  ON media_assets(user_id, sha256_hex)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS media_assets_set_updated_at ON media_assets;
CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
