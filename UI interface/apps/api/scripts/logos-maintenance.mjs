import path from "path";
import { spawn } from "child_process";

import { neon } from "@neondatabase/serverless";

function parseArgValue(args, name) {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasArg(args, name) {
  return args.includes(`--${name}`);
}

function printUsage() {
  console.log(`Usage: npm run logos:maintenance -w @job-tracker/api -- [options]

Options:
  --dry-run                 Run both scripts without mutating R2/DB
  --limit=<n>               Shared limit for sync/backfill
  --sync-limit=<n>          Limit for curated/local sync only
  --backfill-limit=<n>      Limit for missing-logo backfill only
  --only=a,b,c              Shared company filter for both scripts
  --sync-only=a,b,c         Company filter for curated/local sync only
  --backfill-only=a,b,c     Company filter for backfill only
  --logos-dir=<abs-path>    Override local logos directory for curated sync
  --concurrency=<n>         Backfill concurrency (default from backfill script)
  --guess-min-usage=<n>     Backfill guessed-domain minimum usage
  --skip-sync               Skip curated/local sync step
  --skip-backfill           Skip backfill step
  --help                    Show this help
`);
}

async function runNodeScript(scriptRelativePath, scriptArgs) {
  const scriptPath = path.resolve(process.cwd(), scriptRelativePath);
  const command = [scriptPath, ...scriptArgs];
  console.log(`\n> node ${command.join(" ")}`);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, command, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Command failed (${code}): node ${command.join(" ")}`));
      }
    });
  });
}

async function printCoverageSummary() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.warn("\nSkipping coverage summary: set DATABASE_URL (or NEON_DATABASE_URL).");
    return;
  }

  const sql = neon(dbUrl);
  const [coverage] = await sql.query(
    `
    SELECT
      COUNT(*)::int AS total_companies,
      COUNT(*) FILTER (WHERE logo_available)::int AS logos_enabled,
      COUNT(*) FILTER (WHERE NOT logo_available)::int AS logos_missing
    FROM company_directory
    `,
    [],
  );
  const topMissing = await sql.query(
    `
    SELECT
      normalized_name,
      display_name,
      domain,
      usage_count
    FROM company_directory
    WHERE logo_available = FALSE
    ORDER BY usage_count DESC, normalized_name ASC
    LIMIT 10
    `,
    [],
  );

  console.log(
    `\n${JSON.stringify(
      {
        coverage,
        topMissing,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, "help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const dryRun = hasArg(args, "dry-run");
  const skipSync = hasArg(args, "skip-sync");
  const skipBackfill = hasArg(args, "skip-backfill");

  const sharedLimit = parseArgValue(args, "limit");
  const syncLimit = parseArgValue(args, "sync-limit") || sharedLimit;
  const backfillLimit = parseArgValue(args, "backfill-limit") || sharedLimit;

  const sharedOnly = parseArgValue(args, "only");
  const syncOnly = parseArgValue(args, "sync-only") || sharedOnly;
  const backfillOnly = parseArgValue(args, "backfill-only") || sharedOnly;

  const logosDir = parseArgValue(args, "logos-dir");
  const concurrency = parseArgValue(args, "concurrency");
  const guessMinUsage = parseArgValue(args, "guess-min-usage");

  if (skipSync && skipBackfill) {
    console.log("Skipping sync and backfill steps (both disabled by flags).");
  }

  if (!skipSync) {
    const syncArgs = [];
    if (dryRun) syncArgs.push("--dry-run");
    if (syncLimit) syncArgs.push(`--limit=${syncLimit}`);
    if (syncOnly) syncArgs.push(`--only=${syncOnly}`);
    if (logosDir) syncArgs.push(`--logos-dir=${logosDir}`);

    await runNodeScript("scripts/sync-company-logos-to-r2.mjs", syncArgs);
  }

  if (!skipBackfill) {
    const backfillArgs = [];
    if (dryRun) backfillArgs.push("--dry-run");
    if (backfillLimit) backfillArgs.push(`--limit=${backfillLimit}`);
    if (backfillOnly) backfillArgs.push(`--only=${backfillOnly}`);
    if (concurrency) backfillArgs.push(`--concurrency=${concurrency}`);
    if (guessMinUsage) backfillArgs.push(`--guess-min-usage=${guessMinUsage}`);

    await runNodeScript("scripts/backfill-missing-company-logos.mjs", backfillArgs);
  }

  await printCoverageSummary();
}

main().catch((error) => {
  console.error("Logo maintenance failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
