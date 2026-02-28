# Private Job Tracker Dashboard

React dashboard + Cloudflare Worker API + Postgres database.

## Project structure

- `db/migrations/*.sql` - ordered Postgres schema migrations
- `scripts/run_migration.py` - run all DB migrations
- `scripts/import_xlsx.py` - one-time importer from `Job Tracker by Resumary.com.xlsx`
- `apps/api` - Cloudflare Worker API (runs locally with `wrangler dev`)
- `apps/web` - React dashboard
- `docker-compose.yml` - local Postgres (`db` service)

## Local run (recommended)

1. Install dependencies:
   - `npm install`
   - `pip3 install -r scripts/requirements.txt`
2. Start local Postgres:
   - `npm run db:up`
3. Set DB URL for this terminal:
   - `export DATABASE_URL='postgresql://job_tracker:job_tracker@127.0.0.1:5432/job_tracker'`
4. Run migrations + import workbook:
   - `npm run db:migrate`
   - `npm run db:import`
5. Seed login users (no signup flow):
   - `npm run users:seed`
   - First run: creates 4 default users and prints passwords.
   - Next runs: keeps existing passwords unchanged.
   - To rotate all passwords intentionally: `npm run users:reset-passwords`
6. Configure API local env:
   - `cp apps/api/.dev.vars.example apps/api/.dev.vars`
   - In `apps/api/.dev.vars`, set `NEON_DATABASE_URL=$DATABASE_URL` (or paste a Neon URL directly)
7. Configure web local env:
   - `cp apps/web/.env.example apps/web/.env`
   - Set `VITE_API_URL=http://127.0.0.1:8787`
   - Leave `VITE_API_TOKEN=` empty unless you set `API_SHARED_TOKEN`
8. Run apps (two terminals):
   - Terminal A: `npm run dev:api`
   - Terminal B: `npm run dev:web`
9. Open:
   - `http://localhost:5173/dashboard/`

## Using your Neon DB URL instead of local Postgres

If you want to use Neon directly (including the `psql 'postgresql://...'` URL you shared):

1. Export it:
   - `export DATABASE_URL='postgresql://...your-neon-url...'`
2. Run:
   - `npm run db:migrate`
   - `npm run db:import`
   - `npm run users:seed`
3. Put the same URL in `apps/api/.dev.vars` as:
   - `NEON_DATABASE_URL=postgresql://...your-neon-url...`

You do not need `docker compose` in this Neon mode.

## Useful commands

- `npm run db:up` - start local Postgres
- `npm run db:down` - stop local Postgres
- `npm run db:migrate` - apply all migrations
- `npm run db:import` - import workbook into DB
- `npm run users:seed` - create users once; keep passwords unchanged later
- `npm run users:reset-passwords` - force-generate new passwords for all seeded users
- `npm run dev:api` - run Worker API locally
- `npm run dev:web` - run React app locally
