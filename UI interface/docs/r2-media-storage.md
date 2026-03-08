# R2 Media Storage Setup

This project now supports storing images in Cloudflare R2 while keeping only metadata in Postgres.

## What is included

- DB metadata table: `media_assets`
- Upload base64 image endpoint: `POST /api/media/upload`
- Ingest-from-URL endpoint: `POST /api/media/ingest`
- List assets endpoint: `GET /api/media`
- Signed URL endpoint: `GET /api/media/:id/signed-url`
- Signed file serving endpoint: `GET /api/media/file/:id?expires=...&sig=...`
- Delete endpoint: `DELETE /api/media/:id`

## 1) Create R2 buckets

From `apps/api`:

```bash
npx wrangler r2 bucket create atriveo-media
npx wrangler r2 bucket create atriveo-media-dev
```

## 2) Add R2 binding in `apps/api/wrangler.toml`

Uncomment and use:

```toml
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "atriveo-media"
preview_bucket_name = "atriveo-media-dev"
```

## 3) Add secrets/vars

Set a strong signing secret (required for signed URLs):

```bash
npx wrangler secret put MEDIA_URL_SIGNING_SECRET --env production
npx wrangler secret put MEDIA_URL_SIGNING_SECRET --env staging
```

Optional public URL base (if your bucket is exposed via custom/public domain):

```toml
[vars]
MEDIA_PUBLIC_BASE_URL = "https://media.example.com"
```

For local dev (`apps/api/.dev.vars`):

```env
MEDIA_URL_SIGNING_SECRET=replace-with-long-random-secret
MEDIA_PUBLIC_BASE_URL=
```

## 4) Run DB migration

From project root (`UI interface`):

```bash
DATABASE_URL='postgresql://...' npm run migrate -w @job-tracker/api
```

This applies `db/migrations/031_media_assets_r2.sql`.

## 5) Endpoint examples

### Upload base64

```bash
curl -X POST http://127.0.0.1:8787/api/media/upload \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "avatar.png",
    "mime_type": "image/png",
    "data_base64": "<base64>",
    "kind": "profile"
  }'
```

### Ingest external image once

```bash
curl -X POST http://127.0.0.1:8787/api/media/ingest \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://example.com/logo.png",
    "kind": "job"
  }'
```

### Get signed URL

```bash
curl "http://127.0.0.1:8787/api/media/123/signed-url?ttl=900" \
  -H "Authorization: Bearer <token>"
```

Use returned `signed_url` directly in `<img src="...">`.
