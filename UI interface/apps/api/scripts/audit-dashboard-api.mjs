import { neon } from "@neondatabase/serverless";

const API_URL = process.env.API_URL || "http://127.0.0.1:8787";
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
const EMAIL = process.env.DASHBOARD_EMAIL || "";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const DAYS = Math.max(7, Math.min(60, Number(process.env.DASHBOARD_DAYS || 30)));
const ANCHOR_DAY = process.env.ANCHOR_DAY || new Date().toISOString().slice(0, 10);

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL (or NEON_DATABASE_URL).");
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error("Missing DASHBOARD_EMAIL or DASHBOARD_PASSWORD.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function byDayToMap(rows, dayKey = "day", valueKey = "total") {
  const m = new Map();
  for (const r of rows || []) m.set(String(r[dayKey]), Number(r[valueKey] ?? 0));
  return m;
}

function compareSeries(name, apiRows, expectedRows, dayKey = "day", valueKey = "total") {
  const mismatches = [];
  const a = byDayToMap(apiRows, dayKey, valueKey);
  const e = byDayToMap(expectedRows, dayKey, valueKey);
  const keys = Array.from(new Set([...a.keys(), ...e.keys()])).sort();
  for (const k of keys) {
    const av = a.get(k) ?? 0;
    const ev = e.get(k) ?? 0;
    if (av !== ev) mismatches.push({ key: k, api: av, expected: ev });
  }
  return { name, ok: mismatches.length === 0, mismatches };
}

function compareObjects(name, apiObj, expectedObj) {
  const keys = Array.from(new Set([...Object.keys(apiObj), ...Object.keys(expectedObj)])).sort();
  const mismatches = [];
  for (const k of keys) {
    const av = Number(apiObj[k] ?? 0);
    const ev = Number(expectedObj[k] ?? 0);
    if (av !== ev) mismatches.push({ key: k, api: av, expected: ev });
  }
  return { name, ok: mismatches.length === 0, mismatches };
}

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login failed (${res.status}): ${t}`);
  }
  const payload = await res.json();
  if (!payload?.token || !payload?.user?.id) throw new Error("Login response missing token/user");
  return payload;
}

async function fetchApi(token, path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API request failed ${path} (${res.status}): ${t}`);
  }
  return res.json();
}

async function expectedSummary(userId) {
  const [jobs] = await sql.query(
    "SELECT COUNT(*)::int AS c FROM jobs WHERE user_id = $1 AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'",
    [userId],
  );
  const [referrals] = await sql.query("SELECT COUNT(*)::int AS c FROM referrals WHERE user_id = $1", [userId]);
  const [pending] = await sql.query("SELECT COUNT(*)::int AS c FROM pending_items WHERE user_id = $1 AND is_done = FALSE", [userId]);
  const [rejected] = await sql.query(
    "SELECT COUNT(*)::int AS c FROM jobs WHERE user_id = $1 AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'",
    [userId],
  );
  const [jobsThisMonth] = await sql.query(
    `
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      AND date_saved >= DATE_TRUNC('month', $2::date)
      AND date_saved::date <= $2::date
    `,
    [userId, ANCHOR_DAY],
  );
  const [jobsThisWeek] = await sql.query(
    `
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      AND date_saved >= DATE_TRUNC('week', $2::date)
      AND date_saved::date <= $2::date
    `,
    [userId, ANCHOR_DAY],
  );
  const [jobsToday] = await sql.query(
    `
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      AND date_saved::date = $2::date
    `,
    [userId, ANCHOR_DAY],
  );
  const [jobsWithReferral] = await sql.query(
    `
    SELECT COUNT(*)::int AS c
    FROM jobs
    WHERE user_id = $1
      AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      AND TRIM(COALESCE(referral_status, '')) = 'Yes'
    `,
    [userId],
  );

  const dailyTrend = await sql.query(
    `
    SELECT d.day::text AS day, COALESCE(j.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      GROUP BY DATE(date_saved)
    ) j ON j.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS - 1],
  );

  const referralDailyTrend = await sql.query(
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS - 1],
  );

  const rejectedDailyTrend = await sql.query(
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS - 1],
  );

  const pendingDailyTrend = await sql.query(
    `
    SELECT d.day::text AS day, COALESCE(p.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(pending_date) AS day, COUNT(*)::int AS cnt
      FROM pending_items
      WHERE user_id = $1
        AND pending_date IS NOT NULL
        AND is_done = FALSE
      GROUP BY DATE(pending_date)
    ) p ON p.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS - 1],
  );

  const weeklyTrend = await sql.query(
    `
    WITH weeks AS (
      SELECT generate_series(DATE_TRUNC('week', $2::date)::date - INTERVAL '11 weeks', DATE_TRUNC('week', $2::date)::date, '1 week'::interval)::date AS week_start
    ),
    counts AS (
      SELECT DATE_TRUNC('week', date_saved)::date AS week_start, COUNT(*)::int AS total
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
        AND date_saved::date <= $2::date
      GROUP BY DATE_TRUNC('week', date_saved)
    )
    SELECT w.week_start::text AS week, COALESCE(c.total, 0)::int AS total
    FROM weeks w
    LEFT JOIN counts c ON c.week_start = w.week_start
    ORDER BY w.week_start ASC
    `,
    [userId, ANCHOR_DAY],
  );

  const monthlyTrend = await sql.query(
    `
    SELECT TO_CHAR(DATE_TRUNC('month', date_saved), 'YYYY-MM') AS month, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      AND date_saved >= ($2::date - INTERVAL '12 months')
      AND date_saved::date <= $2::date
    GROUP BY DATE_TRUNC('month', date_saved)
    ORDER BY month ASC
    LIMIT 12
    `,
    [userId, ANCHOR_DAY],
  );

  return {
    kpis: {
      jobs: Number(jobs?.c ?? 0),
      referrals: Number(referrals?.c ?? 0),
      pending: Number(pending?.c ?? 0),
      rejected: Number(rejected?.c ?? 0),
      jobsThisMonth: Number(jobsThisMonth?.c ?? 0),
      jobsThisWeek: Number(jobsThisWeek?.c ?? 0),
      jobsToday: Number(jobsToday?.c ?? 0),
      jobsWithReferral: Number(jobsWithReferral?.c ?? 0),
    },
    dailyTrend,
    referralDailyTrend,
    rejectedDailyTrend,
    pendingDailyTrend,
    weeklyTrend,
    monthlyTrend,
  };
}

async function expectedJobsTrend(userId) {
  return sql.query(
    `
    SELECT d.day::text AS day, COALESCE(applied.cnt, 0)::int AS applied, COALESCE(rejected.cnt, 0)::int AS rejected
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
      GROUP BY DATE(date_saved)
    ) applied ON applied.day = d.day
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) rejected ON rejected.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS - 1],
  );
}

async function expectedReferralsTrend(userId) {
  return sql.query(
    `
    SELECT d.day::text AS day, COALESCE(req.cnt, 0)::int AS requested, COALESCE(rec.cnt, 0)::int AS received
    FROM (
      SELECT generate_series(($2::date - ($3::text || ' days')::interval)::date, $2::date, '1 day'::interval)::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(request_date) AS day, COUNT(*)::int AS cnt
      FROM referrals
      WHERE user_id = $1
        AND request_date IS NOT NULL
        AND (TRIM(COALESCE(referral_received, '')) = 'Requested' OR TRIM(COALESCE(referral_received, '')) = '' OR referral_received IS NULL)
      GROUP BY DATE(request_date)
    ) req ON req.day = d.day
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND LOWER(TRIM(COALESCE(application_status, 'Applied'))) != 'rejected'
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) rec ON rec.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, ANCHOR_DAY, DAYS],
  );
}

function printResult(result) {
  if (result.ok) {
    console.log(`PASS ${result.name}`);
    return;
  }
  console.log(`FAIL ${result.name} (${result.mismatches.length} mismatches)`);
  console.table(result.mismatches.slice(0, 25));
}

async function main() {
  console.log(`Audit start: user=${EMAIL} days=${DAYS} anchorDay=${ANCHOR_DAY} api=${API_URL}`);
  const auth = await login();
  const userId = Number(auth.user.id);

  const summaryApi = await fetchApi(auth.token, `/api/dashboard/summary?days=${DAYS}&anchorDay=${encodeURIComponent(ANCHOR_DAY)}`);
  const jobsTrendApi = await fetchApi(auth.token, `/api/jobs/trend?days=${DAYS}&anchorDay=${encodeURIComponent(ANCHOR_DAY)}`);
  const referralsTrendApi = await fetchApi(auth.token, `/api/referrals/trend?days=${DAYS}&anchorDay=${encodeURIComponent(ANCHOR_DAY)}`);

  const summaryExpected = await expectedSummary(userId);
  const jobsTrendExpected = await expectedJobsTrend(userId);
  const referralsTrendExpected = await expectedReferralsTrend(userId);

  const checks = [
    compareObjects("kpis", summaryApi.kpis ?? {}, summaryExpected.kpis),
    compareSeries("dailyTrend", summaryApi.dailyTrend ?? [], summaryExpected.dailyTrend),
    compareSeries("referralDailyTrend", summaryApi.referralDailyTrend ?? [], summaryExpected.referralDailyTrend),
    compareSeries("rejectedDailyTrend", summaryApi.rejectedDailyTrend ?? [], summaryExpected.rejectedDailyTrend),
    compareSeries("pendingDailyTrend", summaryApi.pendingDailyTrend ?? [], summaryExpected.pendingDailyTrend),
    compareSeries("weeklyTrend", summaryApi.weeklyTrend ?? [], summaryExpected.weeklyTrend, "week", "total"),
    compareSeries("monthlyTrend", summaryApi.monthlyTrend ?? [], summaryExpected.monthlyTrend, "month", "total"),
    compareSeries("jobsTrend", jobsTrendApi.data ?? [], jobsTrendExpected, "day", "applied"),
    compareSeries("jobsTrendRejected", jobsTrendApi.data ?? [], jobsTrendExpected, "day", "rejected"),
    compareSeries("referralsTrendRequested", referralsTrendApi.data ?? [], referralsTrendExpected, "day", "requested"),
    compareSeries("referralsTrendReceived", referralsTrendApi.data ?? [], referralsTrendExpected, "day", "received"),
  ];

  let failCount = 0;
  for (const c of checks) {
    printResult(c);
    if (!c.ok) failCount += 1;
  }

  if (failCount > 0) {
    console.log(`\nAudit completed with ${failCount} failing checks.`);
    process.exit(2);
  }
  console.log("\nAudit completed with all checks passing.");
}

main().catch((err) => {
  console.error("Audit failed:", err.message || err);
  process.exit(1);
});
