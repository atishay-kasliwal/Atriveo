import { neon } from "@neondatabase/serverless";

const DEFAULT_MAPPINGS = [
  { email: "katishay@gmail.com", first_name: "Atishay", last_name: "Kasliwal" },
  { email: "atishay.kasliwal@stonybrook.edu", first_name: "Atishay", last_name: "Kasliwal" },
  { email: "thapliyalparth28@gmail.com", first_name: "Parth", last_name: "Thapliya" },
  { email: "meetbrahmbhatt1224@gmail.com", first_name: "Meet", last_name: "Brahmbhatt" },
  { email: "krishgirish.sajnani@stonybrook.edu", first_name: "Krish", last_name: "Sajnani" },
];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toTitleCase(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("Set DATABASE_URL (or NEON_DATABASE_URL).");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  let updated = 0;
  let missing = 0;

  for (const row of DEFAULT_MAPPINGS) {
    const email = normalizeEmail(row.email);
    const firstName = toTitleCase(row.first_name);
    const lastName = toTitleCase(row.last_name);
    const result = await sql.query(
      `
      UPDATE dashboard_users
      SET first_name = $2,
          last_name = $3,
          updated_at = NOW()
      WHERE email = $1
      RETURNING id, email
      `,
      [email, firstName, lastName],
    );
    if (result.length > 0) {
      updated += 1;
      console.log(`Updated: ${email} -> ${firstName} ${lastName}`);
    } else {
      missing += 1;
      console.log(`Not found: ${email}`);
    }
  }

  // Optional helper for demo users we seeded for visuals.
  const demoRows = await sql.query(
    `
    SELECT id, email
    FROM dashboard_users
    WHERE (first_name IS NULL OR first_name = '')
      AND email ~ 'network\\d+@'
    ORDER BY id ASC
    `,
  );
  let demoNamed = 0;
  for (const row of demoRows) {
    const email = String(row.email);
    const local = email.split("@")[0] || "";
    const parts = local.split(".").filter(Boolean);
    const firstName = toTitleCase(parts[0] || "Demo");
    const lastName = toTitleCase(parts[1] || "User");
    await sql.query(
      `
      UPDATE dashboard_users
      SET first_name = $2,
          last_name = $3,
          updated_at = NOW()
      WHERE id = $1
      `,
      [Number(row.id), firstName, lastName],
    );
    demoNamed += 1;
  }

  console.log("User name update completed.");
  console.log(`mapped_updated: ${updated}`);
  console.log(`mapped_missing: ${missing}`);
  console.log(`demo_named: ${demoNamed}`);
}

main().catch((error) => {
  console.error("Failed to set user names:", error);
  process.exit(1);
});
