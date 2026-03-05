import { neon } from "@neondatabase/serverless";

function parseArgs(argv) {
  const args = { userId: null, email: null, json: false };
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
      continue;
    }
    if (token === "--json") {
      args.json = true;
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
  const params = [scopedUserId];

  const [missingCountRow] = await sql.query(
    `
    WITH candidate_jobs AS (
      SELECT
        j.id AS job_id,
        j.user_id,
        TRIM(j.company) AS company,
        TRIM(j.role) AS request_log,
        NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link
      FROM jobs j
      WHERE ($1::bigint IS NULL OR j.user_id = $1::bigint)
        AND TRIM(COALESCE(j.company, '')) <> ''
        AND TRIM(COALESCE(j.role, '')) <> ''
        AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
    )
    SELECT COUNT(*)::int AS count
    FROM candidate_jobs cj
    WHERE NOT EXISTS (
      SELECT 1
      FROM referrals r
      WHERE r.user_id = cj.user_id
        AND (
          (cj.request_link IS NOT NULL AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link)
          OR (
            LOWER(TRIM(r.company)) = LOWER(cj.company)
            AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
          )
        )
    )
    `,
    params,
  );

  const missingRows = await sql.query(
    `
    WITH candidate_jobs AS (
      SELECT
        j.id AS job_id,
        j.user_id,
        TRIM(j.company) AS company,
        TRIM(j.role) AS request_log,
        NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link,
        j.referral_status,
        COALESCE(j.applied_at, j.date_saved, j.created_at)::text AS event_at
      FROM jobs j
      WHERE ($1::bigint IS NULL OR j.user_id = $1::bigint)
        AND TRIM(COALESCE(j.company, '')) <> ''
        AND TRIM(COALESCE(j.role, '')) <> ''
        AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
    )
    SELECT
      cj.user_id,
      cj.job_id,
      cj.company,
      cj.request_log,
      cj.request_link,
      cj.referral_status,
      cj.event_at
    FROM candidate_jobs cj
    WHERE NOT EXISTS (
      SELECT 1
      FROM referrals r
      WHERE r.user_id = cj.user_id
        AND (
          (cj.request_link IS NOT NULL AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link)
          OR (
            LOWER(TRIM(r.company)) = LOWER(cj.company)
            AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
          )
        )
    )
    ORDER BY cj.user_id ASC, cj.job_id ASC
    LIMIT 25
    `,
    params,
  );

  const [duplicateMatchCountRow] = await sql.query(
    `
    WITH candidate_jobs AS (
      SELECT
        j.id AS job_id,
        j.user_id,
        TRIM(j.company) AS company,
        TRIM(j.role) AS request_log,
        NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link
      FROM jobs j
      WHERE ($1::bigint IS NULL OR j.user_id = $1::bigint)
        AND TRIM(COALESCE(j.company, '')) <> ''
        AND TRIM(COALESCE(j.role, '')) <> ''
        AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
    ),
    matches AS (
      SELECT
        cj.user_id,
        cj.job_id,
        COUNT(r.id)::int AS matched_referrals
      FROM candidate_jobs cj
      JOIN referrals r
        ON r.user_id = cj.user_id
       AND (
         (cj.request_link IS NOT NULL AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link)
         OR (
           LOWER(TRIM(r.company)) = LOWER(cj.company)
           AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
         )
       )
      GROUP BY cj.user_id, cj.job_id
    )
    SELECT COUNT(*)::int AS count
    FROM matches
    WHERE matched_referrals > 1
    `,
    params,
  );

  const duplicateRows = await sql.query(
    `
    WITH candidate_jobs AS (
      SELECT
        j.id AS job_id,
        j.user_id,
        TRIM(j.company) AS company,
        TRIM(j.role) AS request_log,
        NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link
      FROM jobs j
      WHERE ($1::bigint IS NULL OR j.user_id = $1::bigint)
        AND TRIM(COALESCE(j.company, '')) <> ''
        AND TRIM(COALESCE(j.role, '')) <> ''
        AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
    ),
    matches AS (
      SELECT
        cj.user_id,
        cj.job_id,
        cj.company,
        cj.request_log,
        cj.request_link,
        COUNT(r.id)::int AS matched_referrals,
        ARRAY_AGG(r.id ORDER BY r.id) AS referral_ids
      FROM candidate_jobs cj
      JOIN referrals r
        ON r.user_id = cj.user_id
       AND (
         (cj.request_link IS NOT NULL AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link)
         OR (
           LOWER(TRIM(r.company)) = LOWER(cj.company)
           AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
         )
       )
      GROUP BY cj.user_id, cj.job_id, cj.company, cj.request_log, cj.request_link
    )
    SELECT *
    FROM matches
    WHERE matched_referrals > 1
    ORDER BY user_id ASC, job_id ASC
    LIMIT 25
    `,
    params,
  );

  const result = {
    scope: scopedUserId ? { user_id: scopedUserId } : { user_id: "ALL" },
    missing_referral_rows: Number(missingCountRow?.count ?? 0),
    duplicate_job_matches: Number(duplicateMatchCountRow?.count ?? 0),
    samples: {
      missing: missingRows,
      duplicates: duplicateRows,
    },
  };

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Referral sync audit");
    console.log(`scope: ${scopedUserId ? `user_id=${scopedUserId}` : "ALL users"}`);
    console.log(`missing_referral_rows: ${result.missing_referral_rows}`);
    console.log(`duplicate_job_matches: ${result.duplicate_job_matches}`);
    if (result.samples.missing.length) {
      console.log("sample_missing_rows:");
      for (const row of result.samples.missing) {
        console.log(
          `  user=${row.user_id} job=${row.job_id} ${row.company} | ${row.request_log} | status=${row.referral_status}`,
        );
      }
    }
    if (result.samples.duplicates.length) {
      console.log("sample_duplicate_matches:");
      for (const row of result.samples.duplicates) {
        console.log(
          `  user=${row.user_id} job=${row.job_id} matches=${row.matched_referrals} referrals=${JSON.stringify(row.referral_ids)}`,
        );
      }
    }
  }

  const hasFailures = result.missing_referral_rows > 0 || result.duplicate_job_matches > 0;
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error("Failed to audit referral sync:", error);
  process.exit(1);
});
