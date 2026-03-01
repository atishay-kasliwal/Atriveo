import { pbkdf2Sync, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

const DEFAULT_ITERATIONS = 100000;
const DEMO_SOURCE = "network-demo-friends";
const DEFAULT_OWNER_EMAIL = "atishay.kasliwal@stonybrook.edu";
const DEFAULT_FRIEND_COUNT = 4;

const FIRST_NAMES = ["alex", "sam", "jordan", "taylor", "dev", "chris", "morgan", "riley", "jamie", "casey"];
const LAST_NAMES = ["shah", "mehta", "patel", "lee", "kim", "garcia", "brown", "clark", "evans", "ross"];
const DOMAINS = ["maildemo.app", "networkseed.dev", "example.net"];

const COMPANIES = ["Stripe", "Datadog", "Cloudflare", "Ramp", "Notion", "Vercel", "OpenAI", "Figma", "Plaid", "GitHub"];
const ROLES = ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "Platform Engineer", "Product Engineer"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function randomPassword(length = 14) {
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

function buildDailyCounts(days = 35, seedOffset = 0) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const base = Math.max(0, Math.floor(3 + 6 * Math.sin((i + seedOffset) / 3) + ((i + seedOffset) % 5)));
    const surge = (i + seedOffset) % 11 === 0 ? 8 : 0;
    const count = Math.min(24, base + surge);
    out.push({ day: toIsoDay(daysAgo(i)), count });
  }
  return out;
}

function buildFriendEmail(i) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
  const domain = DOMAINS[i % DOMAINS.length];
  return `${first}.${last}.network${String(i + 1).padStart(2, "0")}@${domain}`;
}

async function upsertUser(sql, email, password) {
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
  const [row] = await sql.query(`SELECT id FROM dashboard_users WHERE email = $1 LIMIT 1`, [email]);
  return Number(row.id);
}

async function seedJobs(sql, userId, seedOffset = 0) {
  await sql.query(`DELETE FROM jobs WHERE user_id = $1 AND source = $2`, [userId, DEMO_SOURCE]);
  const dailyCounts = buildDailyCounts(35, seedOffset);
  let inserted = 0;

  for (const dayRow of dailyCounts) {
    for (let i = 0; i < dayRow.count; i += 1) {
      const company = COMPANIES[(inserted + i + seedOffset) % COMPANIES.length];
      const role = ROLES[(inserted + i * 2 + seedOffset) % ROLES.length];
      const referralStatus = (inserted + i + seedOffset) % 4 === 0 ? "Yes" : "No";
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
          `https://example.com/jobs/${company.toLowerCase()}-${userId}-${inserted + i}`,
          referralStatus,
          `Seeded friend demo application ${inserted + i + 1}`,
          dayRow.day,
        ],
      );
      inserted += 1;
    }
  }
  return inserted;
}

async function ensureAcceptedFriendship(sql, ownerId, friendId) {
  await sql.query(
    `
    INSERT INTO friendships (requester_id, receiver_id, status, accepted_at)
    VALUES ($1, $2, 'accepted', NOW())
    ON CONFLICT (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))
    DO UPDATE SET
      status = 'accepted',
      accepted_at = NOW(),
      blocked_at = NULL,
      rejected_at = NULL,
      updated_at = NOW()
    `,
    [ownerId, friendId],
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("Set DATABASE_URL (or NEON_DATABASE_URL).");
    process.exit(1);
  }

  const ownerEmail = normalizeEmail(process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL);
  const friendCount = Math.max(1, Math.min(8, Number(process.env.FRIEND_COUNT || DEFAULT_FRIEND_COUNT)));
  const sql = neon(dbUrl);

  const [owner] = await sql.query(`SELECT id, email FROM dashboard_users WHERE email = $1 LIMIT 1`, [ownerEmail]);
  if (!owner?.id) {
    throw new Error(`Owner user not found: ${ownerEmail}`);
  }
  const ownerId = Number(owner.id);

  const seeded = [];
  for (let i = 0; i < friendCount; i += 1) {
    const email = buildFriendEmail(i);
    const password = randomPassword(14);
    const userId = await upsertUser(sql, email, password);
    const jobsInserted = await seedJobs(sql, userId, i * 3);
    await ensureAcceptedFriendship(sql, ownerId, userId);
    seeded.push({ email, password, userId, jobsInserted });
  }

  console.log("Network demo friends ready.");
  console.log(`owner_email: ${ownerEmail}`);
  console.log(`owner_id: ${ownerId}`);
  console.log(`friends_seeded: ${seeded.length}`);
  for (const row of seeded) {
    console.log(`${row.email} | password=${row.password} | user_id=${row.userId} | jobs=${row.jobsInserted}`);
  }
}

main().catch((error) => {
  console.error("Failed to seed network demo friends:", error);
  process.exit(1);
});

