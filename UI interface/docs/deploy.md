# Deploy Guide (Cloudflare + Neon)

## 1) Rotate Neon credentials first

1. In Neon console, create a new database user with limited privileges for this app.
2. Update password and copy the new connection string.
3. Revoke old credential that was exposed.
4. Run migration (either way):
   - **Option A:** `export NEON_DATABASE_URL="<NEW_NEON_URL>"` then `python3 scripts/run_migration.py` (runs `db/migrations/001_init.sql`).
   - **Option B:** Paste and run `db/migrations/001_init.sql` in Neon SQL Editor.
   - Optionally run `002_app_user_template.sql` after editing the password.

## 2) Import existing Excel data

```bash
cd "/Users/atishaykasliwal/UI interface"
pip3 install -r scripts/requirements.txt
export NEON_DATABASE_URL="<NEW_NEON_URL>"
python3 scripts/import_xlsx.py
```

The script writes `import_report.json` with inserted row counts.

## 3) Configure API secrets (staging + production)

```bash
cd "/Users/atishaykasliwal/UI interface/apps/api"
wrangler secret put NEON_DATABASE_URL --env staging
wrangler secret put API_SHARED_TOKEN --env staging
wrangler secret put NEON_DATABASE_URL --env production
wrangler secret put API_SHARED_TOKEN --env production
```

## 4) Deploy API Worker

```bash
cd "/Users/atishaykasliwal/UI interface/apps/api"
npm install
npm run deploy:staging
npm run deploy:prod
```

Notes:
- `deploy:staging` deploys Worker `job-tracker-api-staging` with `APP_ENV=staging`.
- `deploy:prod` deploys Worker `job-tracker-api` with `APP_ENV=production`.

## 5) Deploy React app to Cloudflare Pages

The marketing landing now lives at `/` and the authenticated dashboard continues at **`/dashboard`** (e.g. `atishaykasliwal.com/dashboard`).
Keep `VITE_APP_BASE=/` so assets resolve from the root while routes handle the `/dashboard` prefix.

1. Connect the repo to Cloudflare Pages.
2. **Build command:** `npm run build -w @job-tracker/web`
3. **Build output directory:** `apps/web/dist`
4. **Environment variables** in Pages:
   - staging: `VITE_API_URL=https://job-tracker-api-staging.<your-subdomain>.workers.dev`
   - production: `VITE_API_URL=https://job-tracker-api.<your-subdomain>.workers.dev`
   - `VITE_API_TOKEN=<same API_SHARED_TOKEN value>` (optional)
   - `VITE_APP_BASE=/` (keep at root so landing page renders on `/`)

After deploy, the app is available at:
- **`<pages-project>.pages.dev/dashboard`** (e.g. `job-tracker.pages.dev/dashboard`)

## 6) Add private access

Use Cloudflare Access in front of the Pages project:
- Policy: allow only your email(s).
- API still requires token/bearer for direct calls.

## 7) Map domain to atishaykasliwal.com/dashboard

**Landing at `/`, dashboard at `/dashboard` on the same Pages project**

- Add custom domains to the Pages project (examples):
  - **`atriveo.com`** (new primary)
  - **`production.atishaykasliwal.com`** (keep live during transition)
- Pages handles `/` (landing) and `/dashboard` (app) automatically because the SPA uses client-side routing and `VITE_APP_BASE=/`.
- Optional: when ready, add a Cloudflare redirect rule from `production.atishaykasliwal.com/*` to `https://atriveo.com/$1` while keeping a 30-day grace period for existing users.

**If another site already lives at the apex:**

- Put a small Cloudflare Worker in front of the apex that proxies `/dashboard` (and `/dashboard/*`) to the Pages deployment while letting other routes hit the existing origin. The landing page can stay on the existing origin or the Worker can also proxy `/` to Pages.

**Local dev**

- Run the web app: `npm run dev:web` (from repo root).
- Open **http://localhost:5173/dashboard/** (Vite serves the app under the same base path).

## 8) Atriveo.com cutover checklist

- **DNS**: point `atriveo.com` (and `www`) to the Cloudflare Pages project; keep `production.atishaykasliwal.com` CNAMEd to the same Pages project for a parallel run.
- **API**: Workers stay on `job-tracker-api` / `job-tracker-api-staging`. If you want a branded hostname, add a Worker route like `api.atriveo.com/*` pointing to the production Worker.
- **Env**: confirm `SIGNUPS_ENABLED=true` in Wrangler (`wrangler.toml` already sets it) and set `VITE_APP_BASE=/` in Pages env vars.
- **Analytics/GA allowed hosts**: include both `atriveo.com` and `production.atishaykasliwal.com` if GA is enabled.
- **Graceful migration**: after verifying atriveo.com, keep the old domain live for ~30 days; then add 301 redirects from `production.atishaykasliwal.com/*` to `atriveo.com/$1`.
