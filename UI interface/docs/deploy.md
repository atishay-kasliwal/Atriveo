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

The tracker landing lives at `/` and the authenticated dashboard continues at **`/dashboard`** on `tracker.atriveo.com`.
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

## 7) Map the tracker domain

**Tracker landing at `/`, dashboard at `/dashboard` on the same Pages deployment**

- Production is exposed at **`tracker.atriveo.com`** through the `atriveo-tracker-router` Cloudflare Worker in `infra/tracker-router`.
- The router proxies the existing `noobly.pages.dev` deployment and lets `atriveo.com` serve the separate brand site.
- The Pages SPA handles `/` and `/dashboard` automatically because client-side routing uses `VITE_APP_BASE=/`.

**If another site already lives at the apex:**

- Put a small Cloudflare Worker in front of the apex that proxies `/dashboard` (and `/dashboard/*`) to the Pages deployment while letting other routes hit the existing origin. The landing page can stay on the existing origin or the Worker can also proxy `/` to Pages.

**Local dev**

- Run the web app: `npm run dev:web` (from repo root).
- Open **http://localhost:5173/dashboard/** (Vite serves the app under the same base path).

## 8) Tracker cutover checklist

- **Domain**: deploy `infra/tracker-router/wrangler.toml`; its Worker custom domain provisions DNS and TLS for `tracker.atriveo.com`.
- **API**: Workers stay on `job-tracker-api` / `job-tracker-api-staging`. If you want a branded hostname, add a Worker route like `api.atriveo.com/*` pointing to the production Worker.
- **Env**: confirm `SIGNUPS_ENABLED=true`, set `RESET_PASSWORD_URL_BASE=https://tracker.atriveo.com/?token=`, and keep `VITE_APP_BASE=/`.
- **OAuth**: authorize `https://tracker.atriveo.com` in the Google OAuth web client.
- **Analytics**: report the tracker and brand hosts separately.
- **Graceful migration**: redirect legacy `/dashboard/*` requests on the apex to the same tracker path when the brand site takes over.
