import { randomBytes, pbkdf2Sync } from "crypto";
import { neon } from "@neondatabase/serverless";

const DEFAULT_ITERATIONS = 210000;
const DEFAULT_USERS = [
  "katishay@gmail.com",
  "meetbrahmbhatt1224@gmail.com",
  "krishgirish.sajnani@stonybrook.edu",
  "thapliyalparth28@gmail.com",
];

function randomPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function hashPassword(password, saltHex, iterations = DEFAULT_ITERATIONS) {
  const derived = pbkdf2Sync(password, Buffer.from(saltHex, "hex"), iterations, 32, "sha256");
  return derived.toString("hex");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function parseUsersArg(args) {
  const usersArg = args.find((arg) => arg.startsWith("--users="));
  if (!usersArg) return DEFAULT_USERS;
  const list = usersArg
    .slice("--users=".length)
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return list.length ? list : DEFAULT_USERS;
}

function hasResetFlag(args) {
  return args.includes("--reset");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("Set DATABASE_URL (or NEON_DATABASE_URL) before running seed-users.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const users = Array.from(new Set(parseUsersArg(args)));
  const resetPasswords = hasResetFlag(args);
  const sql = neon(dbUrl);
  const generated = [];
  const skipped = [];

  for (const email of users) {
    const existing = await sql.query(
      `
      SELECT id, password_hash
      FROM dashboard_users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );

    if (!resetPasswords && existing[0]?.password_hash) {
      skipped.push(email);
      continue;
    }

    const password = randomPassword(16);
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

    generated.push({ email, password });
  }

  if (generated.length > 0) {
    console.log("Seeded users (store these passwords safely):");
    for (const row of generated) {
      console.log(`${row.email} -> ${row.password}`);
    }
  } else {
    console.log("No passwords were changed.");
  }

  if (skipped.length > 0) {
    console.log("Existing users kept unchanged:");
    for (const email of skipped) {
      console.log(`- ${email}`);
    }
  }
}

main().catch((error) => {
  console.error("Failed to seed users:", error);
  process.exit(1);
});
