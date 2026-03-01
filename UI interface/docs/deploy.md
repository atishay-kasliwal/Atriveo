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

The app is built to run at **`/dashboard`** (e.g. `atishaykasliwal.com/dashboard`).

1. Connect the repo to Cloudflare Pages.
2. **Build command:** `npm run build -w @job-tracker/web`
3. **Build output directory:** `apps/web/dist`
4. **Environment variables** in Pages:
   - staging: `VITE_API_URL=https://job-tracker-api-staging.<your-subdomain>.workers.dev`
   - production: `VITE_API_URL=https://job-tracker-api.<your-subdomain>.workers.dev`
   - `VITE_API_TOKEN=<same API_SHARED_TOKEN value>` (optional)

After deploy, the app is available at:
- **`<pages-project>.pages.dev/dashboard`** (e.g. `job-tracker.pages.dev/dashboard`)

## 6) Add private access

Use Cloudflare Access in front of the Pages project:
- Policy: allow only your email(s).
- API still requires token/bearer for direct calls.

## 7) Map domain to atishaykasliwal.com/dashboard

**Option A – Dashboard is the only site on the domain**

1. In Pages, add custom domain **`atishaykasliwal.com`**.
2. Open **`atishaykasliwal.com/dashboard`** (or **`atishaykasliwal.com/dashboard/`**) to use the app.
3. Optional: add a redirect from `/` to `/dashboard` in your host (e.g. Cloudflare Redirect Rule: `atishaykasliwal.com/` → `https://atishaykasliwal.com/dashboard/`).

**Option B – You already have a site at atishaykasliwal.com**

Use a **Cloudflare Worker** on `atishaykasliwal.com` that:

- Serves your existing site for `/` and other paths.
- For requests to **`/dashboard`** or **`/dashboard/*`**, forwards to your Pages deployment (e.g. `https://job-tracker.pages.dev/dashboard` or the same path on a Pages custom subdomain), or serves the built files from the same Worker (e.g. from R2 or embedded assets).

Example Worker logic (pseudo): if `url.pathname.startsWith('/dashboard')` then `fetch('https://<your-pages>.pages.dev' + url.pathname)` and return the response; else pass to your main site.

**Local dev**

- Run the web app: `npm run dev:web` (from repo root).
- Open **http://localhost:5173/dashboard/** (Vite serves the app under the same base path).
