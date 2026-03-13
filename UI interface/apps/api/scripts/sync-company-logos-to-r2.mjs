import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const defaultLogosDir = path.join(repoRoot, "apps/web/public/company-logos");
const defaultObjectPrefix = "logos";
const extensionPriority = new Map([
  ["svg", 50],
  ["webp", 40],
  ["png", 30],
  ["jpg", 20],
  ["jpeg", 20],
  ["avif", 10],
  ["gif", 5],
]);

const mimeByExtension = {
  svg: "image/svg+xml",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  avif: "image/avif",
  gif: "image/gif",
};

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

function toDisplayName(normalizedName) {
  return normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getExt(fileName) {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  return ext || "";
}

function candidateScore(ext, isDarkVariant) {
  const extScore = extensionPriority.get(ext) ?? 0;
  return extScore + (isDarkVariant ? 0 : 1000);
}

function deriveR2Endpoint() {
  const explicit = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
  if (explicit) return explicit.trim();
  const accountId = String(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!accountId) return "";
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function requireEnv(name, fallback = "") {
  const value = String(process.env[name] || fallback).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function collectLogoCandidates(logosDir, onlyNormalizedSet) {
  const entries = await fs.readdir(logosDir, { withFileTypes: true });
  const byNormalized = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = getExt(entry.name);
    if (!extensionPriority.has(ext)) continue;

    const baseName = path.basename(entry.name, path.extname(entry.name));
    const isDarkVariant = /-(dark|night|inverse)$/i.test(baseName);
    const canonicalBase = baseName.replace(/-(dark|night|inverse)$/i, "");
    const normalized = normalizeCompanyName(canonicalBase.replace(/[-_]+/g, " "));
    if (!normalized) continue;
    if (onlyNormalizedSet && !onlyNormalizedSet.has(normalized)) continue;

    const score = candidateScore(ext, isDarkVariant);
    const absolutePath = path.join(logosDir, entry.name);
    const objectKey = `${defaultObjectPrefix}/${normalized}.${ext}`;
    const candidate = {
      normalized,
      displayName: toDisplayName(normalized),
      ext,
      mimeType: mimeByExtension[ext] || "application/octet-stream",
      absolutePath,
      objectKey,
      fileName: entry.name,
      score,
    };
    const existing = byNormalized.get(normalized);
    if (!existing || candidate.score > existing.score) {
      byNormalized.set(normalized, candidate);
    }
  }

  return Array.from(byNormalized.values()).sort((a, b) => a.normalized.localeCompare(b.normalized));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = hasArg(args, "dry-run");
  const limitRaw = parseArgValue(args, "limit");
  const onlyRaw = parseArgValue(args, "only");
  const explicitLogosDir = parseArgValue(args, "logos-dir");

  const logosDir = path.resolve(explicitLogosDir || defaultLogosDir);
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("Set DATABASE_URL (or NEON_DATABASE_URL) before running this script.");
  }

  const bucketName = requireEnv("R2_BUCKET", process.env.R2_BUCKET_NAME || "");
  const endpoint = deriveR2Endpoint();
  if (!endpoint) {
    throw new Error("Set R2_ENDPOINT (or R2_ACCOUNT_ID) before running this script.");
  }
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID || "");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY || "");

  const sql = neon(dbUrl);
  const s3 = new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  let onlyNormalizedSet = null;
  if (onlyRaw) {
    const normalized = onlyRaw
      .split(",")
      .map((value) => normalizeCompanyName(value.replace(/[-_]+/g, " ")))
      .filter(Boolean);
    if (normalized.length > 0) {
      onlyNormalizedSet = new Set(normalized);
    }
  }

  let candidates = await collectLogoCandidates(logosDir, onlyNormalizedSet);
  if (limitRaw) {
    const limit = Math.max(0, Number(limitRaw) || 0);
    if (limit > 0) candidates = candidates.slice(0, limit);
  }

  if (candidates.length === 0) {
    console.log("No eligible logo files found. Nothing to sync.");
    return;
  }

  console.log(`Preparing to sync ${candidates.length} company logos from: ${logosDir}`);
  console.log(`Target bucket: ${bucketName}`);
  console.log(`R2 endpoint: ${endpoint}`);
  if (dryRun) console.log("Dry-run enabled. No upload or DB writes will be performed.");

  let uploaded = 0;
  let dbUpdated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      if (!dryRun) {
        const body = await fs.readFile(candidate.absolutePath);
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: candidate.objectKey,
            Body: body,
            ContentType: candidate.mimeType,
            CacheControl: "public, max-age=604800, immutable",
          }),
        );
      }
      uploaded += 1;

      if (!dryRun) {
        await sql.query(
          `
          INSERT INTO company_directory (
            normalized_name,
            display_name,
            logo_available,
            logo_key,
            usage_count,
            last_seen_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, TRUE, $3, 0, NOW(), NOW(), NOW())
          ON CONFLICT (normalized_name) DO UPDATE
          SET
            display_name = COALESCE(NULLIF(TRIM(company_directory.display_name), ''), EXCLUDED.display_name),
            logo_available = TRUE,
            logo_key = EXCLUDED.logo_key,
            updated_at = NOW()
          `,
          [candidate.normalized, candidate.displayName, candidate.objectKey],
        );
      }
      dbUpdated += 1;

      console.log(`synced ${candidate.normalized} -> ${candidate.objectKey}`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${candidate.normalized}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(
    JSON.stringify(
      {
        totalCandidates: candidates.length,
        uploaded,
        dbUpdated,
        failed,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Logo sync failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
