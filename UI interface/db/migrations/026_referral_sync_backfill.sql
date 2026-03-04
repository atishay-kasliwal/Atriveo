-- Backfill referrals from jobs for rows that indicate referral activity.
-- Idempotent: rerunning updates matched rows and inserts only truly missing rows.
WITH candidate_jobs AS (
  SELECT
    j.id AS job_id,
    j.user_id,
    TRIM(j.company) AS company,
    TRIM(j.role) AS request_log,
    COALESCE(j.date_saved::date, j.applied_at::date, CURRENT_DATE) AS request_date,
    NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link,
    CASE
      WHEN LOWER(TRIM(COALESCE(j.referral_status, ''))) = 'requested' THEN 'Requested'
      WHEN LOWER(TRIM(COALESCE(j.referral_status, ''))) = 'yes' THEN 'Yes'
      ELSE NULL
    END AS referral_received,
    COALESCE(NULLIF(TRIM(COALESCE(j.keyword_matching, '')), ''), 'Medium') AS keyword_matching,
    NULLIF(TRIM(COALESCE(j.notes, '')), '') AS comment
  FROM jobs j
  WHERE j.user_id IS NOT NULL
    AND TRIM(COALESCE(j.company, '')) <> ''
    AND TRIM(COALESCE(j.role, '')) <> ''
    AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
),
job_with_match AS (
  SELECT
    cj.*,
    COALESCE(
      (
        SELECT r.id
        FROM referrals r
        WHERE r.user_id = cj.user_id
          AND cj.request_link IS NOT NULL
          AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link
        ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
        LIMIT 1
      ),
      (
        SELECT r.id
        FROM referrals r
        WHERE r.user_id = cj.user_id
          AND LOWER(TRIM(r.company)) = LOWER(cj.company)
          AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
        ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
        LIMIT 1
      )
    ) AS referral_id
  FROM candidate_jobs cj
),
updated AS (
  UPDATE referrals r
  SET
    company = m.company,
    request_log = m.request_log,
    request_date = COALESCE(m.request_date, r.request_date),
    updated_date = COALESCE(m.request_date, CURRENT_DATE),
    request_link = COALESCE(m.request_link, r.request_link),
    referral_received = m.referral_received,
    keyword_matching = COALESCE(m.keyword_matching, r.keyword_matching, 'Medium'),
    comment = COALESCE(m.comment, r.comment),
    updated_at = NOW()
  FROM job_with_match m
  WHERE m.referral_id IS NOT NULL
    AND r.id = m.referral_id
  RETURNING r.id
)
INSERT INTO referrals (
  user_id,
  source,
  company,
  request_log,
  request_date,
  updated_date,
  request_link,
  referral_received,
  keyword_matching,
  comment
)
SELECT
  m.user_id,
  'job-sync-backfill',
  m.company,
  m.request_log,
  m.request_date,
  COALESCE(m.request_date, CURRENT_DATE),
  m.request_link,
  m.referral_received,
  COALESCE(m.keyword_matching, 'Medium'),
  m.comment
FROM job_with_match m
WHERE m.referral_id IS NULL;
