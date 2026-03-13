-- Backfill company_directory from existing jobs.
-- Idempotent: safe to run multiple times.
WITH prepared AS (
  SELECT
    id,
    NULLIF(TRIM(company), '') AS company_name,
    NULLIF(TRIM(job_link), '') AS job_link,
    COALESCE(updated_at, created_at, NOW()) AS seen_at
  FROM jobs
  WHERE NULLIF(TRIM(company), '') IS NOT NULL
),
normalized AS (
  SELECT
    id,
    company_name,
    LOWER(
      TRIM(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(company_name, '[[:punct:]]+', ' ', 'g'),
            '[[:space:]]+(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)$',
            '',
            'i'
          ),
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    ) AS normalized_name,
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(job_link, '^[a-z][a-z0-9+.-]*://', '', 'i'),
              '/.*$',
              ''
            ),
            ':[0-9]+$',
            ''
          ),
          '^www\.',
          ''
        )
      ),
      ''
    ) AS domain_candidate,
    seen_at
  FROM prepared
),
display_choice AS (
  SELECT normalized_name, display_name
  FROM (
    SELECT
      normalized_name,
      company_name AS display_name,
      COUNT(*) AS use_count,
      ROW_NUMBER() OVER (
        PARTITION BY normalized_name
        ORDER BY COUNT(*) DESC, LENGTH(company_name), company_name
      ) AS rn
    FROM normalized
    WHERE normalized_name <> ''
    GROUP BY normalized_name, company_name
  ) ranked
  WHERE rn = 1
),
domain_choice AS (
  SELECT normalized_name, domain
  FROM (
    SELECT
      normalized_name,
      domain_candidate AS domain,
      COUNT(*) AS use_count,
      ROW_NUMBER() OVER (
        PARTITION BY normalized_name
        ORDER BY COUNT(*) DESC, domain_candidate
      ) AS rn
    FROM normalized
    WHERE normalized_name <> ''
      AND domain_candidate IS NOT NULL
      AND domain_candidate LIKE '%.%'
      AND domain_candidate !~ '[[:space:]]'
    GROUP BY normalized_name, domain_candidate
  ) ranked
  WHERE rn = 1
),
counts AS (
  SELECT
    normalized_name,
    COUNT(*)::int AS usage_count,
    MAX(seen_at) AS last_seen_at
  FROM normalized
  WHERE normalized_name <> ''
  GROUP BY normalized_name
)
INSERT INTO company_directory (
  normalized_name,
  display_name,
  domain,
  logo_available,
  logo_key,
  usage_count,
  last_seen_at,
  created_at,
  updated_at
)
SELECT
  c.normalized_name,
  d.display_name,
  dc.domain,
  FALSE,
  NULL,
  c.usage_count,
  c.last_seen_at,
  NOW(),
  NOW()
FROM counts c
JOIN display_choice d ON d.normalized_name = c.normalized_name
LEFT JOIN domain_choice dc ON dc.normalized_name = c.normalized_name
ON CONFLICT (normalized_name) DO UPDATE
SET
  display_name = COALESCE(NULLIF(TRIM(company_directory.display_name), ''), EXCLUDED.display_name),
  domain = COALESCE(NULLIF(TRIM(company_directory.domain), ''), EXCLUDED.domain),
  usage_count = GREATEST(company_directory.usage_count, EXCLUDED.usage_count),
  last_seen_at = GREATEST(company_directory.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = NOW();
