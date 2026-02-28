import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  authMiddleware,
  createSession,
  normalizeEmail,
  revokeSession,
  verifyPassword,
} from "./auth";
import { query } from "./db";
import type { AuthUser, Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: { authUser: AuthUser } }>();
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) => c.json({ name: "job-tracker-api", docs: "Use /api/* endpoints. GET /health for health check." }));
app.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV ?? "unknown" }));
app.patch("/health", (c) => c.json({ ok: true, method: "PATCH" }));

app.get("/auth-check", (c) => {
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return c.json({ authorizationHeaderPresent: Boolean(bearer) });
});

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

app.post("/auth/signup", async (c) => c.json({ error: "Signup is disabled for this dashboard." }, 403));

app.post("/auth/login", async (c) => {
  const parsed = loginInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const email = normalizeEmail(parsed.data.email);
  const [user] = await query<{
    id: number;
    email: string;
    password_hash: string | null;
    password_salt: string | null;
    password_iterations: number | null;
  }>(
    c.env,
    `
    SELECT id, email, password_hash, password_salt, password_iterations
    FROM dashboard_users
    WHERE email = $1
    LIMIT 1
    `,
    [email],
  );

  if (!user?.password_hash || !user?.password_salt) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const passwordOk = await verifyPassword(
    parsed.data.password,
    user.password_hash,
    user.password_salt,
    Number(user.password_iterations ?? 100000),
  );
  if (!passwordOk) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const token = await createSession(c.env, Number(user.id));
  return c.json({
    token,
    user: { id: Number(user.id), email: String(user.email) },
  });
});

app.use("/api/*", authMiddleware);

app.get("/api/auth/me", (c) => {
  return c.json({ user: c.get("authUser") });
});

app.post("/api/auth/logout", async (c) => {
  const rawBearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const bearer = rawBearer ? rawBearer.trim() : "";
  if (bearer) {
    await revokeSession(c.env, bearer);
  }
  return c.json({ ok: true });
});

app.get("/api/dashboard/summary", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const rawAnchor = c.req.query("anchorDay");
  const anchorDayValid = rawAnchor && /^\d{4}-\d{2}-\d{2}$/.test(rawAnchor);
  const anchorDay = anchorDayValid ? rawAnchor : null;
  const [jobCount] = await query<{ count: string }>(env, "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1", [userId]);
  const [referralCount] = await query<{ count: string }>(env, "SELECT COUNT(*)::text AS count FROM referrals WHERE user_id = $1", [userId]);
  const [pendingCount] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM pending_items WHERE user_id = $1 AND is_done = FALSE",
    [userId],
  );
  const [jobsThisMonth] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND date_saved >= DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))",
    [userId, anchorDay],
  );
  const [jobsThisWeek] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND date_saved >= DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))",
    [userId, anchorDay],
  );
  const [jobsToday] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND date_saved::date = COALESCE($2::date, CURRENT_DATE)",
    [userId, anchorDay],
  );
  const [jobsWithReferral] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND TRIM(COALESCE(referral_status, '')) = 'Yes'",
    [userId],
  );

  const [rejectedCount] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND application_status = 'Rejected'",
    [userId],
  );

  const dailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(j.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND COALESCE(application_status, 'Applied') != 'Rejected'
      GROUP BY DATE(date_saved)
    ) j ON j.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const referralDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND COALESCE(application_status, 'Applied') != 'Rejected'
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const rejectedDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND application_status = 'Rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const pendingDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(p.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
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
    [userId, anchorDay],
  );

  const referralTrendRaw = await query<{ referral_status: string; total: number }>(
    env,
    `
    SELECT
      CASE
        WHEN TRIM(COALESCE(referral_status, '')) IN ('Pending', 'Applied without referral') THEN 'No'
        ELSE TRIM(COALESCE(referral_status, ''))
      END AS referral_status,
      COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
      AND COALESCE(application_status, 'Applied') != 'Rejected'
    GROUP BY 1
    `,
    [userId],
  );
  const referralOrder = ["Yes", "No"];
  const referralTrend = referralOrder
    .map((status) => {
      const row = referralTrendRaw.find((r) => r.referral_status === status);
      return { referral_status: status, total: row ? row.total : 0 };
    })
    .concat(
      referralTrendRaw
        .filter((r) => !referralOrder.includes(r.referral_status) && r.referral_status !== "")
        .map((r) => ({ referral_status: r.referral_status, total: r.total })),
    );

  const weeklyTrend = await query<{ week: string; total: number }>(
    env,
    `
    WITH weeks AS (
      SELECT generate_series(
        DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))::date - INTERVAL '11 weeks',
        DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))::date,
        '1 week'::interval
      )::date AS week_start
    ),
    counts AS (
      SELECT DATE_TRUNC('week', date_saved)::date AS week_start, COUNT(*)::int AS total
      FROM jobs
      WHERE user_id = $1 AND date_saved IS NOT NULL
      GROUP BY DATE_TRUNC('week', date_saved)
    )
    SELECT w.week_start::text AS week, COALESCE(c.total, 0)::int AS total
    FROM weeks w
    LEFT JOIN counts c ON c.week_start = w.week_start
    ORDER BY w.week_start ASC
    `,
    [userId, anchorDay],
  );

  const responseStatusTrend = await query<{ response_status: string; total: number }>(
    env,
    `
    SELECT COALESCE(NULLIF(TRIM(response_status), ''), '—') AS response_status, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
    GROUP BY COALESCE(NULLIF(TRIM(response_status), ''), '—')
    ORDER BY total DESC
    LIMIT 8
    `,
    [userId],
  );

  const oaStatusTrend = await query<{ oa_status: string; total: number }>(
    env,
    `
    SELECT COALESCE(NULLIF(TRIM(oa_status), ''), '—') AS oa_status, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
    GROUP BY COALESCE(NULLIF(TRIM(oa_status), ''), '—')
    ORDER BY total DESC
    LIMIT 8
    `,
    [userId],
  );

  const monthlyTrend = await query<{ month: string; total: number }>(
    env,
    `
    SELECT TO_CHAR(DATE_TRUNC('month', date_saved), 'YYYY-MM') AS month, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1 AND date_saved IS NOT NULL AND date_saved >= (COALESCE($2::date, CURRENT_DATE) - INTERVAL '12 months')
    GROUP BY DATE_TRUNC('month', date_saved)
    ORDER BY month ASC
    LIMIT 12
    `,
    [userId, anchorDay],
  );

  return c.json({
    kpis: {
      jobs: Number(jobCount?.count ?? 0),
      referrals: Number(referralCount?.count ?? 0),
      pending: Number(pendingCount?.count ?? 0),
      rejected: Number(rejectedCount?.count ?? 0),
      jobsThisMonth: Number(jobsThisMonth?.count ?? 0),
      jobsThisWeek: Number(jobsThisWeek?.count ?? 0),
      jobsToday: Number(jobsToday?.count ?? 0),
      jobsWithReferral: Number(jobsWithReferral?.count ?? 0),
    },
    dailyTrend,
    referralDailyTrend,
    rejectedDailyTrend,
    pendingDailyTrend,
    referralTrend,
    weeklyTrend,
    responseStatusTrend,
    oaStatusTrend,
    monthlyTrend,
  });
});

app.get("/api/jobs/trend", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const rawAnchor = c.req.query("anchorDay");
  const anchorDayValid = rawAnchor && /^\d{4}-\d{2}-\d{2}$/.test(rawAnchor);
  const anchorDay = anchorDayValid ? rawAnchor : null;
  const anchorDateSql = anchorDay ? `$2::date` : `CURRENT_DATE`;
  const params = anchorDay ? [userId, anchorDay] : [userId];

  // Get daily applied and rejected counts for the last N days
  const trendData = await query<{ day: string; applied: number; rejected: number }>(
    env,
    `
    SELECT 
      d.day::text AS day,
      COALESCE(applied.cnt, 0)::int AS applied,
      COALESCE(rejected.cnt, 0)::int AS rejected
    FROM (
      SELECT generate_series(
        (${anchorDateSql} - (${days}::text || ' days')::interval)::date,
        ${anchorDateSql}::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1 
        AND date_saved IS NOT NULL
        AND (application_status IS NULL OR application_status != 'Rejected')
      GROUP BY DATE(date_saved)
    ) applied ON applied.day = d.day
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1 
        AND application_status = 'Rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) rejected ON rejected.day = d.day
    ORDER BY d.day ASC
    `,
    params,
  );

  return c.json({ data: trendData });
});

const JOBS_SORT_COLUMNS = ["date_saved", "company", "role", "referral_status", "job_link"] as const;
type JobsSortColumn = (typeof JOBS_SORT_COLUMNS)[number];
function isJobsSortColumn(s: string): s is JobsSortColumn {
  return (JOBS_SORT_COLUMNS as readonly string[]).includes(s);
}

const CSV_MAX_BYTES = 1024 * 1024;
const IMPORT_REQUIRED_HEADERS = ["role", "company", "date_saved"] as const;
const IMPORT_OPTIONAL_HEADERS = [
  "location_raw",
  "job_link",
  "keyword_matching",
  "oa_status",
  "referral_status",
  "response_status",
  "application_status",
  "notes",
] as const;
type CsvImportRow = {
  role: string;
  company: string;
  date_saved: string;
  location_raw: string;
  job_link: string | null;
  keyword_matching: "Strong" | "Medium" | "Weak";
  oa_status: string;
  referral_status: string;
  response_status: string;
  application_status: string;
  notes: string;
};

function parseCsvText(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (inQuotes) {
      if (ch === "\"") {
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((entry) => entry.length > 0)) rows.push(row);
  return rows;
}

function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

const KEYWORD_MATCHING_ALLOWED: Record<string, "Strong" | "Medium" | "Weak"> = {
  strong: "Strong",
  medium: "Medium",
  week: "Weak",
  weak: "Weak",
};

const OA_STATUS_ALLOWED: Record<string, string> = {
  yes: "Yes",
  no: "No",
  pending: "Pending",
  done: "Done",
};

const REFERRAL_STATUS_ALLOWED: Record<string, string> = {
  requested: "Requested",
  yes: "Yes",
  no: "No",
  pending: "No",
  "applied without referral": "No",
};

const RESPONSE_STATUS_ALLOWED: Record<string, string> = {
  review: "Review",
  screening: "Screening",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
  "no response": "No Response",
};

const APPLICATION_STATUS_ALLOWED: Record<string, string> = {
  applied: "Applied",
  review: "Review",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
};

function normalizeAllowed(value: string, allowed: Record<string, string>, fallback: string): string {
  const key = value.trim().toLowerCase();
  if (!key) return fallback;
  return allowed[key] ?? fallback;
}

function normalizeKeywordMatching(value: unknown): "Strong" | "Medium" | "Weak" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "strong") return "Strong";
  if (raw === "medium") return "Medium";
  if (raw === "week" || raw === "weak") return "Weak";
  return null;
}

function normalizeReferralStatus(value: unknown): "Requested" | "Yes" | "No" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "requested") return "Requested";
  if (raw === "yes") return "Yes";
  return "No";
}

app.get("/api/jobs", async (c) => {
  const userId = c.get("authUser").id;
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 25), 100);
  const company = c.req.query("company");
  const statusFilter = String(c.req.query("status") ?? ""); // expected: "active" | "rejected" | "all"(empty means active)
  const sortRaw = c.req.query("sort") ?? "date_saved";
  const orderRaw = String(c.req.query("order") ?? "desc").toLowerCase();
  const sort = isJobsSortColumn(sortRaw) ? sortRaw : "date_saved";
  const order: "ASC" | "DESC" = orderRaw === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const orderBy = `${sort} ${order} NULLS LAST, date_saved DESC NULLS LAST, company ASC NULLS LAST, id DESC`;
  const baseSql = `
    SELECT *
    FROM jobs
  `;

  // Build where clause dynamically to handle company and status filters
  const whereParts: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];
  let paramIdx = 2;
  if (company) {
    whereParts.push(`company ILIKE $${paramIdx}`);
    params.push(`%${company}%`);
    paramIdx += 1;
  }
  // statusFilter semantics: 'rejected' => only Rejected, 'active' or empty => exclude Rejected, 'all' => no filter
  if (!statusFilter || statusFilter === "active") {
    whereParts.push(`COALESCE(application_status, 'Applied') != 'Rejected'`);
  } else if (statusFilter === "rejected") {
    whereParts.push(`application_status = 'Rejected'`);
  }

  const whereClause = ` WHERE ${whereParts.join(" AND ")}`;
  // add limit/offset params
  params.push(limit, offset);
  const orderLimitOffset = ` ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const rows = await query(c.env, `${baseSql}${whereClause}${orderLimitOffset}`, params as unknown[]);
  return c.json({ page, limit, data: rows });
});

const jobInput = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  location_raw: z.string().optional(),
  job_link: z.string().url().optional(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional(),
  oa_status: z.string().optional(),
  referral_status: z.string().optional(),
  response_status: z.string().optional(),
  application_status: z.string().optional(),
  notes: z.string().optional(),
  date_saved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

app.post("/api/jobs", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = jobInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `
    INSERT INTO jobs (user_id, source, role, company, location_raw, job_link, keyword_matching, oa_status, referral_status, response_status, application_status, notes, date_saved)
    VALUES ($1, 'manual', $2, $3, $4, $5, COALESCE($6, 'Medium'), $7, $8, $9, COALESCE($10, 'Applied'), $11, (COALESCE($12::date, CURRENT_DATE))::timestamp)
    RETURNING *
    `,
    [
      userId,
      p.role,
      p.company,
      p.location_raw ?? null,
      p.job_link ?? null,
      normalizeKeywordMatching(p.keyword_matching),
      p.oa_status ?? null,
      normalizeReferralStatus(p.referral_status),
      p.response_status ?? null,
      p.application_status ?? null,
      p.notes ?? null,
      p.date_saved ?? null,
    ],
  );
  return c.json(row, 201);
});

const jobsCsvImportInput = z.object({
  csv: z.string().min(1),
});

app.post("/api/jobs/import/csv", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = jobsCsvImportInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const csv = parsed.data.csv;
  const csvBytes = new TextEncoder().encode(csv).length;
  if (csvBytes > CSV_MAX_BYTES) {
    return c.json({ error: "CSV file is too large. Maximum allowed size is 1 MB." }, 413);
  }

  const rows = parseCsvText(csv);
  if (rows.length < 2) {
    return c.json({ error: "CSV must include a header row and at least one data row." }, 400);
  }

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const headerMap = new Map<string, number>();
  headerRow.forEach((name, idx) => {
    if (!headerMap.has(name)) headerMap.set(name, idx);
  });

  const missingHeaders = IMPORT_REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
  if (missingHeaders.length > 0) {
    return c.json({ error: `Missing required header(s): ${missingHeaders.join(", ")}` }, 400);
  }

  const imports: CsvImportRow[] = [];
  let skippedEmptyRows = 0;
  let skippedMissingRequired = 0;
  let skippedInvalidDate = 0;
  let defaultsApplied = 0;
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const csvRow = rows[i];
    const rowNumber = i + 1;
    const getCell = (field: string): string => {
      const idx = headerMap.get(field);
      if (idx == null) return "";
      return (csvRow[idx] ?? "").trim();
    };

    const role = getCell("role");
    const company = getCell("company");
    const dateSaved = getCell("date_saved");
    if (!role && !company && !dateSaved) {
      skippedEmptyRows += 1;
      continue;
    }
    if (!role || !company || !dateSaved) {
      skippedMissingRequired += 1;
      if (warnings.length < 12) {
        warnings.push(`Row ${rowNumber} skipped: role, company and date_saved are mandatory.`);
      }
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSaved)) {
      skippedInvalidDate += 1;
      if (warnings.length < 12) {
        warnings.push(`Row ${rowNumber} skipped: date_saved must be YYYY-MM-DD.`);
      }
      continue;
    }

    const jobLink = getCell("job_link");
    let normalizedJobLink: string | null = null;
    if (jobLink) {
      try {
        new URL(jobLink);
        normalizedJobLink = jobLink;
      } catch {
        defaultsApplied += 1;
        if (warnings.length < 12) warnings.push(`Row ${rowNumber}: invalid job_link replaced with default (empty).`);
      }
    }

    const keywordMatchingRaw = getCell("keyword_matching");
    const keywordMatching = normalizeAllowed(
      keywordMatchingRaw,
      KEYWORD_MATCHING_ALLOWED,
      "Medium",
    ) as "Strong" | "Medium" | "Weak";
    if (keywordMatchingRaw && keywordMatchingRaw.trim().toLowerCase() !== keywordMatching.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: keyword_matching normalized to ${keywordMatching}.`);
    }
    const oaStatusRaw = getCell("oa_status");
    const oaStatus = normalizeAllowed(oaStatusRaw, OA_STATUS_ALLOWED, "No");
    if (oaStatusRaw && oaStatusRaw.trim().toLowerCase() !== oaStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: oa_status normalized to ${oaStatus}.`);
    }
    const referralRaw = getCell("referral_status");
    const referralStatus = normalizeAllowed(referralRaw, REFERRAL_STATUS_ALLOWED, "No");
    if (referralRaw && referralRaw.trim().toLowerCase() !== referralStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: referral_status normalized to ${referralStatus}.`);
    }
    const responseRaw = getCell("response_status");
    const responseStatus = normalizeAllowed(responseRaw, RESPONSE_STATUS_ALLOWED, "Review");
    if (responseRaw && responseRaw.trim().toLowerCase() !== responseStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: response_status normalized to ${responseStatus}.`);
    }
    const applicationRaw = getCell("application_status");
    const applicationStatus = normalizeAllowed(applicationRaw, APPLICATION_STATUS_ALLOWED, "Applied");
    if (applicationRaw && applicationRaw.trim().toLowerCase() !== applicationStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: application_status normalized to ${applicationStatus}.`);
    }

    const locationRaw = getCell("location_raw") || "Not specified";
    const notes = getCell("notes") || "Imported via CSV";
    if (!getCell("location_raw")) defaultsApplied += 1;
    if (!getCell("notes")) defaultsApplied += 1;

    imports.push({
      role,
      company,
      date_saved: dateSaved,
      location_raw: locationRaw,
      job_link: normalizedJobLink,
      keyword_matching: keywordMatching,
      oa_status: oaStatus,
      referral_status: referralStatus,
      response_status: responseStatus,
      application_status: applicationStatus,
      notes,
    });
  }

  if (imports.length === 0) {
    return c.json({ error: "No valid CSV rows found. Ensure role, company and date_saved are present." }, 400);
  }

  for (const row of imports) {
    await query(
      c.env,
      `
      INSERT INTO jobs (user_id, source, role, company, location_raw, job_link, keyword_matching, oa_status, referral_status, response_status, application_status, notes, date_saved)
      VALUES ($1, 'import-csv', $2, $3, $4, $5, COALESCE($6, 'Medium'), $7, $8, $9, COALESCE($10, 'Applied'), $11, ($12::date)::timestamp)
      `,
      [
        userId,
        row.role,
        row.company,
        row.location_raw,
        row.job_link,
        row.keyword_matching,
        row.oa_status,
        row.referral_status,
        row.response_status,
        row.application_status,
        row.notes,
        row.date_saved,
      ],
    );
  }

  return c.json({
    imported: imports.length,
    skippedEmptyRows,
    skippedMissingRequired,
    skippedInvalidDate,
    defaultsApplied,
    rowsReceived: rows.length - 1,
    requiredHeaders: IMPORT_REQUIRED_HEADERS,
    optionalHeaders: IMPORT_OPTIONAL_HEADERS,
    warnings,
  });
});

app.get("/api/jobs/export/csv", async (c) => {
  const userId = c.get("authUser").id;
  const range = String(c.req.query("range") ?? "30").toLowerCase();
  const validRange = range === "30" || range === "60" || range === "90" || range === "all" ? range : "30";
  const params: unknown[] = [userId];
  let whereDate = "";
  if (validRange !== "all") {
    whereDate = " AND date_saved >= (CURRENT_DATE - ($2::text || ' days')::interval)";
    params.push(Number(validRange));
  }

  const rows = await query<Record<string, unknown>>(
    c.env,
    `
    SELECT
      TO_CHAR(COALESCE(date_saved, NOW())::date, 'YYYY-MM-DD') AS date_saved,
      role,
      company,
      location_raw,
      job_link,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes
    FROM jobs
    WHERE user_id = $1${whereDate}
    ORDER BY date_saved DESC NULLS LAST, id DESC
    `,
    params,
  );

  const headers = [
    "date_saved",
    "role",
    "company",
    "location_raw",
    "job_link",
    "keyword_matching",
    "oa_status",
    "referral_status",
    "response_status",
    "application_status",
    "notes",
  ];
  const csvLines = [headers.join(",")];
  rows.forEach((row) => {
    csvLines.push(
      headers
        .map((key) => {
          if (key === "keyword_matching") {
            const raw = String(row[key] ?? "");
            if (raw.trim().toLowerCase() === "week") return csvEscape("Weak");
          }
          return csvEscape(row[key]);
        })
        .join(","),
    );
  });
  const csv = csvLines.join("\n");
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="jobs_${validRange}_${today}.csv"`,
      "cache-control": "no-store",
    },
  });
});

const jobUpdateInput = z.object({
  role: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  location_raw: z.string().optional(),
  job_link: z.string().url().optional().nullable(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional().nullable(),
  oa_status: z.string().optional().nullable(),
  referral_status: z.string().optional().nullable(),
  response_status: z.string().optional().nullable(),
  application_status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date_saved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

app.patch("/api/jobs/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = jobUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `
    UPDATE jobs SET
      role = COALESCE($1, role),
      company = COALESCE($2, company),
      location_raw = COALESCE($3, location_raw),
      job_link = COALESCE($4, job_link),
      keyword_matching = COALESCE($5, keyword_matching),
      oa_status = COALESCE($6, oa_status),
      referral_status = COALESCE($7, referral_status),
      response_status = COALESCE($8, response_status),
      application_status = COALESCE($9, application_status),
      notes = COALESCE($10, notes),
      date_saved = COALESCE($11::date, date_saved),
      archive_date = CASE
        WHEN $9 = 'Rejected' THEN COALESCE(archive_date, CURRENT_DATE)
        ELSE archive_date
      END,
      updated_at = NOW()
    WHERE id = $12 AND user_id = $13
    RETURNING *
    `,
    [
      p.role ?? null,
      p.company ?? null,
      p.location_raw ?? null,
      p.job_link ?? null,
      normalizeKeywordMatching(p.keyword_matching),
      p.oa_status ?? null,
      normalizeReferralStatus(p.referral_status),
      p.response_status ?? null,
      p.application_status ?? null,
      p.notes ?? null,
      p.date_saved ?? null,
      id,
      userId,
    ],
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/api/jobs/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

const referralInput = z.object({
  company: z.string().min(1),
  request_log: z.string().optional(),
  request_date: z.string().optional(),
  request_link: z.string().url().optional(),
  referral_received: z.string().optional(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional(),
  referred_by_name: z.string().optional(),
  comment: z.string().optional(),
});

app.get("/api/referrals", async (c) => {
  const userId = c.get("authUser").id;
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 25), 100);
  const offset = (page - 1) * limit;
  const filter = c.req.query("filter");
  const sql = filter === "open"
    ? "SELECT * FROM referrals WHERE user_id = $1 AND COALESCE(TRIM(referral_received), '') = 'Requested' ORDER BY request_date DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3"
    : filter === "applied"
      ? "SELECT * FROM referrals WHERE user_id = $1 AND COALESCE(TRIM(referral_received), '') = 'Yes' ORDER BY COALESCE(updated_date, request_date) DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3"
      : "SELECT * FROM referrals WHERE user_id = $1 ORDER BY request_date DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3";
  const rows = await query(c.env, sql, [userId, limit, offset]);
  return c.json({ page, limit, data: rows });
});

app.post("/api/referrals", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = referralInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `
    INSERT INTO referrals (user_id, source, company, request_log, request_date, updated_date, request_link, referral_received, keyword_matching, referred_by_name, comment)
    VALUES ($1, 'manual', $2, $3, $4::date, COALESCE($4::date, CURRENT_DATE), $5, $6, COALESCE($7, 'Medium'), $8, $9)
    RETURNING *
    `,
    [
      userId,
      p.company,
      p.request_log ?? null,
      p.request_date ?? null,
      p.request_link ?? null,
      normalizeReferralStatus(p.referral_received),
      normalizeKeywordMatching(p.keyword_matching),
      p.referred_by_name ?? null,
      p.comment ?? null,
    ],
  );
  return c.json(row, 201);
});

app.get("/api/referrals/trend", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const rawAnchor = c.req.query("anchorDay");
  const anchorDayValid = rawAnchor && /^\d{4}-\d{2}-\d{2}$/.test(rawAnchor);
  const anchorDay = anchorDayValid ? rawAnchor : null;
  const anchorDateSql = anchorDay ? `$2::date` : `CURRENT_DATE`;
  const params = anchorDay ? [userId, anchorDay] : [userId];

  // Daily counts of Requested (from referrals table) vs Referral received (from jobs table with referral_status='Yes')
  const trendData = await query<{ day: string; requested: number; received: number }>(
    env,
    `
    SELECT
      d.day::text AS day,
      COALESCE(req.cnt, 0)::int AS requested,
      COALESCE(rec.cnt, 0)::int AS received
    FROM (
      SELECT generate_series(
        (${anchorDateSql} - (${days}::text || ' days')::interval)::date,
        ${anchorDateSql}::date,
        '1 day'::interval
      )::date AS day
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
        AND COALESCE(application_status, 'Applied') != 'Rejected'
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) rec ON rec.day = d.day
    ORDER BY d.day ASC
    `,
    params,
  );

  return c.json({ data: trendData });
});

app.get("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const [row] = await query(c.env, "SELECT * FROM referrals WHERE id = $1 AND user_id = $2 LIMIT 1", [id, userId]);
  if (!row) return c.json({ error: "Referral not found" }, 404);
  return c.json(row);
});

const referralUpdateInput = z.object({
  company: z.string().min(1).optional(),
  request_log: z.string().optional(),
  request_date: z.string().optional(),
  request_link: z.string().url().optional().nullable(),
  referral_received: z.string().optional().nullable(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional().nullable(),
  referred_by_name: z.string().optional().nullable(),
  comment: z.string().optional(),
});

app.patch("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = referralUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.company !== undefined) {
    updates.push(`company = $${i++}`);
    values.push(p.company);
  }
  if (p.request_log !== undefined) {
    updates.push(`request_log = $${i++}`);
    values.push(p.request_log);
  }
  if (p.request_date !== undefined) {
    updates.push(`request_date = $${i++}`);
    values.push(p.request_date);
  }
  if (p.request_link !== undefined) {
    updates.push(`request_link = $${i++}`);
    values.push(p.request_link);
  }
  if (p.referral_received !== undefined) {
    updates.push(`referral_received = $${i++}`);
    values.push(p.referral_received == null ? null : normalizeReferralStatus(p.referral_received));
  }
  if (p.keyword_matching !== undefined) {
    updates.push(`keyword_matching = $${i++}`);
    values.push(normalizeKeywordMatching(p.keyword_matching));
  }
  if (p.referred_by_name !== undefined) {
    updates.push(`referred_by_name = $${i++}`);
    values.push(p.referred_by_name);
  }
  if (p.comment !== undefined) {
    updates.push(`comment = $${i++}`);
    values.push(p.comment);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE referrals SET ${updates.join(", ")}, updated_date = CURRENT_DATE, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Referral not found" }, 404);
  return c.json(row);
});

app.delete("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM referrals WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Referral not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/notes", async (c) => {
  const userId = c.get("authUser").id;
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 25), 100);
  const offset = (page - 1) * limit;
  const showArchive = c.req.query("archive") === "true";
  const showOnDashboard = c.req.query("show_on_dashboard");
  const onlyDashboard = showOnDashboard === "true";
  const whereDashboard = onlyDashboard ? " AND show_on_dashboard = TRUE" : "";
  const rows = await query(
    c.env,
    `
    SELECT *
    FROM daily_notes
    WHERE user_id = $1 AND is_done = $2${whereDashboard}
    ORDER BY id DESC
    LIMIT $3 OFFSET $4
    `,
    [userId, showArchive, limit, offset],
  );
  return c.json({ page, limit, data: rows });
});

const noteInput = z.object({
  note_date: z.string().optional(),
  comments: z.string().min(1),
  priority: z.enum(["High", "Medium", "Low", "Archive"]).optional(),
  show_on_dashboard: z.boolean().optional(),
});

app.post("/api/notes", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = noteInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    "INSERT INTO daily_notes (user_id, source, note_date, comments, priority, show_on_dashboard, is_done) VALUES ($1, 'manual', $2, $3, $4, $5, FALSE) RETURNING *",
    [userId, p.note_date ?? null, p.comments, p.priority ?? "Medium", p.show_on_dashboard ?? true],
  );
  return c.json(row, 201);
});

const noteEditInput = z.object({
  note_date: z.string().optional(),
  comments: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low", "Archive"]).optional(),
  show_on_dashboard: z.boolean().optional(),
  is_done: z.boolean().optional(),
});

app.patch("/api/notes/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = noteEditInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.note_date !== undefined) {
    updates.push(`note_date = $${i++}`);
    values.push(p.note_date);
  }
  if (p.comments !== undefined) {
    updates.push(`comments = $${i++}`);
    values.push(p.comments);
  }
  if (p.priority !== undefined) {
    updates.push(`priority = $${i++}`);
    values.push(p.priority);
  }
  if (p.show_on_dashboard !== undefined) {
    updates.push(`show_on_dashboard = $${i++}`);
    values.push(p.show_on_dashboard);
  }
  if (p.is_done !== undefined) {
    updates.push(`is_done = $${i++}`);
    values.push(p.is_done);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE daily_notes SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/api/notes/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM daily_notes WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/pending", async (c) => {
  const userId = c.get("authUser").id;
  const showArchive = c.req.query("archive") === "true";
  let rows;
  if (showArchive) {
    rows = await query(
      c.env,
      "SELECT * FROM pending_items WHERE user_id = $1 AND is_done = TRUE ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 200",
      [userId],
    );
  } else {
    rows = await query(
      c.env,
      "SELECT * FROM pending_items WHERE user_id = $1 AND is_done = FALSE ORDER BY pending_date DESC NULLS LAST, id DESC LIMIT 200",
      [userId],
    );
  }
  return c.json({ data: rows });
});

const pendingPostInput = z.object({
  company: z.string().min(1),
  position_name: z.string().optional(),
  pending_date: z.string().optional(),
  end_date: z.string().optional(),
  comment: z.string().optional(),
  link: z.union([z.string().url(), z.literal("")]).optional(),
});
app.post("/api/pending", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = pendingPostInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `INSERT INTO pending_items (user_id, source, company, position_name, pending_date, end_date, comment, link)
     VALUES ($1, 'manual', $2, $3, $4::date, $5::date, $6, $7) RETURNING *`,
    [
      userId,
      p.company.trim(),
      p.position_name?.trim() || null,
      p.pending_date || null,
      p.end_date || null,
      p.comment?.trim() || null,
      p.link?.trim() || null,
    ],
  );
  return c.json(row, 201);
});

const pendingEditInput = z.object({
  company: z.string().min(1).optional(),
  position_name: z.string().optional(),
  pending_date: z.string().optional(),
  end_date: z.string().optional(),
  comment: z.string().optional(),
  link: z.union([z.string().url(), z.literal("")]).optional(),
  is_done: z.boolean().optional(),
});

app.patch("/api/pending/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = pendingEditInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.company !== undefined) {
    updates.push(`company = $${i++}`);
    values.push(p.company);
  }
  if (p.position_name !== undefined) {
    updates.push(`position_name = $${i++}`);
    values.push(p.position_name);
  }
  if (p.pending_date !== undefined) {
    updates.push(`pending_date = $${i++}`);
    values.push(p.pending_date);
  }
  if (p.end_date !== undefined) {
    updates.push(`end_date = $${i++}`);
    values.push(p.end_date);
  }
  if (p.comment !== undefined) {
    updates.push(`comment = $${i++}`);
    values.push(p.comment);
  }
  if (p.link !== undefined) {
    updates.push(`link = $${i++}`);
    values.push(p.link);
  }
  if (p.is_done !== undefined) {
    updates.push(`is_done = $${i++}`);
    values.push(p.is_done);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE pending_items SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return c.json({ error: message }, 500);
});

export default app;
