# Company Logo Sync Runbook

This document explains how to keep `company_directory` and R2 logos in sync over time with low effort.

## What this pipeline does

1. Keep one canonical row per company in `company_directory`.
2. Track how often each company appears (`usage_count`).
3. Serve logos from R2/CDN when available.
4. Fall back safely when a trusted logo is not available.

Core table fields:

- `normalized_name` (unique key)
- `display_name`
- `domain`
- `logo_available`
- `logo_key`
- `usage_count`
- `last_seen_at`

## Current architecture (high level)

1. New jobs are saved/imported.
2. API normalizes company name and upserts `company_directory`.
3. `usage_count` increments automatically.
4. `GET /api/jobs` returns `company_logo_url`:
   - R2 URL when trusted logo exists.
   - Favicon fallback only for trusted/non-jobboard domains.
   - `null` when domain is not trusted (UI shows initials).

## Prerequisites

Run from repository root: `UI interface/`

Required env vars for sync scripts:

- `DATABASE_URL` (or `NEON_DATABASE_URL`)
- `R2_BUCKET` (or `R2_BUCKET_NAME`)
- `R2_ACCESS_KEY_ID` (or `AWS_ACCESS_KEY_ID`)
- `R2_SECRET_ACCESS_KEY` (or `AWS_SECRET_ACCESS_KEY`)
- `R2_ENDPOINT` (or `R2_ACCOUNT_ID`)

Recommended API env var:

- `COMPANY_LOGO_BASE_URL` (for example `https://cdn.atriveo.com`)

## One-time setup checklist

1. Apply DB migrations (includes `035` and `036`):

```bash
npm run db:migrate
```

2. Confirm production API has logo base URL:

```toml
[env.production.vars]
COMPANY_LOGO_BASE_URL = "https://cdn.atriveo.com"
```

3. Deploy API after env updates:

```bash
npm run deploy:api:prod
```

## Routine operations

### Quick all-in-one command (recommended)

Run curated sync + missing backfill + coverage summary:

```bash
npm run logos:maintenance -w @job-tracker/api
```

Safe preview:

```bash
npm run logos:maintenance -w @job-tracker/api -- --dry-run --limit=100
```

Useful options:

- `--concurrency=10`
- `--guess-min-usage=40`
- `--only=google,apple`
- `--skip-sync` or `--skip-backfill`

### A) Sync curated/local logos to R2 (best quality)

Uses `apps/web/public/company-logos` and writes to `logos/<normalized>.<ext>`.

Dry run:

```bash
npm run logos:sync:r2 -w @job-tracker/api -- --dry-run
```

Real run:

```bash
npm run logos:sync:r2 -w @job-tracker/api
```

Useful flags:

- `--only=google,apple,okta`
- `--limit=50`
- `--logos-dir=/absolute/path/to/logos`

### B) Backfill missing logos from domains/favicons

Targets rows where `logo_available = false`.

Dry run:

```bash
npm run logos:backfill:missing -w @job-tracker/api -- --dry-run --limit=100
```

Real run:

```bash
npm run logos:backfill:missing -w @job-tracker/api -- --concurrency=10
```

Useful flags:

- `--only=plaid,affirm`
- `--limit=200`
- `--concurrency=10`
- `--guess-min-usage=40` (only guess `company.com` for high-frequency companies)

## Verification queries

Check overall coverage:

```sql
SELECT
  COUNT(*) AS total_companies,
  COUNT(*) FILTER (WHERE logo_available) AS logos_enabled,
  COUNT(*) FILTER (WHERE NOT logo_available) AS logos_missing
FROM company_directory;
```

Top missing companies by impact:

```sql
SELECT normalized_name, display_name, domain, usage_count
FROM company_directory
WHERE logo_available = FALSE
ORDER BY usage_count DESC, normalized_name ASC
LIMIT 50;
```

Spot check logo keys:

```sql
SELECT normalized_name, logo_key, updated_at
FROM company_directory
WHERE logo_available = TRUE
ORDER BY updated_at DESC
LIMIT 30;
```

## Ongoing maintenance workflow (recommended)

Weekly:

1. Run curated sync.
2. Run missing backfill.
3. Review top missing query.
4. Add a small batch of high-frequency logos into `apps/web/public/company-logos`.
5. Re-run curated sync.

This keeps effort small while improving coverage where it matters most.

## Adding new logos manually

1. Place asset in:

`apps/web/public/company-logos/`

2. Prefer file naming by normalized company name:

- `google.svg`
- `apple.svg`
- `okta.svg`

3. Re-run curated sync script.

Notes:

- Script prefers non-dark variants and better formats (`svg` > `webp` > `png` > ...).
- Keys are generated as `logos/<normalized>.<ext>`.

## Troubleshooting

### Wrong logo source (ATS/job board icon)

- Ensure `company_directory.domain` is company domain (not greenhouse/lever/workday).
- Re-run backfill after domain correction.

### Logo not visible in UI

1. Confirm `company_logo_url` is present in `GET /api/jobs`.
2. Confirm `COMPANY_LOGO_BASE_URL` is set in deployed API env.
3. Verify object exists in R2 at `logo_key`.

### Sync script fails with missing env

- Export required env vars in the same terminal before running scripts.

### Coverage stuck low

- Run top missing query and add top 20-50 local logos.
- Re-run curated sync.

## Safe reset (only when explicitly needed)

If you intentionally need to rebuild logo state:

1. Clear logo flags in DB.
2. Delete `logos/` objects from bucket.
3. Re-run curated sync.
4. Re-run missing backfill.

Do this only during maintenance windows.

## Relevant files

- `apps/api/scripts/sync-company-logos-to-r2.mjs`
- `apps/api/scripts/backfill-missing-company-logos.mjs`
- `apps/api/src/index.ts`
- `db/migrations/035_company_directory.sql`
- `db/migrations/036_company_directory_backfill_from_jobs.sql`
