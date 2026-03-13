-- Canonical company directory used for logo/domain enrichment and lookup.
-- Keep one row per normalized company name.
CREATE TABLE IF NOT EXISTS company_directory (
  id BIGSERIAL PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  domain TEXT,
  logo_available BOOLEAN NOT NULL DEFAULT FALSE,
  logo_key TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_directory_logo_key_required
    CHECK (logo_available = FALSE OR logo_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_company_directory_domain
  ON company_directory(domain)
  WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_directory_usage_count_desc
  ON company_directory(usage_count DESC, normalized_name);

CREATE INDEX IF NOT EXISTS idx_company_directory_last_seen_desc
  ON company_directory(last_seen_at DESC);

DROP TRIGGER IF EXISTS company_directory_set_updated_at ON company_directory;
CREATE TRIGGER company_directory_set_updated_at
BEFORE UPDATE ON company_directory
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
