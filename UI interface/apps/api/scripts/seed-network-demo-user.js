import { pbkdf2Sync, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

const DEFAULT_ITERATIONS = 100000;
const DEMO_SOURCE = "network-demo";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function randomPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function hashPassword(password, saltHex, iterations = DEFAULT_ITERATIONS) {
  return pbkdf2Sync(password, Buffer.from(saltHex, "hex"), iterations, 32, "sha256").toString("hex");
}

function toIsoDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function buildDailyCounts(days = 35) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const base = Math.max(0, Math.floor(5 + 8 * Math.sin(i / 3) + (i % 4)));
    const bonus = i % 9 === 0 ? 7 : 0;
    const count = Math.min(28, base + bonus);
    out.push({ day: toIsoDay(daysAgo(i)), count });
  }
  return out;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("Set DATABASE_URL (or NEON_DATABASE_URL).");
    process.exit(1);
  }

  const email = normalizeEmail(process.env.DEMO_EMAIL || "atishay.kasliwal@stonybrook.edu");
  if (!email) {
    console.error("DEMO_EMAIL is required.");
    process.exit(1);
  }
  const password = process.env.DEMO_PASSWORD?.trim() || randomPassword(14);

  const sql = neon(dbUrl);
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt, DEFAULT_ITERATIONS);

  await sql.query(
    `
    INSERT INTO dashboard_users (email, password_hash, password_salt, password_iterations)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      password_iterations = EXCLUDED.password_iterations,
      updated_at = NOW()
    `,
    [email, passwordHash, salt, DEFAULT_ITERATIONS],
  );

  const [user] = await sql.query(
    `
    SELECT id, email
    FROM dashboard_users
    WHERE email = $1
    LIMIT 1
    `,
    [email],
  );
  if (!user?.id) {
    throw new Error("Failed to find/create demo user");
  }
  const userId = Number(user.id);

  await sql.query(
    `
    DELETE FROM jobs
    WHERE user_id = $1
      AND source = $2
    `,
    [userId, DEMO_SOURCE],
  );

  const companies = [
    "Stripe",
    "Datadog",
    "Cloudflare",
    "Ramp",
    "Notion",
    "Vercel",
    "OpenAI",
    "Figma",
    "Plaid",
    "GitHub",
  ];
  const roles = [
    "Software Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Engineer",
    "Platform Engineer",
    "Product Engineer",
  ];

  const dailyCounts = buildDailyCounts(35);
  let inserted = 0;
  for (const dayRow of dailyCounts) {
    const { day, count } = dayRow;
    for (let i = 0; i < count; i += 1) {
      const company = companies[(inserted + i) % companies.length];
      const role = roles[(inserted + i * 3) % roles.length];
      const referralStatus = (inserted + i) % 5 === 0 ? "Yes" : "No";
      await sql.query(
        `
        INSERT INTO jobs (
          user_id, source, role, company, location_raw, job_link, keyword_matching,
          referral_status, response_status, application_status, notes, date_saved
        )
        VALUES (
          $1, $2, $3, $4, 'United States', $5, 'Medium',
          $6, 'Review', 'Applied', $7, ($8::date)::timestamp
        )
        `,
        [
          userId,
          DEMO_SOURCE,
          role,
          company,
          `https://example.com/jobs/${company.toLowerCase()}-${inserted + i}`,
          referralStatus,
          `Seeded demo application ${inserted + i + 1}`,
          day,
        ],
      );
      inserted += 1;
    }
  }

  console.log("Demo user ready.");
  console.log(`email: ${email}`);
  console.log(`password: ${password}`);
  console.log(`user_id: ${userId}`);
  console.log(`seeded_jobs: ${inserted}`);
}

main().catch((error) => {
  console.error("Failed to seed demo user:", error);
  process.exit(1);
});
