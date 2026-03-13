import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const topTargetCompaniesPath = path.join(repoRoot, "apps/web/src/lib/topTargetCompanies.ts");
const defaultObjectPrefix = "logos";

const genericDomains = new Set([
  "example.com",
  "jobright.ai",
  "linkedin.com",
  "tally.so",
  "clearcompany.com",
  "greenhousejobboard.com",
  "boards.greenhouse.io",
  "boards.greenhouse.io",
  "greenhouse.io",
  "jobs.lever.co",
  "lever.co",
  "workdayjobs.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "icims.com",
  "ashbyhq.com",
  "jobvite.com",
  "successfactors.com",
  "oraclecloud.com",
]);

const genericDomainPatterns = [
  /(^|\.)linkedin\.com$/i,
  /(^|\.)tally\.so$/i,
  /(^|\.)clearcompany\.com$/i,
  /(^|\.)greenhousejobboard\.com$/i,
  /(^|\.)myworkdayjobs\.com$/i,
  /(^|\.)greenhouse\.io$/i,
  /(^|\.)lever\.co$/i,
  /(^|\.)jobright\.ai$/i,
  /(^|\.)smartrecruiters\.com$/i,
  /(^|\.)icims\.com$/i,
  /(^|\.)ashbyhq\.com$/i,
  /(^|\.)jobvite\.com$/i,
  /(^|\.)successfactors\.com$/i,
  /(^|\.)oraclecloud\.com$/i,
];

function parseArgValue(args, name) {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasArg(args, name) {
  return args.includes(`--${name}`);
}

function normalizeCompanyName(value) {
  const raw = String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return null;
  let normalized = raw;
  const suffixRegex = /\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)\.?$/i;
  while (suffixRegex.test(normalized)) {
    normalized = normalized.replace(suffixRegex, "").trim();
  }
  return normalized || null;
}

function toApexDomain(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .trim()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!host || /\s/.test(host) || !host.includes(".")) return null;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const tld2 = labels.slice(-2).join(".");
  const tld3 = labels.slice(-3).join(".");
  const multiTld = new Set([
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "co.in",
    "co.jp",
    "com.au",
    "com.br",
    "co.kr",
    "co.nz",
    "com.sg",
  ]);
  if (labels.length >= 3 && multiTld.has(tld2)) return tld3;
  return tld2;
}

function parseDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const withScheme = raw.includes("://") ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    return toApexDomain(url.hostname);
  } catch {
    return toApexDomain(raw);
  }
}

function isGenericDomain(domain) {
  const d = String(domain || "").trim().toLowerCase();
  if (!d) return true;
  if (genericDomains.has(d)) return true;
  return genericDomainPatterns.some((pattern) => pattern.test(d));
}

function deriveR2Endpoint() {
  const explicit = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
  if (explicit) return explicit.trim();
  const accountId = String(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!accountId) return "";
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function requiredEnv(name, fallback = "") {
  const value = String(process.env[name] || fallback).trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildGuessDomain(normalizedName) {
  const token = String(normalizedName || "").replace(/[^a-z0-9]/gi, "");
  if (!token || token.length < 3) return null;
  return `${token.toLowerCase()}.com`;
}

function slugifyNormalizedName(normalizedName) {
  const slug = String(normalizedName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

async function loadCuratedDomainMap() {
  const content = await fs.readFile(topTargetCompaniesPath, "utf8");
  const map = new Map();
  const lineRegex = /^\s*["']?([^"':]+)["']?\s*:\s*"https:\/\/logo\.clearbit\.com\/([^"\s/]+)"/gm;
  for (const match of content.matchAll(lineRegex)) {
    const companyName = normalizeCompanyName(match[1]);
    const domain = parseDomain(match[2]);
    if (!companyName || !domain) continue;
    if (!map.has(companyName)) map.set(companyName, domain);
  }
  return map;
}

async function fetchFaviconBytes(domain) {
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  const res = await fetch(url, {
    headers: {
      "user-agent": "AtriveoLogoSync/1.0 (+https://atriveo.com)",
      accept: "image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error(`Unexpected content-type: ${contentType || "unknown"}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}

async function tryGetPlaceholderHash() {
  try {
    const placeholder = await fetchFaviconBytes("nonexistent-atriveo-logo-check.invalid");
    return sha256Hex(placeholder.bytes);
  } catch {
    return null;
  }
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = hasArg(args, "dry-run");
  const limitRaw = parseArgValue(args, "limit");
  const concurrencyRaw = parseArgValue(args, "concurrency");
  const guessMinUsageRaw = parseArgValue(args, "guess-min-usage");
  const onlyRaw = parseArgValue(args, "only");

  const limit = limitRaw ? Math.max(1, Number(limitRaw) || 0) : null;
  const concurrency = Math.max(1, Number(concurrencyRaw || 8) || 8);
  const guessMinUsage = Math.max(0, Number(guessMinUsageRaw || 40) || 40);
  const onlySet = onlyRaw
    ? new Set(
        onlyRaw
          .split(",")
          .map((value) => normalizeCompanyName(value))
          .filter(Boolean),
      )
    : null;

  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) throw new Error("Set DATABASE_URL (or NEON_DATABASE_URL) before running this script.");

  const r2Endpoint = deriveR2Endpoint();
  if (!r2Endpoint) throw new Error("Set R2_ENDPOINT (or R2_ACCOUNT_ID) before running this script.");

  const bucket = requiredEnv("R2_BUCKET", process.env.R2_BUCKET_NAME || "");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID || "");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY || "");

  const sql = neon(dbUrl);
  const s3 = new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint: r2Endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const curatedDomains = await loadCuratedDomainMap();

  const rows = await sql.query(
    `
    SELECT normalized_name, display_name, domain, usage_count
    FROM company_directory
    WHERE logo_available = FALSE
    ORDER BY usage_count DESC, normalized_name ASC
    `,
    [],
  );

  let missing = rows.filter((row) => !onlySet || onlySet.has(String(row.normalized_name || "")));
  if (limit) missing = missing.slice(0, limit);

  if (!missing.length) {
    console.log("No missing logos to process.");
    return;
  }

  const placeholderHash = await tryGetPlaceholderHash();

  console.log(`Candidates: ${missing.length}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Guess min usage: ${guessMinUsage}`);

  const summary = {
    candidates: missing.length,
    uploaded: 0,
    skipped_no_domain: 0,
    skipped_placeholder: 0,
    skipped_too_small: 0,
    failed: 0,
    bySource: {
      curated: 0,
      existing_domain: 0,
      guessed: 0,
    },
  };

  await runWithConcurrency(missing, concurrency, async (row) => {
    const normalizedName = String(row.normalized_name || "").trim();
    if (!normalizedName) return;

    const currentDomain = parseDomain(row.domain);
    const curatedDomain = curatedDomains.get(normalizedName) || null;
    const guessedDomain = buildGuessDomain(normalizedName);
    const usageCount = Math.max(0, Number(row.usage_count || 0) || 0);

    const candidates = [];
    if (curatedDomain) candidates.push({ source: "curated", domain: curatedDomain });
    if (currentDomain && !isGenericDomain(currentDomain)) candidates.push({ source: "existing_domain", domain: currentDomain });
    if (guessedDomain && usageCount >= guessMinUsage) {
      candidates.push({ source: "guessed", domain: guessedDomain });
    }

    const deduped = [];
    const seen = new Set();
    for (const item of candidates) {
      if (!item.domain || seen.has(item.domain)) continue;
      seen.add(item.domain);
      deduped.push(item);
    }

    if (!deduped.length) {
      summary.skipped_no_domain += 1;
      return;
    }

    let icon = null;
    let used = null;
    for (const candidate of deduped) {
      try {
        const fetched = await fetchFaviconBytes(candidate.domain);
        const hash = sha256Hex(fetched.bytes);
        if (placeholderHash && hash === placeholderHash) continue;
        if (fetched.bytes.length < 100) {
          summary.skipped_too_small += 1;
          return;
        }
        icon = fetched;
        used = candidate;
        break;
      } catch {
        // Try next candidate domain.
      }
    }

    if (!icon || !used) {
      summary.skipped_placeholder += 1;
      return;
    }

    const ext = icon.contentType.includes("svg") ? "svg" : "png";
    const slug = slugifyNormalizedName(normalizedName);
    if (!slug) {
      summary.skipped_no_domain += 1;
      return;
    }
    const objectKey = `${defaultObjectPrefix}/${slug}.${ext}`;

    try {
      if (!dryRun) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: icon.bytes,
            ContentType: icon.contentType || (ext === "svg" ? "image/svg+xml" : "image/png"),
            CacheControl: "public, max-age=604800, immutable",
          }),
        );

        await sql.query(
          `
          UPDATE company_directory
          SET
            logo_available = TRUE,
            logo_key = $2,
            updated_at = NOW()
          WHERE normalized_name = $1
          `,
          [normalizedName, objectKey],
        );
      }

      summary.uploaded += 1;
      if (used.source === "curated") summary.bySource.curated += 1;
      if (used.source === "existing_domain") summary.bySource.existing_domain += 1;
      if (used.source === "guessed") summary.bySource.guessed += 1;
      console.log(`synced ${normalizedName} -> ${objectKey} (${used.source}:${used.domain})`);
    } catch (error) {
      summary.failed += 1;
      console.error(`failed ${normalizedName}:`, error instanceof Error ? error.message : String(error));
    }
  });

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Missing-logo backfill failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
