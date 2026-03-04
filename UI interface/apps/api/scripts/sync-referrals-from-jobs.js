import { neon } from "@neondatabase/serverless";

function parseArgs(argv) {
  const args = { userId: null, email: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--user-id") {
      args.userId = Number(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (token === "--email") {
      args.email = String(argv[i + 1] || "").trim().toLowerCase();
      i += 1;
    }
  }
  return args;
}

async function resolveScopedUserId(sql, parsed) {
  if (Number.isFinite(parsed.userId) && parsed.userId > 0) return parsed.userId;
  if (!parsed.email) return null;
  const rows = await sql.query(
    `
    SELECT id
    FROM dashboard_users
    WHERE LOWER(TRIM(email)) = $1
    LIMIT 1
    `,
    [parsed.email],
  );
  if (!rows[0]?.id) {
    throw new Error(`No user found for email: ${parsed.email}`);
  }
  return Number(rows[0].id);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("Set DATABASE_URL (or NEON_DATABASE_URL).");
    process.exit(1);
  }

  const parsed = parseArgs(process.argv);
  const sql = neon(dbUrl);
  const scopedUserId = await resolveScopedUserId(sql, parsed);

  const [result] = await sql.query(
    `
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
      WHERE ($1::bigint IS NULL OR j.user_id = $1::bigint)
        AND j.user_id IS NOT NULL
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
    ),
    inserted AS (
      INSERT INTO referrals (
        user_id, source, company, request_log, request_date, updated_date, request_link, referral_received, keyword_matching, comment
      )
      SELECT
        m.user_id,
        'job-sync-script',
        m.company,
        m.request_log,
        m.request_date,
        COALESCE(m.request_date, CURRENT_DATE),
        m.request_link,
        m.referral_received,
        COALESCE(m.keyword_matching, 'Medium'),
        m.comment
      FROM job_with_match m
      WHERE m.referral_id IS NULL
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*)::int FROM candidate_jobs) AS candidates,
      (SELECT COUNT(*)::int FROM updated) AS updated,
      (SELECT COUNT(*)::int FROM inserted) AS inserted
    `,
    [scopedUserId],
  );

  console.log("Referral sync completed.");
  console.log(`scope: ${scopedUserId ? `user_id=${scopedUserId}` : "ALL users"}`);
  console.log(`candidates: ${Number(result?.candidates ?? 0)}`);
  console.log(`updated: ${Number(result?.updated ?? 0)}`);
  console.log(`inserted: ${Number(result?.inserted ?? 0)}`);
}

main().catch((error) => {
  console.error("Failed to sync referrals from jobs:", error);
  process.exit(1);
});
