import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  authMiddleware,
  createSession,
  hashPassword,
  normalizeEmail,
  revokeSession,
  verifyPassword,
} from "./auth";
import { query, transaction, type SqlStatement } from "./db";
import type { AuthUser, Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: { authUser: AuthUser } }>();
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) => c.json({ name: "job-tracker-api", docs: "Use /api/* endpoints. GET /health for health check." }));
app.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV ?? "unknown" }));
app.patch("/health", (c) => c.json({ ok: true, method: "PATCH" }));

app.get("/auth-check", (c) => {
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return c.json({ authorizationHeaderPresent: Boolean(bearer) });
});

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

const googleAuthInput = z.object({
  id_token: z.string().min(20).max(4096),
});

const signupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
});

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

const MAX_FRIENDS = 10;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NETWORK_REQUIRED_VISIBILITY_FIELDS = ["share_company", "share_role", "share_applied_at", "share_job_application_id"] as const;
const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MEDIA_SIGNED_URL_DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes
const MEDIA_SIGNED_URL_MAX_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MEDIA_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);
const MEDIA_MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const MEDIA_SELECT_COLUMNS = `
  id,
  user_id,
  object_key,
  bucket_name,
  original_filename,
  mime_type,
  byte_size,
  sha256_hex,
  source_url,
  kind,
  related_job_id,
  related_note_id,
  created_at::text AS created_at,
  updated_at::text AS updated_at,
  deleted_at::text AS deleted_at
`;

function parseAnchorDay(rawAnchor: string | undefined): string | null {
  return rawAnchor && ISO_DATE_REGEX.test(rawAnchor) ? rawAnchor : null;
}

type UserFieldVisibility = {
  share_company: boolean;
  share_role: boolean;
  share_applied_at: boolean;
  share_oa_status: boolean;
  share_oa_deadline: boolean;
  share_referral_used: boolean;
  share_notes: boolean;
  share_job_application_id: boolean;
};

const DEFAULT_USER_FIELD_VISIBILITY: UserFieldVisibility = {
  share_company: true,
  share_role: true,
  share_applied_at: true,
  share_oa_status: true,
  share_oa_deadline: true,
  share_referral_used: true,
  share_notes: true,
  share_job_application_id: true,
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "t" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "f" || raw === "0" || raw === "no") return false;
  return fallback;
}

function normalizeUserFieldVisibility(row: Record<string, unknown> | undefined): UserFieldVisibility {
  return {
    share_company: toBoolean(row?.share_company, DEFAULT_USER_FIELD_VISIBILITY.share_company),
    share_role: toBoolean(row?.share_role, DEFAULT_USER_FIELD_VISIBILITY.share_role),
    share_applied_at: toBoolean(row?.share_applied_at, DEFAULT_USER_FIELD_VISIBILITY.share_applied_at),
    share_oa_status: toBoolean(row?.share_oa_status, DEFAULT_USER_FIELD_VISIBILITY.share_oa_status),
    share_oa_deadline: toBoolean(row?.share_oa_deadline, DEFAULT_USER_FIELD_VISIBILITY.share_oa_deadline),
    share_referral_used: toBoolean(row?.share_referral_used, DEFAULT_USER_FIELD_VISIBILITY.share_referral_used),
    share_notes: toBoolean(row?.share_notes, DEFAULT_USER_FIELD_VISIBILITY.share_notes),
    share_job_application_id: toBoolean(row?.share_job_application_id, DEFAULT_USER_FIELD_VISIBILITY.share_job_application_id),
  };
}

function applyRequiredVisibilityFields(visibility: UserFieldVisibility): UserFieldVisibility {
  return {
    ...visibility,
    share_company: true,
    share_role: true,
    share_applied_at: true,
    share_job_application_id: true,
  };
}

async function ensureUserFieldVisibility(env: Bindings, userId: number): Promise<UserFieldVisibility> {
  const [row] = await query<Record<string, unknown>>(
    env,
    `
    INSERT INTO user_field_visibility (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO UPDATE
      SET user_id = EXCLUDED.user_id
    RETURNING share_company, share_role, share_applied_at, share_oa_status, share_oa_deadline, share_referral_used, share_notes, share_job_application_id
    `,
    [userId],
  );
  return applyRequiredVisibilityFields(normalizeUserFieldVisibility(row));
}

const friendRequestInput = z.object({
  receiver_id: z.coerce.number().int().positive().optional(),
  email: z.string().email().optional(),
});

const mediaKindSchema = z.enum(["general", "profile", "job", "note", "network", "other"]);

const mediaUploadInput = z.object({
  file_name: z.string().trim().max(255).optional(),
  mime_type: z.string().trim().min(1).max(120),
  data_base64: z.string().trim().min(8),
  kind: mediaKindSchema.optional(),
  source_url: z.string().url().max(2048).optional(),
  related_job_id: z.number().int().positive().nullable().optional(),
  related_note_id: z.number().int().positive().nullable().optional(),
});

const mediaIngestInput = z.object({
  source_url: z.string().url().max(2048),
  file_name: z.string().trim().max(255).optional(),
  mime_type: z.string().trim().min(1).max(120).optional(),
  kind: mediaKindSchema.optional(),
  related_job_id: z.number().int().positive().nullable().optional(),
  related_note_id: z.number().int().positive().nullable().optional(),
});

type MediaAssetRow = {
  id: number;
  user_id: number;
  object_key: string;
  bucket_name: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  sha256_hex: string;
  source_url: string | null;
  kind: string;
  related_job_id: number | null;
  related_note_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

function normalizeMimeType(raw: string): string {
  const first = String(raw ?? "").split(";")[0] || "";
  return first.trim().toLowerCase();
}

function sanitizeFileName(rawName: string | undefined): string | null {
  const cleaned = String(rawName ?? "")
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 255);
  return cleaned || null;
}

function getBase64Payload(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  const dataUrlMatch = /^data:[^;]+;base64,(.+)$/i.exec(trimmed);
  return (dataUrlMatch ? dataUrlMatch[1] : trimmed).replace(/\s+/g, "");
}

function decodeBase64ToBytes(rawBase64: string): Uint8Array {
  const payload = getBase64Payload(rawBase64);
  if (!payload) return new Uint8Array();
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function extensionFromMimeType(mimeType: string, fileName?: string): string {
  const fromMime = MEDIA_MIME_EXTENSION_MAP[mimeType];
  if (fromMime) return fromMime;
  const cleanedFileName = sanitizeFileName(fileName);
  const fromName = cleanedFileName?.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{1,8}$/.test(fromName) ? fromName : "bin";
}

function buildObjectKey(userId: number, mimeType: string, fileName?: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = extensionFromMimeType(mimeType, fileName);
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `u${userId}/${yyyy}/${mm}/${uuid}.${ext}`;
}

function normalizeSignedTtlSeconds(raw: string | undefined): number {
  const ttl = Number(raw ?? MEDIA_SIGNED_URL_DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(ttl) || ttl <= 0) return MEDIA_SIGNED_URL_DEFAULT_TTL_SECONDS;
  return Math.min(Math.floor(ttl), MEDIA_SIGNED_URL_MAX_TTL_SECONDS);
}

function getMediaBucket(env: Bindings): R2Bucket | null {
  return env.MEDIA_BUCKET ?? null;
}

function getMediaSigningSecret(env: Bindings): string {
  return String(env.MEDIA_URL_SIGNING_SECRET ?? env.API_SHARED_TOKEN ?? "").trim();
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function signMediaPayload(secret: string, payload: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const payloadBytes = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secretBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(payloadBytes));
  return bytesToHex(new Uint8Array(signature));
}

function getMediaPublicUrl(env: Bindings, objectKey: string): string | null {
  const base = String(env.MEDIA_PUBLIC_BASE_URL ?? "").trim();
  if (!base) return null;
  try {
    const url = new URL(base.endsWith("/") ? base : `${base}/`);
    const prefix = url.pathname.replace(/\/+$/, "");
    const encodedPath = objectKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    url.pathname = `${prefix}/${encodedPath}`.replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return null;
  }
}

async function buildSignedMediaUrl(
  c: { env: Bindings; req: { url: string } },
  row: Pick<MediaAssetRow, "id" | "object_key">,
  ttlSeconds = MEDIA_SIGNED_URL_DEFAULT_TTL_SECONDS,
): Promise<string | null> {
  const secret = getMediaSigningSecret(c.env);
  if (!secret) return null;
  const expires = Math.floor(Date.now() / 1000) + normalizeSignedTtlSeconds(String(ttlSeconds));
  const payload = `${row.id}:${row.object_key}:${expires}`;
  const sig = await signMediaPayload(secret, payload);
  const origin = new URL(c.req.url).origin;
  return `${origin}/api/media/file/${row.id}?expires=${expires}&sig=${sig}`;
}

async function toMediaAssetResponse(
  c: { env: Bindings; req: { url: string } },
  row: MediaAssetRow,
  ttlSeconds = MEDIA_SIGNED_URL_DEFAULT_TTL_SECONDS,
) {
  return {
    id: Number(row.id),
    object_key: String(row.object_key),
    bucket_name: String(row.bucket_name),
    file_name: row.original_filename ?? null,
    mime_type: String(row.mime_type),
    byte_size: Number(row.byte_size ?? 0),
    sha256_hex: String(row.sha256_hex),
    source_url: row.source_url ?? null,
    kind: String(row.kind || "general"),
    related_job_id: row.related_job_id ?? null,
    related_note_id: row.related_note_id ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: row.deleted_at ?? null,
    public_url: getMediaPublicUrl(c.env, String(row.object_key)),
    signed_url: await buildSignedMediaUrl(c, row, ttlSeconds),
  };
}

type PersistMediaAssetInput = {
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
  sourceUrl?: string;
  kind?: z.infer<typeof mediaKindSchema>;
  relatedJobId?: number | null;
  relatedNoteId?: number | null;
};

async function persistMediaAsset(
  env: Bindings,
  userId: number,
  payload: PersistMediaAssetInput,
): Promise<{ row: MediaAssetRow; deduplicated: boolean }> {
  const bucket = getMediaBucket(env);
  if (!bucket) throw new Error("MEDIA_BUCKET binding is not configured.");

  const sha256Hex = await sha256HexBytes(payload.bytes);
  const [existing] = await query<MediaAssetRow>(
    env,
    `
    SELECT ${MEDIA_SELECT_COLUMNS}
    FROM media_assets
    WHERE user_id = $1
      AND sha256_hex = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId, sha256Hex],
  );

  if (existing) {
    const existingObject = await bucket.head(existing.object_key);
    if (!existingObject) {
      await bucket.put(existing.object_key, payload.bytes, {
        httpMetadata: { contentType: payload.mimeType },
        customMetadata: {
          user_id: String(userId),
          kind: payload.kind ?? existing.kind ?? "general",
          sha256_hex: sha256Hex,
        },
      });
    }
    return { row: existing, deduplicated: true };
  }

  const objectKey = buildObjectKey(userId, payload.mimeType, payload.fileName);
  await bucket.put(objectKey, payload.bytes, {
    httpMetadata: { contentType: payload.mimeType },
    customMetadata: {
      user_id: String(userId),
      kind: payload.kind ?? "general",
      sha256_hex: sha256Hex,
    },
  });

  const [inserted] = await query<MediaAssetRow>(
    env,
    `
    INSERT INTO media_assets (
      user_id,
      object_key,
      bucket_name,
      original_filename,
      mime_type,
      byte_size,
      sha256_hex,
      source_url,
      kind,
      related_job_id,
      related_note_id
    )
    VALUES ($1, $2, 'MEDIA_BUCKET', $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING ${MEDIA_SELECT_COLUMNS}
    `,
    [
      userId,
      objectKey,
      sanitizeFileName(payload.fileName),
      payload.mimeType,
      payload.bytes.byteLength,
      sha256Hex,
      payload.sourceUrl ?? null,
      payload.kind ?? "general",
      payload.relatedJobId ?? null,
      payload.relatedNoteId ?? null,
    ],
  );

  if (!inserted) throw new Error("Unable to store media metadata.");
  return { row: inserted, deduplicated: false };
}

function areSignupsEnabled(env: Bindings): boolean {
  const raw = env.SIGNUPS_ENABLED ?? env.ALLOW_SIGNUPS;
  if (raw == null) return true; // default to enabled for launch; allow opt-out via env
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

type GoogleTokenInfoResponse = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  iss?: string;
  given_name?: string;
  family_name?: string;
};

function getAllowedGoogleClientIds(env: Bindings): Set<string> {
  const rawIds = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_IDS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(rawIds);
}

function isGoogleEmailVerified(value: unknown): boolean {
  if (value === true) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

async function verifyGoogleIdToken(
  env: Bindings,
  idToken: string,
): Promise<
  | { email: string; givenName: string | null; familyName: string | null }
  | { error: string; status: 401 | 503 }
> {
  const allowedClientIds = getAllowedGoogleClientIds(env);
  if (allowedClientIds.size === 0) {
    return { error: "Google sign-in is not configured for this environment.", status: 503 };
  }

  let payload: GoogleTokenInfoResponse;
  try {
    const response = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      return { error: "Invalid Google credential. Please try again.", status: 401 };
    }
    payload = (await response.json()) as GoogleTokenInfoResponse;
  } catch {
    return { error: "Unable to verify Google credential right now. Please try again.", status: 503 };
  }

  const audience = String(payload.aud ?? "").trim();
  if (!audience || !allowedClientIds.has(audience)) {
    return { error: "Google credential does not match this app.", status: 401 };
  }

  const issuer = String(payload.iss ?? "").trim();
  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
    return { error: "Invalid Google token issuer.", status: 401 };
  }

  const expirationUnix = Number(payload.exp ?? 0);
  const nowUnix = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expirationUnix) || expirationUnix <= nowUnix) {
    return { error: "Google credential has expired. Please sign in again.", status: 401 };
  }

  if (!isGoogleEmailVerified(payload.email_verified)) {
    return { error: "Google account email must be verified.", status: 401 };
  }

  const email = normalizeEmail(String(payload.email ?? ""));
  if (!email) {
    return { error: "Google account email was not provided.", status: 401 };
  }

  const givenName = String(payload.given_name ?? "").trim() || null;
  const familyName = String(payload.family_name ?? "").trim() || null;
  return { email, givenName, familyName };
}

const targetsUpsertInput = z.object({
  daily_target: z.number().int().min(0).nullable().optional(),
  weekly_target: z.number().int().min(0).nullable().optional(),
  monthly_target: z.number().int().min(0).nullable().optional(),
});

app.post("/auth/signup", async (c) => {
  if (!areSignupsEnabled(c.env)) {
    return c.json({ error: "Signup is disabled for this environment." }, 403);
  }

  const parsed = signupInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const email = normalizeEmail(parsed.data.email);
  const firstName = parsed.data.first_name?.trim() || null;
  const lastName = parsed.data.last_name?.trim() || null;

  const [existing] = await query<{ id: number; password_hash: string | null; first_name: string | null; last_name: string | null }>(
    c.env,
    "SELECT id, password_hash, first_name, last_name FROM dashboard_users WHERE LOWER(email) = $1 LIMIT 1",
    [email],
  );

  if (existing?.password_hash) {
    return c.json({ error: "Account already exists. Please log in." }, 409);
  }

  const { hash, salt, iterations } = await hashPassword(parsed.data.password);

  const [user] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
    c.env,
    `
    INSERT INTO dashboard_users (email, password_hash, password_salt, password_iterations, first_name, last_name)
    VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''))
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      password_iterations = EXCLUDED.password_iterations,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), dashboard_users.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), dashboard_users.last_name),
      updated_at = NOW()
    RETURNING id, email, first_name, last_name
    `,
    [email, hash, salt, iterations, firstName ?? "", lastName ?? ""],
  );

  if (!user) {
    return c.json({ error: "Unable to create account right now." }, 500);
  }

  const token = await createSession(c.env, Number(user.id));
  return c.json(
    {
      token,
      user: {
        id: Number(user.id),
        email: String(user.email),
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
      },
    },
    201,
  );
});

app.post("/auth/login", async (c) => {
  const parsed = loginInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const email = normalizeEmail(parsed.data.email);
  const [user] = await query<{
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    password_hash: string | null;
    password_salt: string | null;
    password_iterations: number | null;
  }>(
    c.env,
    `
    SELECT id, email, first_name, last_name, password_hash, password_salt, password_iterations
    FROM dashboard_users
    WHERE email = $1
    LIMIT 1
    `,
    [email],
  );

  if (!user?.password_hash || !user?.password_salt) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const passwordOk = await verifyPassword(
    parsed.data.password,
    user.password_hash,
    user.password_salt,
    Number(user.password_iterations ?? 100000),
  );
  if (!passwordOk) {
    return c.json({ error: "Invalid email or password." }, 401);
  }

  const token = await createSession(c.env, Number(user.id));
  return c.json({
    token,
    user: {
      id: Number(user.id),
      email: String(user.email),
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
    },
  });
});

app.post("/auth/google", async (c) => {
  const parsed = googleAuthInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const verified = await verifyGoogleIdToken(c.env, parsed.data.id_token);
  if ("error" in verified) {
    return c.json({ error: verified.error }, verified.status);
  }

  const [existingUser] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
    c.env,
    `
    SELECT id, email, first_name, last_name
    FROM dashboard_users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [verified.email],
  );

  if (!existingUser && !areSignupsEnabled(c.env)) {
    return c.json({ error: "Signup is disabled for this environment." }, 403);
  }

  let user = existingUser;
  let created = false;
  if (!user) {
    created = true;
    const [insertedUser] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
      c.env,
      `
      INSERT INTO dashboard_users (email, first_name, last_name)
      VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))
      RETURNING id, email, first_name, last_name
      `,
      [verified.email, verified.givenName ?? "", verified.familyName ?? ""],
    );
    user = insertedUser;
  } else if ((!user.first_name && verified.givenName) || (!user.last_name && verified.familyName)) {
    const [updatedUser] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
      c.env,
      `
      UPDATE dashboard_users
      SET
        first_name = COALESCE(NULLIF(first_name, ''), NULLIF($2, '')),
        last_name = COALESCE(NULLIF(last_name, ''), NULLIF($3, '')),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, first_name, last_name
      `,
      [Number(user.id), verified.givenName ?? "", verified.familyName ?? ""],
    );
    user = updatedUser ?? user;
  }

  if (!user) {
    return c.json({ error: "Unable to complete Google sign-in right now." }, 500);
  }

  const token = await createSession(c.env, Number(user.id));
  return c.json(
    {
      token,
      user: {
        id: Number(user.id),
        email: String(user.email),
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
      },
    },
    created ? 201 : 200,
  );
});

// Public route intended for short-lived signed URLs generated by /api/media/:id/signed-url.
app.get("/api/media/file/:id", async (c) => {
  const mediaId = Number(c.req.param("id"));
  const expiresRaw = c.req.query("expires");
  const sig = String(c.req.query("sig") ?? "").trim().toLowerCase();
  const expires = Number(expiresRaw ?? 0);

  if (!Number.isFinite(mediaId) || mediaId <= 0) {
    return c.json({ error: "Invalid media id." }, 400);
  }
  if (!Number.isFinite(expires) || expires <= 0 || !sig) {
    return c.json({ error: "Missing or invalid signature query parameters." }, 401);
  }
  if (Math.floor(Date.now() / 1000) > Math.floor(expires)) {
    return c.json({ error: "Signed URL has expired." }, 401);
  }

  const bucket = getMediaBucket(c.env);
  if (!bucket) return c.json({ error: "MEDIA_BUCKET binding is not configured." }, 503);

  const [row] = await query<MediaAssetRow>(
    c.env,
    `
    SELECT ${MEDIA_SELECT_COLUMNS}
    FROM media_assets
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [mediaId],
  );
  if (!row) return c.json({ error: "Media asset not found." }, 404);

  const secret = getMediaSigningSecret(c.env);
  if (!secret) return c.json({ error: "Media signing secret is not configured." }, 503);
  const expectedSig = await signMediaPayload(secret, `${row.id}:${row.object_key}:${Math.floor(expires)}`);
  if (!timingSafeEqualHex(expectedSig, sig)) {
    return c.json({ error: "Invalid media signature." }, 401);
  }

  const object = await bucket.get(row.object_key);
  if (!object) return c.json({ error: "Media object not found in storage." }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || row.mime_type || "application/octet-stream");
  if (object.size != null) headers.set("Content-Length", String(object.size));
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=300");

  if (c.req.query("download") === "1") {
    const safeFileName = sanitizeFileName(row.original_filename ?? undefined) ?? `media-${row.id}`;
    headers.set("Content-Disposition", `attachment; filename="${safeFileName.replace(/"/g, "")}"`);
  } else if (row.original_filename) {
    const safeFileName = sanitizeFileName(row.original_filename) ?? `media-${row.id}`;
    headers.set("Content-Disposition", `inline; filename="${safeFileName.replace(/"/g, "")}"`);
  }

  return new Response(object.body, { status: 200, headers });
});

app.use("/api/*", authMiddleware);

app.get("/api/auth/me", (c) => {
  return c.json({ user: c.get("authUser") });
});

app.post("/api/auth/logout", async (c) => {
  const rawBearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const bearer = rawBearer ? rawBearer.trim() : "";
  if (bearer) {
    await revokeSession(c.env, bearer);
  }
  return c.json({ ok: true });
});

app.post("/api/media/upload", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = mediaUploadInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const payload = parsed.data;
  const mimeType = normalizeMimeType(payload.mime_type);
  if (!MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
    return c.json({ error: "Unsupported media type. Only common image formats are allowed." }, 415);
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64ToBytes(payload.data_base64);
  } catch {
    return c.json({ error: "Invalid base64 payload." }, 400);
  }

  if (!bytes.byteLength) {
    return c.json({ error: "File payload is empty." }, 400);
  }
  if (bytes.byteLength > MEDIA_MAX_BYTES) {
    return c.json({ error: `File too large. Max ${Math.floor(MEDIA_MAX_BYTES / (1024 * 1024))} MB.` }, 413);
  }

  const { row, deduplicated } = await persistMediaAsset(c.env, userId, {
    bytes,
    mimeType,
    fileName: payload.file_name,
    sourceUrl: payload.source_url,
    kind: payload.kind,
    relatedJobId: payload.related_job_id,
    relatedNoteId: payload.related_note_id,
  });

  const data = await toMediaAssetResponse(c, row);
  return c.json({ data, deduplicated }, deduplicated ? 200 : 201);
});

app.post("/api/media/ingest", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = mediaIngestInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const payload = parsed.data;

  let remote: Response;
  try {
    remote = await fetch(payload.source_url, { method: "GET", redirect: "follow" });
  } catch {
    return c.json({ error: "Unable to reach source URL for ingestion." }, 502);
  }
  if (!remote.ok) {
    return c.json({ error: `Source URL returned ${remote.status}.` }, 502);
  }

  const mimeType = normalizeMimeType(payload.mime_type || remote.headers.get("content-type") || "");
  if (!MEDIA_ALLOWED_MIME_TYPES.has(mimeType)) {
    return c.json({ error: "Source URL is not a supported image format." }, 415);
  }

  const bytes = new Uint8Array(await remote.arrayBuffer());
  if (!bytes.byteLength) return c.json({ error: "Fetched source file is empty." }, 400);
  if (bytes.byteLength > MEDIA_MAX_BYTES) {
    return c.json({ error: `Source file too large. Max ${Math.floor(MEDIA_MAX_BYTES / (1024 * 1024))} MB.` }, 413);
  }

  let inferredFileName = payload.file_name;
  if (!inferredFileName) {
    try {
      const sourceUrl = new URL(payload.source_url);
      const tail = sourceUrl.pathname.split("/").filter(Boolean).pop();
      inferredFileName = tail ? decodeURIComponent(tail) : undefined;
    } catch {
      inferredFileName = undefined;
    }
  }

  const { row, deduplicated } = await persistMediaAsset(c.env, userId, {
    bytes,
    mimeType,
    fileName: inferredFileName,
    sourceUrl: payload.source_url,
    kind: payload.kind,
    relatedJobId: payload.related_job_id,
    relatedNoteId: payload.related_note_id,
  });

  const data = await toMediaAssetResponse(c, row);
  return c.json({ data, deduplicated }, deduplicated ? 200 : 201);
});

app.get("/api/media", async (c) => {
  const userId = c.get("authUser").id;
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25) || 25, 1), 100);
  const ttl = normalizeSignedTtlSeconds(c.req.query("ttl"));
  const kindRaw = c.req.query("kind");
  const offset = (page - 1) * limit;

  let kind: z.infer<typeof mediaKindSchema> | null = null;
  if (kindRaw) {
    const parsedKind = mediaKindSchema.safeParse(kindRaw);
    if (!parsedKind.success) return c.json({ error: "Invalid kind filter." }, 400);
    kind = parsedKind.data;
  }

  const whereParts: string[] = ["user_id = $1", "deleted_at IS NULL"];
  const params: unknown[] = [userId];
  let paramIndex = 2;
  if (kind) {
    whereParts.push(`kind = $${paramIndex}`);
    params.push(kind);
    paramIndex += 1;
  }
  const whereClause = `WHERE ${whereParts.join(" AND ")}`;

  const [countRow] = await query<{ total: number }>(
    c.env,
    `SELECT COUNT(*)::int AS total FROM media_assets ${whereClause}`,
    params,
  );

  const rows = await query<MediaAssetRow>(
    c.env,
    `
    SELECT ${MEDIA_SELECT_COLUMNS}
    FROM media_assets
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    [...params, limit, offset],
  );

  const data = await Promise.all(rows.map((row) => toMediaAssetResponse(c, row, ttl)));
  return c.json({
    page,
    limit,
    total: Number(countRow?.total ?? 0),
    data,
  });
});

app.get("/api/media/:id/signed-url", async (c) => {
  const userId = c.get("authUser").id;
  const mediaId = Number(c.req.param("id"));
  if (!Number.isFinite(mediaId) || mediaId <= 0) return c.json({ error: "Invalid media id." }, 400);

  const [row] = await query<MediaAssetRow>(
    c.env,
    `
    SELECT ${MEDIA_SELECT_COLUMNS}
    FROM media_assets
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [mediaId, userId],
  );
  if (!row) return c.json({ error: "Media asset not found." }, 404);

  const ttl = normalizeSignedTtlSeconds(c.req.query("ttl"));
  const signedUrl = await buildSignedMediaUrl(c, row, ttl);
  if (!signedUrl) return c.json({ error: "Media signing secret is not configured." }, 503);

  return c.json({
    id: Number(row.id),
    ttl_seconds: ttl,
    signed_url: signedUrl,
    public_url: getMediaPublicUrl(c.env, row.object_key),
  });
});

app.delete("/api/media/:id", async (c) => {
  const userId = c.get("authUser").id;
  const mediaId = Number(c.req.param("id"));
  if (!Number.isFinite(mediaId) || mediaId <= 0) return c.json({ error: "Invalid media id." }, 400);

  const [row] = await query<MediaAssetRow>(
    c.env,
    `
    SELECT ${MEDIA_SELECT_COLUMNS}
    FROM media_assets
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [mediaId, userId],
  );
  if (!row) return c.json({ error: "Media asset not found." }, 404);

  const bucket = getMediaBucket(c.env);
  if (!bucket) return c.json({ error: "MEDIA_BUCKET binding is not configured." }, 503);
  await bucket.delete(row.object_key);

  await query(
    c.env,
    `
    UPDATE media_assets
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1
      AND user_id = $2
    `,
    [mediaId, userId],
  );

  return c.json({ ok: true, id: mediaId });
});

app.get("/api/targets", async (c) => {
  const userId = c.get("authUser").id;
  const [row] = await query<{
    daily_target: number | null;
    weekly_target: number | null;
    monthly_target: number | null;
  }>(
    c.env,
    `
    SELECT daily_target, weekly_target, monthly_target
    FROM user_targets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  );
  return c.json({
    daily_target: row?.daily_target ?? null,
    weekly_target: row?.weekly_target ?? null,
    monthly_target: row?.monthly_target ?? null,
  });
});

app.put("/api/targets", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = targetsUpsertInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  if (
    p.daily_target === undefined &&
    p.weekly_target === undefined &&
    p.monthly_target === undefined
  ) {
    return c.json({ error: "At least one target field is required." }, 400);
  }

  const [row] = await query<{
    daily_target: number | null;
    weekly_target: number | null;
    monthly_target: number | null;
  }>(
    c.env,
    `
    INSERT INTO user_targets (user_id, daily_target, weekly_target, monthly_target)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET
      daily_target = COALESCE(EXCLUDED.daily_target, user_targets.daily_target),
      weekly_target = COALESCE(EXCLUDED.weekly_target, user_targets.weekly_target),
      monthly_target = COALESCE(EXCLUDED.monthly_target, user_targets.monthly_target),
      updated_at = NOW()
    RETURNING daily_target, weekly_target, monthly_target
    `,
    [
      userId,
      p.daily_target === undefined ? null : p.daily_target,
      p.weekly_target === undefined ? null : p.weekly_target,
      p.monthly_target === undefined ? null : p.monthly_target,
    ],
  );

  return c.json({
    ok: true,
    daily_target: row?.daily_target ?? null,
    weekly_target: row?.weekly_target ?? null,
    monthly_target: row?.monthly_target ?? null,
  });
});

app.get("/api/targets/progress", async (c) => {
  const userId = c.get("authUser").id;
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));

  const [targets] = await query<{
    daily_target: number | null;
    weekly_target: number | null;
    monthly_target: number | null;
  }>(
    c.env,
    `
    SELECT daily_target, weekly_target, monthly_target
    FROM user_targets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const [daily] = await query<{ count: string }>(
    c.env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved::date = COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );

  const [weekly] = await query<{ count: string }>(
    c.env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved >= DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))
      AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );

  const [monthly] = await query<{ count: string }>(
    c.env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved >= DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
      AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );

  return c.json({
    anchorDay: anchorDay ?? null,
    daily: {
      current: Number(daily?.count ?? 0),
      target: targets?.daily_target ?? null,
    },
    weekly: {
      current: Number(weekly?.count ?? 0),
      target: targets?.weekly_target ?? null,
    },
    monthly: {
      current: Number(monthly?.count ?? 0),
      target: targets?.monthly_target ?? null,
    },
  });
});

app.get("/api/friends", async (c) => {
  const userId = c.get("authUser").id;
  const rows = await query<{
    friendship_id: number;
    status: string;
    created_at: string;
    accepted_at: string | null;
    friend_id: number;
    friend_email: string;
    friend_name: string;
  }>(
    c.env,
    `
    SELECT
      f.id AS friendship_id,
      f.status,
      f.created_at::text AS created_at,
      f.accepted_at::text AS accepted_at,
      u.id AS friend_id,
      u.email AS friend_email,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name
    FROM friendships f
    JOIN dashboard_users u
      ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
    WHERE (f.requester_id = $1 OR f.receiver_id = $1)
      AND f.status = 'accepted'
    ORDER BY LOWER(COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email)) ASC, LOWER(u.email) ASC
    `,
    [userId],
  );
  return c.json({ data: rows, maxFriends: MAX_FRIENDS });
});

app.get("/api/friends/requests", async (c) => {
  const userId = c.get("authUser").id;
  const [incoming, outgoing] = await Promise.all([
    query<{
      friendship_id: number;
      requester_id: number;
      requester_email: string;
      requester_name: string;
      created_at: string;
    }>(
      c.env,
      `
      SELECT
        f.id AS friendship_id,
        f.requester_id,
        u.email AS requester_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS requester_name,
        f.created_at::text AS created_at
      FROM friendships f
      JOIN dashboard_users u ON u.id = f.requester_id
      WHERE f.receiver_id = $1
        AND f.status = 'pending'
      ORDER BY f.created_at DESC, f.id DESC
      `,
      [userId],
    ),
    query<{
      friendship_id: number;
      receiver_id: number;
      receiver_email: string;
      receiver_name: string;
      created_at: string;
    }>(
      c.env,
      `
      SELECT
        f.id AS friendship_id,
        f.receiver_id,
        u.email AS receiver_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS receiver_name,
        f.created_at::text AS created_at
      FROM friendships f
      JOIN dashboard_users u ON u.id = f.receiver_id
      WHERE f.requester_id = $1
        AND f.status = 'pending'
      ORDER BY f.created_at DESC, f.id DESC
      `,
      [userId],
    ),
  ]);
  return c.json({ incoming, outgoing });
});

app.post("/api/friends/request", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = friendRequestInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const payload = parsed.data;
  if (!payload.receiver_id && !payload.email) {
    return c.json({ error: "receiver_id or email is required." }, 400);
  }

  let receiverId: number | null = null;
  if (payload.receiver_id) {
    const [receiver] = await query<{ id: number; email: string }>(
      c.env,
      "SELECT id, email FROM dashboard_users WHERE id = $1 LIMIT 1",
      [payload.receiver_id],
    );
    if (!receiver) return c.json({ error: "User not found." }, 404);
    receiverId = Number(receiver.id);
  } else {
    const normalizedEmail = normalizeEmail(String(payload.email ?? ""));
    const [receiver] = await query<{ id: number; email: string }>(
      c.env,
      "SELECT id, email FROM dashboard_users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail],
    );
    if (!receiver) return c.json({ error: "User not found." }, 404);
    receiverId = Number(receiver.id);
  }

  if (!receiverId) return c.json({ error: "User not found." }, 404);
  if (receiverId === userId) return c.json({ error: "You cannot send a friend request to yourself." }, 400);

  const [existing] = await query<{
    id: number;
    status: "pending" | "accepted" | "rejected" | "blocked";
    requester_id: number;
    receiver_id: number;
  }>(
    c.env,
    `
    SELECT id, status, requester_id, receiver_id
    FROM friendships
    WHERE LEAST(requester_id, receiver_id) = LEAST($1::bigint, $2::bigint)
      AND GREATEST(requester_id, receiver_id) = GREATEST($1::bigint, $2::bigint)
    LIMIT 1
    `,
    [userId, receiverId],
  );

  if (!existing) {
    const [created] = await query<{ id: number; status: string }>(
      c.env,
      `
      INSERT INTO friendships (requester_id, receiver_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING id, status
      `,
      [userId, receiverId],
    );
    return c.json({ ok: true, friendship: created }, 201);
  }

  if (existing.status === "accepted") {
    return c.json({ error: "You are already friends with this user." }, 409);
  }
  if (existing.status === "blocked") {
    return c.json({ error: "Friendship is unavailable for this user." }, 403);
  }
  if (existing.status === "pending") {
    if (Number(existing.requester_id) === userId) {
      return c.json({ error: "Friend request already sent." }, 409);
    }
    return c.json({ error: "This user already sent you a request. Accept it from incoming requests." }, 409);
  }

  const [reopened] = await query<{ id: number; status: string }>(
    c.env,
    `
    UPDATE friendships
    SET requester_id = $1,
        receiver_id = $2,
        status = 'pending',
        created_at = NOW(),
        updated_at = NOW(),
        accepted_at = NULL,
        rejected_at = NULL,
        blocked_at = NULL
    WHERE id = $3
    RETURNING id, status
    `,
    [userId, receiverId, existing.id],
  );
  return c.json({ ok: true, friendship: reopened }, 201);
});

app.post("/api/friends/:id/accept", async (c) => {
  const userId = c.get("authUser").id;
  const friendshipId = Number(c.req.param("id"));
  if (!Number.isFinite(friendshipId) || friendshipId <= 0) {
    return c.json({ error: "Invalid friendship id." }, 400);
  }

  const [target] = await query<{
    id: number;
    requester_id: number;
    receiver_id: number;
    status: "pending" | "accepted" | "rejected" | "blocked";
  }>(
    c.env,
    `
    SELECT id, requester_id, receiver_id, status
    FROM friendships
    WHERE id = $1
      AND receiver_id = $2
    LIMIT 1
    `,
    [friendshipId, userId],
  );
  if (!target) return c.json({ error: "Friend request not found." }, 404);
  if (target.status !== "pending") return c.json({ error: "Only pending requests can be accepted." }, 409);

  const [updated] = await query<{
    id: number;
    status: string;
    accepted_at: string;
    requester_count: number;
    receiver_count: number;
  }>(
    c.env,
    `
    WITH target AS (
      SELECT id, requester_id, receiver_id
      FROM friendships
      WHERE id = $1
        AND receiver_id = $2
        AND status = 'pending'
      LIMIT 1
    ),
    lock_requester AS (
      SELECT pg_advisory_xact_lock(requester_id::bigint) FROM target
    ),
    lock_receiver AS (
      SELECT pg_advisory_xact_lock(receiver_id::bigint) FROM target
    ),
    requester_count AS (
      SELECT COUNT(*)::int AS cnt
      FROM friendships f
      JOIN target t ON TRUE
      WHERE f.status = 'accepted'
        AND (f.requester_id = t.requester_id OR f.receiver_id = t.requester_id)
    ),
    receiver_count AS (
      SELECT COUNT(*)::int AS cnt
      FROM friendships f
      JOIN target t ON TRUE
      WHERE f.status = 'accepted'
        AND (f.requester_id = t.receiver_id OR f.receiver_id = t.receiver_id)
    )
    UPDATE friendships f
    SET status = 'accepted',
        accepted_at = NOW(),
        rejected_at = NULL,
        blocked_at = NULL,
        updated_at = NOW()
    FROM target t, lock_requester, lock_receiver, requester_count rc, receiver_count sc
    WHERE f.id = t.id
      AND rc.cnt < $3
      AND sc.cnt < $3
    RETURNING
      f.id,
      f.status,
      f.accepted_at::text AS accepted_at,
      rc.cnt AS requester_count,
      sc.cnt AS receiver_count
    `,
    [friendshipId, userId, MAX_FRIENDS],
  );

  if (!updated) {
    return c.json({ error: "Friend limit reached (max 10) for one of the users." }, 409);
  }

  return c.json({ ok: true, friendship: updated, maxFriends: MAX_FRIENDS });
});

app.post("/api/friends/:id/reject", async (c) => {
  const userId = c.get("authUser").id;
  const friendshipId = Number(c.req.param("id"));
  if (!Number.isFinite(friendshipId) || friendshipId <= 0) {
    return c.json({ error: "Invalid friendship id." }, 400);
  }

  const [row] = await query<{ id: number; status: string; rejected_at: string }>(
    c.env,
    `
    UPDATE friendships
    SET status = 'rejected',
        rejected_at = NOW(),
        accepted_at = NULL,
        blocked_at = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND receiver_id = $2
      AND status = 'pending'
    RETURNING id, status, rejected_at::text AS rejected_at
    `,
    [friendshipId, userId],
  );
  if (!row) return c.json({ error: "Pending friend request not found." }, 404);
  return c.json({ ok: true, friendship: row });
});

app.post("/api/friends/:id/block", async (c) => {
  const userId = c.get("authUser").id;
  const friendshipId = Number(c.req.param("id"));
  if (!Number.isFinite(friendshipId) || friendshipId <= 0) {
    return c.json({ error: "Invalid friendship id." }, 400);
  }

  const [row] = await query<{ id: number; status: string; blocked_at: string }>(
    c.env,
    `
    UPDATE friendships
    SET status = 'blocked',
        blocked_at = NOW(),
        accepted_at = NULL,
        rejected_at = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND (requester_id = $2 OR receiver_id = $2)
    RETURNING id, status, blocked_at::text AS blocked_at
    `,
    [friendshipId, userId],
  );
  if (!row) return c.json({ error: "Friendship not found." }, 404);
  return c.json({ ok: true, friendship: row });
});

const networkFieldVisibilityUpdateInput = z.object({
  share_company: z.boolean().optional(),
  share_role: z.boolean().optional(),
  share_applied_at: z.boolean().optional(),
  share_oa_status: z.boolean().optional(),
  share_oa_deadline: z.boolean().optional(),
  share_referral_used: z.boolean().optional(),
  share_notes: z.boolean().optional(),
  share_job_application_id: z.boolean().optional(),
});

app.get("/api/network/field-visibility", async (c) => {
  const userId = c.get("authUser").id;
  const data = await ensureUserFieldVisibility(c.env, userId);
  return c.json({ data, required_fields: NETWORK_REQUIRED_VISIBILITY_FIELDS });
});

app.patch("/api/network/field-visibility", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = networkFieldVisibilityUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const current = await ensureUserFieldVisibility(c.env, userId);
  const next = applyRequiredVisibilityFields({
    ...current,
    ...parsed.data,
  });

  const [row] = await query<Record<string, unknown>>(
    c.env,
    `
    UPDATE user_field_visibility
    SET
      share_company = $2,
      share_role = $3,
      share_applied_at = $4,
      share_oa_status = $5,
      share_oa_deadline = $6,
      share_referral_used = $7,
      share_notes = $8,
      share_job_application_id = $9,
      updated_at = NOW()
    WHERE user_id = $1
    RETURNING share_company, share_role, share_applied_at, share_oa_status, share_oa_deadline, share_referral_used, share_notes, share_job_application_id
    `,
    [
      userId,
      next.share_company,
      next.share_role,
      next.share_applied_at,
      next.share_oa_status,
      next.share_oa_deadline,
      next.share_referral_used,
      next.share_notes,
      next.share_job_application_id,
    ],
  );

  return c.json({
    data: applyRequiredVisibilityFields(normalizeUserFieldVisibility(row)),
    required_fields: NETWORK_REQUIRED_VISIBILITY_FIELDS,
  });
});

app.get("/api/network/trend", async (c) => {
  const userId = c.get("authUser").id;
  const days = Math.max(3, Math.min(30, Number(c.req.query("days") ?? 10)));
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));

  const rows = await query<{
    friend_id: number;
    friend_email: string;
    friend_name: string;
    is_self: boolean;
    day: string;
    total: number;
  }>(
    c.env,
    `
    WITH viewer_visibility AS (
      SELECT
        COALESCE(v.share_applied_at, TRUE) AS share_applied_at
      FROM (SELECT 1) seed
      LEFT JOIN user_field_visibility v ON v.user_id = $1
    ),
    network_people AS (
      SELECT
        u.id AS friend_id,
        u.email AS friend_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name,
        TRUE AS is_self
      FROM dashboard_users u
      WHERE u.id = $1
      UNION ALL
      SELECT
        CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id,
        u.email AS friend_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name,
        FALSE AS is_self
      FROM friendships f
      JOIN dashboard_users u
        ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.receiver_id = $1)
        AND f.status = 'accepted'
    ),
    days_series AS (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - ($3::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ),
    jobs_daily AS (
      SELECT
        j.user_id,
        DATE(j.date_saved) AS day,
        COUNT(*)::int AS cnt
      FROM jobs j
      CROSS JOIN viewer_visibility vv
      LEFT JOIN user_field_visibility ov ON ov.user_id = j.user_id
      WHERE j.date_saved IS NOT NULL
        AND (
          j.user_id = $1
          OR (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE))
        )
      GROUP BY j.user_id, DATE(j.date_saved)
    )
    SELECT
      np.friend_id,
      np.friend_email,
      np.friend_name,
      np.is_self,
      ds.day::text AS day,
      COALESCE(jd.cnt, 0)::int AS total
    FROM network_people np
    CROSS JOIN days_series ds
    LEFT JOIN jobs_daily jd
      ON jd.user_id = np.friend_id
     AND jd.day = ds.day
    ORDER BY np.is_self DESC, LOWER(np.friend_name) ASC, LOWER(np.friend_email) ASC, ds.day ASC
    `,
    [userId, anchorDay, days - 1],
  );

  const grouped = new Map<number, { friend_id: number; friend_email: string; friend_name: string; is_self: boolean; trend: Array<{ day: string; total: number }> }>();
  for (const row of rows) {
    const friendId = Number(row.friend_id);
    if (!grouped.has(friendId)) {
      grouped.set(friendId, {
        friend_id: friendId,
        friend_email: String(row.friend_email),
        friend_name: String(row.friend_name),
        is_self: Boolean(row.is_self),
        trend: [],
      });
    }
    grouped.get(friendId)!.trend.push({
      day: String(row.day),
      total: Number(row.total ?? 0),
    });
  }

  return c.json({
    days,
    anchorDay: anchorDay ?? null,
    data: Array.from(grouped.values()),
  });
});

app.get("/api/network/today", async (c) => {
  const userId = c.get("authUser").id;
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));

  const rows = await query<{
    friend_id: number;
    friend_email: string;
    friend_name: string;
    job_id: number;
    company: string | null;
    role: string | null;
    date_saved: string | null;
    applied_at: string | null;
    application_status: string | null;
    referral_status: string | null;
    oa_status: string | null;
    job_application_id: string | null;
    oa_deadline_date: string | null;
    job_link: string | null;
    notes: string | null;
    can_view_company: boolean;
    can_view_role: boolean;
    can_view_applied_at: boolean;
    can_view_oa_status: boolean;
    can_view_oa_deadline: boolean;
    can_view_referral_used: boolean;
    can_view_notes: boolean;
    can_view_job_application_id: boolean;
  }>(
    c.env,
    `
    WITH viewer_visibility AS (
      SELECT
        COALESCE(v.share_company, TRUE) AS share_company,
        COALESCE(v.share_role, TRUE) AS share_role,
        COALESCE(v.share_applied_at, TRUE) AS share_applied_at,
        COALESCE(v.share_oa_status, TRUE) AS share_oa_status,
        COALESCE(v.share_oa_deadline, TRUE) AS share_oa_deadline,
        COALESCE(v.share_referral_used, TRUE) AS share_referral_used,
        COALESCE(v.share_notes, TRUE) AS share_notes,
        COALESCE(v.share_job_application_id, TRUE) AS share_job_application_id
      FROM (SELECT 1) seed
      LEFT JOIN user_field_visibility v ON v.user_id = $1
    ),
    friends AS (
      SELECT
        CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id,
        u.email AS friend_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name
      FROM friendships f
      JOIN dashboard_users u
        ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.receiver_id = $1)
        AND f.status = 'accepted'
    )
    SELECT
      fr.friend_id,
      fr.friend_email,
      fr.friend_name,
      j.id AS job_id,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_company AND COALESCE(ov.share_company, TRUE)) THEN j.company
        ELSE NULL
      END AS company,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_role AND COALESCE(ov.share_role, TRUE)) THEN j.role
        ELSE NULL
      END AS role,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE)) THEN j.date_saved::text
        ELSE NULL
      END AS date_saved,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE)) THEN j.applied_at::text
        ELSE NULL
      END AS applied_at,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE)) THEN j.application_status
        ELSE NULL
      END AS application_status,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_referral_used AND COALESCE(ov.share_referral_used, TRUE)) THEN j.referral_status
        ELSE NULL
      END AS referral_status,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_oa_status AND COALESCE(ov.share_oa_status, TRUE)) THEN j.oa_status
        ELSE NULL
      END AS oa_status,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_job_application_id AND COALESCE(ov.share_job_application_id, TRUE)) THEN j.job_application_id
        ELSE NULL
      END AS job_application_id,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_oa_deadline AND COALESCE(ov.share_oa_deadline, TRUE)) THEN j.oa_deadline_date::text
        ELSE NULL
      END AS oa_deadline_date,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (
          (vv.share_company AND COALESCE(ov.share_company, TRUE))
          AND (vv.share_role AND COALESCE(ov.share_role, TRUE))
        ) THEN j.job_link
        ELSE NULL
      END AS job_link,
      CASE
        WHEN j.id IS NULL THEN NULL
        WHEN fr.friend_id = $1 OR (vv.share_notes AND COALESCE(ov.share_notes, TRUE)) THEN j.notes
        ELSE NULL
      END AS notes,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_company AND COALESCE(ov.share_company, TRUE))
      END AS can_view_company,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_role AND COALESCE(ov.share_role, TRUE))
      END AS can_view_role,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE))
      END AS can_view_applied_at,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_oa_status AND COALESCE(ov.share_oa_status, TRUE))
      END AS can_view_oa_status,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_oa_deadline AND COALESCE(ov.share_oa_deadline, TRUE))
      END AS can_view_oa_deadline,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_referral_used AND COALESCE(ov.share_referral_used, TRUE))
      END AS can_view_referral_used,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_notes AND COALESCE(ov.share_notes, TRUE))
      END AS can_view_notes,
      CASE
        WHEN j.id IS NULL THEN FALSE
        WHEN fr.friend_id = $1 THEN TRUE
        ELSE (vv.share_job_application_id AND COALESCE(ov.share_job_application_id, TRUE))
      END AS can_view_job_application_id
    FROM friends fr
    CROSS JOIN viewer_visibility vv
    LEFT JOIN user_field_visibility ov ON ov.user_id = fr.friend_id
    LEFT JOIN jobs j
      ON j.user_id = fr.friend_id
     AND j.date_saved IS NOT NULL
     AND j.date_saved::date = COALESCE($2::date, CURRENT_DATE)
     AND (
       fr.friend_id = $1
       OR (vv.share_applied_at AND COALESCE(ov.share_applied_at, TRUE))
     )
    ORDER BY
      COALESCE(j.applied_at, j.date_saved, j.created_at) DESC NULLS LAST,
      j.created_at DESC NULLS LAST,
      LOWER(fr.friend_name) ASC,
      LOWER(fr.friend_email) ASC,
      j.id DESC NULLS LAST
    `,
    [userId, anchorDay],
  );

  const grouped = new Map<number, {
    friend_id: number;
    friend_email: string;
    friend_name: string;
    jobs: Array<{
      id: number;
      company: string | null;
      role: string | null;
      date_saved: string | null;
      applied_at: string | null;
      application_status: string | null;
      referral_status: string | null;
      oa_status: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      job_link: string | null;
      notes: string | null;
      can_view_company: boolean;
      can_view_role: boolean;
      can_view_applied_at: boolean;
      can_view_oa_status: boolean;
      can_view_oa_deadline: boolean;
      can_view_referral_used: boolean;
      can_view_notes: boolean;
      can_view_job_application_id: boolean;
    }>;
  }>();

  for (const row of rows) {
    const friendId = Number(row.friend_id);
    if (!grouped.has(friendId)) {
      grouped.set(friendId, {
        friend_id: friendId,
        friend_email: String(row.friend_email),
        friend_name: String(row.friend_name),
        jobs: [],
      });
    }
    if (row.job_id != null) {
      grouped.get(friendId)!.jobs.push({
        id: Number(row.job_id),
        company: row.company ?? null,
        role: row.role ?? null,
        date_saved: row.date_saved ?? null,
        applied_at: row.applied_at ?? null,
        application_status: row.application_status ?? null,
        referral_status: row.referral_status ?? null,
        oa_status: row.oa_status ?? null,
        job_application_id: row.job_application_id ?? null,
        oa_deadline_date: row.oa_deadline_date ?? null,
        job_link: row.job_link ?? null,
        notes: row.notes ?? null,
        can_view_company: toBoolean(row.can_view_company, false),
        can_view_role: toBoolean(row.can_view_role, false),
        can_view_applied_at: toBoolean(row.can_view_applied_at, false),
        can_view_oa_status: toBoolean(row.can_view_oa_status, false),
        can_view_oa_deadline: toBoolean(row.can_view_oa_deadline, false),
        can_view_referral_used: toBoolean(row.can_view_referral_used, false),
        can_view_notes: toBoolean(row.can_view_notes, false),
        can_view_job_application_id: toBoolean(row.can_view_job_application_id, false),
      });
    }
  }

  return c.json({
    anchorDay: anchorDay ?? null,
    data: Array.from(grouped.values()),
  });
});

app.get("/api/network/deadlines", async (c) => {
  const userId = c.get("authUser").id;
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));

  const rows = await query<{
    friend_id: number;
    friend_email: string;
    friend_name: string;
    job_id: number;
    company: string | null;
    role: string | null;
    oa_deadline_date: string | null;
    deadline_state: "overdue" | "today";
    days_to_deadline: number | null;
    job_link: string | null;
    job_application_id: string | null;
  }>(
    c.env,
    `
    WITH viewer_visibility AS (
      SELECT
        COALESCE(v.share_company, TRUE) AS share_company,
        COALESCE(v.share_role, TRUE) AS share_role,
        COALESCE(v.share_oa_status, TRUE) AS share_oa_status,
        COALESCE(v.share_oa_deadline, TRUE) AS share_oa_deadline
      FROM (SELECT 1) seed
      LEFT JOIN user_field_visibility v ON v.user_id = $1
    ),
    friends AS (
      SELECT
        CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id,
        u.email AS friend_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name
      FROM friendships f
      JOIN dashboard_users u
        ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.receiver_id = $1)
        AND f.status = 'accepted'
    )
    SELECT
      fr.friend_id,
      fr.friend_email,
      fr.friend_name,
      j.id AS job_id,
      j.company,
      j.role,
      j.oa_deadline_date::text AS oa_deadline_date,
      CASE
        WHEN j.oa_deadline_date < COALESCE($2::date, CURRENT_DATE) THEN 'overdue'
        ELSE 'today'
      END AS deadline_state,
      (j.oa_deadline_date - COALESCE($2::date, CURRENT_DATE))::int AS days_to_deadline,
      j.job_link,
      j.job_application_id
    FROM friends fr
    CROSS JOIN viewer_visibility vv
    LEFT JOIN user_field_visibility ov ON ov.user_id = fr.friend_id
    JOIN jobs j
      ON j.user_id = fr.friend_id
    WHERE LOWER(TRIM(COALESCE(j.oa_status, ''))) = 'yes'
      AND LOWER(TRIM(COALESCE(j.application_status, 'Applied'))) != 'rejected'
      AND j.oa_deadline_date IS NOT NULL
      AND j.oa_deadline_date <= COALESCE($2::date, CURRENT_DATE)
      AND (vv.share_oa_status AND COALESCE(ov.share_oa_status, TRUE))
      AND (vv.share_oa_deadline AND COALESCE(ov.share_oa_deadline, TRUE))
      AND (vv.share_company AND COALESCE(ov.share_company, TRUE))
      AND (vv.share_role AND COALESCE(ov.share_role, TRUE))
    ORDER BY
      j.oa_deadline_date ASC,
      LOWER(fr.friend_name) ASC,
      LOWER(fr.friend_email) ASC,
      COALESCE(j.applied_at, j.date_saved, j.created_at) DESC NULLS LAST,
      j.id DESC
    LIMIT 100
    `,
    [userId, anchorDay],
  );

  return c.json({
    anchorDay: anchorDay ?? null,
    data: rows,
  });
});

app.get("/api/dashboard/summary", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));
  const [referralCount] = await query<{ count: string }>(env, "SELECT COUNT(*)::text AS count FROM referrals WHERE user_id = $1", [userId]);
  const [pendingCount] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM pending_items WHERE user_id = $1 AND is_done = FALSE",
    [userId],
  );
  const [jobsThisMonth] = await query<{ count: string }>(
    env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved >= DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
      AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );
  const [jobsThisWeek] = await query<{ count: string }>(
    env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved >= DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))
      AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );
  const [jobsToday] = await query<{ count: string }>(
    env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved::date = COALESCE($2::date, CURRENT_DATE)
    `,
    [userId, anchorDay],
  );
  const [jobsWithReferral] = await query<{ count: string }>(
    env,
    `
    SELECT COUNT(*)::text AS count
    FROM jobs
    WHERE user_id = $1
      AND TRIM(COALESCE(referral_status, '')) = 'Yes'
    `,
    [userId],
  );
  const [applicationCount] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1",
    [userId],
  );

  const [rejectedCount] = await query<{ count: string }>(
    env,
    "SELECT COUNT(*)::text AS count FROM jobs WHERE user_id = $1 AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'",
    [userId],
  );

  const dailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(j.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days - 1}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
      GROUP BY DATE(date_saved)
    ) j ON j.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const referralDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days - 1}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const rejectedDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(r.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days - 1}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) r ON r.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const pendingDailyTrend = await query<{ day: string; total: number }>(
    env,
    `
    SELECT d.day::text AS day, COALESCE(p.cnt, 0)::int AS total
    FROM (
      SELECT generate_series(
        (COALESCE($2::date, CURRENT_DATE) - (${days - 1}::text || ' days')::interval)::date,
        COALESCE($2::date, CURRENT_DATE)::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(pending_date) AS day, COUNT(*)::int AS cnt
      FROM pending_items
      WHERE user_id = $1
        AND pending_date IS NOT NULL
        AND is_done = FALSE
      GROUP BY DATE(pending_date)
    ) p ON p.day = d.day
    ORDER BY d.day ASC
    `,
    [userId, anchorDay],
  );

  const referralTrendRaw = await query<{ referral_status: string; total: number }>(
    env,
    `
    SELECT
      CASE
        WHEN TRIM(COALESCE(referral_status, '')) IN ('Pending', 'Applied without referral') THEN 'No'
        ELSE TRIM(COALESCE(referral_status, ''))
      END AS referral_status,
      COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
    GROUP BY 1
    `,
    [userId],
  );
  const referralOrder = ["Yes", "No"];
  const referralTrend = referralOrder
    .map((status) => {
      const row = referralTrendRaw.find((r) => r.referral_status === status);
      return { referral_status: status, total: row ? row.total : 0 };
    })
    .concat(
      referralTrendRaw
        .filter((r) => !referralOrder.includes(r.referral_status) && r.referral_status !== "")
        .map((r) => ({ referral_status: r.referral_status, total: r.total })),
    );

  const weeklyTrend = await query<{ week: string; total: number }>(
    env,
    `
    WITH weeks AS (
      SELECT generate_series(
        DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))::date - INTERVAL '11 weeks',
        DATE_TRUNC('week', COALESCE($2::date, CURRENT_DATE))::date,
        '1 week'::interval
      )::date AS week_start
    ),
    counts AS (
      SELECT DATE_TRUNC('week', date_saved)::date AS week_start, COUNT(*)::int AS total
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
      GROUP BY DATE_TRUNC('week', date_saved)
    )
    SELECT w.week_start::text AS week, COALESCE(c.total, 0)::int AS total
    FROM weeks w
    LEFT JOIN counts c ON c.week_start = w.week_start
    ORDER BY w.week_start ASC
    `,
    [userId, anchorDay],
  );

  const responseStatusTrend = await query<{ response_status: string; total: number }>(
    env,
    `
    SELECT COALESCE(NULLIF(TRIM(response_status), ''), '—') AS response_status, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
    GROUP BY COALESCE(NULLIF(TRIM(response_status), ''), '—')
    ORDER BY total DESC
    LIMIT 8
    `,
    [userId],
  );

  const oaStatusTrend = await query<{ oa_status: string; total: number }>(
    env,
    `
    SELECT COALESCE(NULLIF(TRIM(oa_status), ''), '—') AS oa_status, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
    GROUP BY COALESCE(NULLIF(TRIM(oa_status), ''), '—')
    ORDER BY total DESC
    LIMIT 8
    `,
    [userId],
  );

  const monthlyTrend = await query<{ month: string; total: number }>(
    env,
    `
    SELECT TO_CHAR(DATE_TRUNC('month', date_saved), 'YYYY-MM') AS month, COUNT(*)::int AS total
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved >= (COALESCE($2::date, CURRENT_DATE) - INTERVAL '12 months')
      AND date_saved::date <= COALESCE($2::date, CURRENT_DATE)
    GROUP BY DATE_TRUNC('month', date_saved)
    ORDER BY month ASC
    LIMIT 12
    `,
    [userId, anchorDay],
  );

  return c.json({
    kpis: {
      jobs: Number(applicationCount?.count ?? 0),
      referrals: Number(referralCount?.count ?? 0),
      pending: Number(pendingCount?.count ?? 0),
      rejected: Number(rejectedCount?.count ?? 0),
      jobsThisMonth: Number(jobsThisMonth?.count ?? 0),
      jobsThisWeek: Number(jobsThisWeek?.count ?? 0),
      jobsToday: Number(jobsToday?.count ?? 0),
      jobsWithReferral: Number(jobsWithReferral?.count ?? 0),
    },
    dailyTrend,
    referralDailyTrend,
    rejectedDailyTrend,
    pendingDailyTrend,
    referralTrend,
    weeklyTrend,
    responseStatusTrend,
    oaStatusTrend,
    monthlyTrend,
  });
});

app.get("/api/jobs/trend", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));
  const anchorDateSql = anchorDay ? `$2::date` : `CURRENT_DATE`;
  const params = anchorDay ? [userId, anchorDay] : [userId];

  // Get daily applied and rejected counts for the last N days
  const trendData = await query<{ day: string; applied: number; rejected: number }>(
    env,
    `
    SELECT 
      d.day::text AS day,
      COALESCE(applied.cnt, 0)::int AS applied,
      COALESCE(rejected.cnt, 0)::int AS rejected
    FROM (
      SELECT generate_series(
        (${anchorDateSql} - (${days - 1}::text || ' days')::interval)::date,
        ${anchorDateSql}::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(COALESCE(date_saved, applied_at)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1 
        AND COALESCE(date_saved, applied_at) IS NOT NULL
      GROUP BY DATE(COALESCE(date_saved, applied_at))
    ) applied ON applied.day = d.day
    LEFT JOIN (
      SELECT DATE(COALESCE(archive_date, date_saved)) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1 
        AND LOWER(TRIM(COALESCE(application_status, ''))) = 'rejected'
        AND (archive_date IS NOT NULL OR date_saved IS NOT NULL)
      GROUP BY DATE(COALESCE(archive_date, date_saved))
    ) rejected ON rejected.day = d.day
    ORDER BY d.day ASC
    `,
    params,
  );

  return c.json({ data: trendData });
});

const JOBS_SORT_COLUMNS = ["date_saved", "applied_at", "company", "role", "referral_status", "job_link"] as const;
type JobsSortColumn = (typeof JOBS_SORT_COLUMNS)[number];
function isJobsSortColumn(s: string): s is JobsSortColumn {
  return (JOBS_SORT_COLUMNS as readonly string[]).includes(s);
}

const CSV_MAX_BYTES = 10 * 1024 * 1024;
const IMPORT_BATCH_SIZE = 200;
const IMPORT_DEFAULT_TIME_SUFFIX = "T00:07:00Z";
const IMPORT_REQUIRED_HEADERS = ["role", "company"] as const;
const IMPORT_DATE_HEADERS = ["date_saved", "applied_at"] as const;
const IMPORT_OPTIONAL_HEADERS = [
  "date_saved",
  "applied_at",
  "location_raw",
  "job_link",
  "job_application_id",
  "oa_deadline_date",
  "keyword_matching",
  "oa_status",
  "referral_status",
  "response_status",
  "application_status",
  "notes",
] as const;
type CsvHeader = (typeof IMPORT_REQUIRED_HEADERS)[number] | (typeof IMPORT_OPTIONAL_HEADERS)[number];
type CsvImportRow = {
  role: string;
  company: string;
  date_saved: string;
  applied_at: string;
  location_raw: string;
  job_link: string | null;
  job_application_id: string;
  oa_deadline_date: string | null;
  keyword_matching: "Strong" | "Medium" | "Weak";
  oa_status: string;
  referral_status: string;
  response_status: string;
  application_status: string;
  notes: string;
};
const IMPORT_CANONICAL_HEADERS = new Set<CsvHeader>([
  ...IMPORT_REQUIRED_HEADERS,
  ...IMPORT_OPTIONAL_HEADERS,
]);
const IMPORT_HEADER_ALIASES: Record<string, CsvHeader> = {
  role: "role",
  position: "role",
  job_title: "role",
  title: "role",
  company: "company",
  company_name: "company",
  date_saved: "date_saved",
  date: "date_saved",
  applied_date: "date_saved",
  applied_day: "date_saved",
  applied_at: "applied_at",
  applied_time: "applied_at",
  application_time: "applied_at",
  location: "location_raw",
  location_raw: "location_raw",
  job_link: "job_link",
  link: "job_link",
  url: "job_link",
  job_application_id: "job_application_id",
  job_app_id: "job_application_id",
  application_id: "job_application_id",
  oa_deadline_date: "oa_deadline_date",
  oa_deadline: "oa_deadline_date",
  deadline: "oa_deadline_date",
  keyword_matching: "keyword_matching",
  keyword_match: "keyword_matching",
  match: "keyword_matching",
  oa_status: "oa_status",
  oa: "oa_status",
  referral_status: "referral_status",
  referral: "referral_status",
  response_status: "response_status",
  response: "response_status",
  application_status: "application_status",
  status: "application_status",
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
};

function parseCsvText(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (inQuotes) {
      if (ch === "\"") {
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((entry) => entry.length > 0)) rows.push(row);
  return rows;
}

function normalizeImportHeader(raw: string): string {
  return raw
    .trim()
    .replace(/^\ufeff/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveImportHeader(raw: string): CsvHeader | null {
  const normalized = normalizeImportHeader(raw);
  if (!normalized) return null;
  const aliased = IMPORT_HEADER_ALIASES[normalized];
  if (aliased) return aliased;
  return IMPORT_CANONICAL_HEADERS.has(normalized as CsvHeader) ? (normalized as CsvHeader) : null;
}

function parseImportDateOnly(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseImportAppliedAt(raw: string, fallbackDate?: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return fallbackDate ? `${fallbackDate}${IMPORT_DEFAULT_TIME_SUFFIX}` : null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}${IMPORT_DEFAULT_TIME_SUFFIX}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function chunkRows<T>(rows: T[], chunkSize: number): T[][] {
  if (rows.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));
  return chunks;
}

function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  const sanitized = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (sanitized.includes(",") || sanitized.includes("\"") || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, "\"\"")}"`;
  }
  return sanitized;
}

const KEYWORD_MATCHING_ALLOWED: Record<string, "Strong" | "Medium" | "Weak"> = {
  strong: "Strong",
  medium: "Medium",
  week: "Weak",
  weak: "Weak",
};

const OA_STATUS_ALLOWED: Record<string, string> = {
  yes: "Yes",
  no: "No",
  pending: "Yes",
  complete: "Yes",
  completed: "Yes",
  done: "Yes",
  missed: "Yes",
  missing: "Yes",
  overdue: "Yes",
};

const REFERRAL_STATUS_ALLOWED: Record<string, string> = {
  requested: "Requested",
  yes: "Yes",
  no: "No",
  pending: "No",
  "applied without referral": "No",
};

const RESPONSE_STATUS_ALLOWED: Record<string, string> = {
  review: "Review",
  screening: "Screening",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
  "no response": "No Response",
};

const APPLICATION_STATUS_ALLOWED: Record<string, string> = {
  applied: "Applied",
  review: "Review",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
};

function normalizeAllowed(value: string, allowed: Record<string, string>, fallback: string): string {
  const key = value.trim().toLowerCase();
  if (!key) return fallback;
  return allowed[key] ?? fallback;
}

function normalizeKeywordMatching(value: unknown): "Strong" | "Medium" | "Weak" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "strong") return "Strong";
  if (raw === "medium") return "Medium";
  if (raw === "week" || raw === "weak") return "Weak";
  return null;
}

function normalizeReferralStatus(value: unknown): "Requested" | "Yes" | "No" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "requested") return "Requested";
  if (raw === "yes") return "Yes";
  return "No";
}

function normalizeOaStatus(value: unknown): "Yes" | "No" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "yes" || raw === "pending" || raw === "completed" || raw === "complete" || raw === "done" || raw === "missed" || raw === "missing" || raw === "overdue") return "Yes";
  return "No";
}

function asTrimmedString(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function toIsoDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function syncReferralFromJob(
  env: Bindings,
  userId: number,
  job: Record<string, unknown>,
  options?: { referredByName?: string | null },
): Promise<void> {
  const company = asTrimmedString(job.company);
  const requestLog = asTrimmedString(job.role);
  const referralStatus = normalizeReferralStatus(job.referral_status);
  if (!company || !requestLog || !referralStatus) return;

  const requestLink = asTrimmedString((job as any).job_link);
  const requestDate = toIsoDate((job as any).date_saved) ?? toIsoDate((job as any).applied_at);
  const keywordMatching = normalizeKeywordMatching((job as any).keyword_matching) ?? "Medium";
  const comment = asTrimmedString((job as any).notes);
  const referredByName = asTrimmedString(options?.referredByName);

  let existingId: number | null = null;

  if (requestLink) {
    const [byLink] = await query<{ id: number }>(
      env,
      `
      SELECT id
      FROM referrals
      WHERE user_id = $1
        AND TRIM(COALESCE(request_link, '')) = TRIM($2)
      ORDER BY COALESCE(updated_date, request_date) DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [userId, requestLink],
    );
    existingId = byLink?.id ?? null;
  }

  if (!existingId) {
    const [byCompanyRole] = await query<{ id: number }>(
      env,
      `
      SELECT id
      FROM referrals
      WHERE user_id = $1
        AND LOWER(TRIM(company)) = LOWER(TRIM($2))
        AND LOWER(TRIM(COALESCE(request_log, ''))) = LOWER(TRIM($3))
      ORDER BY COALESCE(updated_date, request_date) DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [userId, company, requestLog],
    );
    existingId = byCompanyRole?.id ?? null;
  }

  // Only create referral rows for statuses that should appear on the referrals page.
  const shouldCreate = referralStatus === "Requested" || referralStatus === "Yes";
  if (!existingId && !shouldCreate) return;

  if (existingId) {
    await query(
      env,
      `
      UPDATE referrals
      SET
        company = $3,
        request_log = $4,
        request_date = COALESCE($5::date, request_date),
        updated_date = COALESCE($5::date, CURRENT_DATE),
        request_link = $6,
        referral_received = $7,
        keyword_matching = COALESCE($8, keyword_matching, 'Medium'),
        comment = $9,
        referred_by_name = $10,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      `,
      [
        existingId,
        userId,
        company,
        requestLog,
        requestDate,
        requestLink,
        referralStatus,
        keywordMatching,
        comment,
        referredByName,
      ],
    );
    return;
  }

  await query(
    env,
    `
    INSERT INTO referrals (user_id, source, company, request_log, request_date, updated_date, request_link, referral_received, keyword_matching, referred_by_name, comment)
    VALUES ($1, 'job-sync', $2, $3, $4::date, COALESCE($4::date, CURRENT_DATE), $5, $6, COALESCE($7, 'Medium'), $8, $9)
    `,
    [userId, company, requestLog, requestDate, requestLink, referralStatus, keywordMatching, referredByName, comment],
  );
}

function insertJobsImportBatchStatement(userId: number, rows: CsvImportRow[]): SqlStatement {
  return {
    text: `
    INSERT INTO jobs (
      user_id,
      source,
      role,
      company,
      location_raw,
      job_link,
      job_application_id,
      oa_deadline_date,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes,
      date_saved,
      applied_at
    )
    SELECT
      $1,
      'import-csv',
      NULLIF(TRIM(r.role), ''),
      NULLIF(TRIM(r.company), ''),
      NULLIF(TRIM(r.location_raw), ''),
      NULLIF(TRIM(r.job_link), ''),
      NULLIF(TRIM(r.job_application_id), ''),
      NULLIF(TRIM(r.oa_deadline_date), '')::date,
      COALESCE(NULLIF(TRIM(r.keyword_matching), ''), 'Medium'),
      COALESCE(NULLIF(TRIM(r.oa_status), ''), 'No'),
      COALESCE(NULLIF(TRIM(r.referral_status), ''), 'No'),
      COALESCE(NULLIF(TRIM(r.response_status), ''), 'Review'),
      COALESCE(NULLIF(TRIM(r.application_status), ''), 'Applied'),
      NULLIF(TRIM(r.notes), ''),
      (r.date_saved::date)::timestamp,
      COALESCE(r.applied_at::timestamptz, (r.date_saved::date)::timestamp)
    FROM jsonb_to_recordset($2::jsonb) AS r(
      role text,
      company text,
      date_saved text,
      applied_at text,
      location_raw text,
      job_link text,
      job_application_id text,
      oa_deadline_date text,
      keyword_matching text,
      oa_status text,
      referral_status text,
      response_status text,
      application_status text,
      notes text
    )
    `,
    params: [userId, JSON.stringify(rows)],
  };
}

function syncReferralsFromImportRowsBatchStatement(userId: number, rows: CsvImportRow[]): SqlStatement {
  return {
    text: `
    WITH payload AS (
      SELECT
        NULLIF(TRIM(r.company), '') AS company,
        NULLIF(TRIM(r.role), '') AS request_log,
        COALESCE(
          NULLIF(TRIM(r.date_saved), '')::date,
          (NULLIF(TRIM(r.applied_at), '')::timestamptz)::date,
          CURRENT_DATE
        ) AS request_date,
        NULLIF(TRIM(r.job_link), '') AS request_link,
        CASE
          WHEN LOWER(TRIM(COALESCE(r.referral_status, ''))) = 'requested' THEN 'Requested'
          WHEN LOWER(TRIM(COALESCE(r.referral_status, ''))) = 'yes' THEN 'Yes'
          WHEN LOWER(TRIM(COALESCE(r.referral_status, ''))) = 'no' THEN 'No'
          ELSE 'No'
        END AS referral_received,
        COALESCE(NULLIF(TRIM(r.keyword_matching), ''), 'Medium') AS keyword_matching,
        NULLIF(TRIM(r.notes), '') AS comment
      FROM jsonb_to_recordset($2::jsonb) AS r(
        role text,
        company text,
        date_saved text,
        applied_at text,
        location_raw text,
        job_link text,
        job_application_id text,
        oa_deadline_date text,
        keyword_matching text,
        oa_status text,
        referral_status text,
        response_status text,
        application_status text,
        notes text
      )
    ),
    eligible AS (
      SELECT *
      FROM payload
      WHERE company IS NOT NULL
        AND request_log IS NOT NULL
        AND referral_received IN ('Requested', 'Yes')
    ),
    dedup AS (
      SELECT DISTINCT ON (LOWER(company), LOWER(request_log), COALESCE(LOWER(request_link), ''))
        company,
        request_log,
        request_date,
        request_link,
        referral_received,
        keyword_matching,
        comment
      FROM eligible
      ORDER BY
        LOWER(company),
        LOWER(request_log),
        COALESCE(LOWER(request_link), ''),
        request_date DESC
    ),
    resolved AS (
      SELECT
        d.*,
        COALESCE(
          (
            SELECT r.id
            FROM referrals r
            WHERE r.user_id = $1
              AND d.request_link IS NOT NULL
              AND TRIM(COALESCE(r.request_link, '')) = TRIM(d.request_link)
            ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
            LIMIT 1
          ),
          (
            SELECT r.id
            FROM referrals r
            WHERE r.user_id = $1
              AND LOWER(TRIM(r.company)) = LOWER(TRIM(d.company))
              AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(TRIM(d.request_log))
            ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
            LIMIT 1
          )
        ) AS existing_id
      FROM dedup d
    ),
    updated AS (
      UPDATE referrals r
      SET
        company = src.company,
        request_log = src.request_log,
        request_date = COALESCE(src.request_date, r.request_date),
        updated_date = COALESCE(src.request_date, CURRENT_DATE),
        request_link = src.request_link,
        referral_received = src.referral_received,
        keyword_matching = COALESCE(src.keyword_matching, r.keyword_matching, 'Medium'),
        comment = src.comment,
        updated_at = NOW()
      FROM resolved src
      WHERE src.existing_id IS NOT NULL
        AND r.id = src.existing_id
        AND r.user_id = $1
      RETURNING r.id
    )
    INSERT INTO referrals (
      user_id,
      source,
      company,
      request_log,
      request_date,
      updated_date,
      request_link,
      referral_received,
      keyword_matching,
      comment
    )
    SELECT
      $1,
      'job-sync',
      src.company,
      src.request_log,
      src.request_date,
      COALESCE(src.request_date, CURRENT_DATE),
      src.request_link,
      src.referral_received,
      COALESCE(src.keyword_matching, 'Medium'),
      src.comment
    FROM resolved src
    WHERE src.existing_id IS NULL
    `,
    params: [userId, JSON.stringify(rows)],
  };
}

app.get("/api/jobs", async (c) => {
  const userId = c.get("authUser").id;
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25) || 25, 1), 100);
  const searchQuery = String(c.req.query("search") ?? c.req.query("company") ?? "").trim();
  const statusFilterRaw = String(c.req.query("status") ?? "").trim().toLowerCase(); // expected: "active" | "rejected" | "archive" | "all" (empty means active)
  const statusFilter = statusFilterRaw;
  const stageFilterRaw = String(c.req.query("stage") ?? "").trim();
  const stageFilter =
    stageFilterRaw === "Applied" ||
    stageFilterRaw === "OA" ||
    stageFilterRaw === "Interview" ||
    stageFilterRaw === "Offer" ||
    stageFilterRaw === "Archive"
      ? stageFilterRaw
      : "";
  const applicationStatusRaw = String(c.req.query("applicationStatus") ?? "").trim().toLowerCase();
  const applicationStatusFilter =
    applicationStatusRaw === "applied" ||
    applicationStatusRaw === "under consideration" ||
    applicationStatusRaw === "rejected"
      ? applicationStatusRaw
      : "";
  const timeRangeRaw = String(c.req.query("timeRange") ?? "").trim().toLowerCase();
  const referralFilterRaw = String(c.req.query("referral") ?? "").trim().toLowerCase();
  const oaFilterRaw = String(c.req.query("oa") ?? "").trim().toLowerCase();
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));
  const sortRaw = c.req.query("sort") ?? "applied_at";
  const orderRaw = String(c.req.query("order") ?? "desc").toLowerCase();
  const sort = isJobsSortColumn(sortRaw) ? sortRaw : "applied_at";
  const order: "ASC" | "DESC" = orderRaw === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const orderBy = `j.${sort} ${order} NULLS LAST, COALESCE(j.applied_at, j.date_saved, j.created_at) DESC NULLS LAST, j.created_at DESC NULLS LAST, j.id DESC`;
  const stageSql = `
    CASE
      -- Canonical pipeline values stored in application_status
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) IN ('applied', '') THEN 'Applied'
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) = 'oa' THEN 'OA'
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) = 'interview' THEN 'Interview'
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) = 'offer' THEN 'Offer'
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) IN ('archive', 'archived', 'rejected') THEN 'Archive'
      -- Backward-compat: map legacy values into the closest stage
      WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) = 'under consideration' THEN 'Applied'
      ELSE 'Applied'
    END
  `;
  const fromSql = `
    FROM jobs j
    LEFT JOIN LATERAL (
      SELECT r.referred_by_name
      FROM referrals r
      WHERE r.user_id = j.user_id
        AND TRIM(COALESCE(r.referred_by_name, '')) <> ''
        AND (
          TRIM(COALESCE(r.request_link, '')) = TRIM(COALESCE(j.job_link, ''))
          OR (
            LOWER(TRIM(COALESCE(r.company, ''))) = LOWER(TRIM(COALESCE(j.company, '')))
            AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(TRIM(COALESCE(j.role, '')))
          )
        )
      ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
      LIMIT 1
    ) ref ON TRUE
  `;

  // Build where clause dynamically to handle broad search and status filters.
  const whereParts: string[] = ["j.user_id = $1"];
  const params: unknown[] = [userId];
  let paramIdx = 2;
  if (searchQuery) {
    whereParts.push(`(
      j.company ILIKE $${paramIdx}
      OR COALESCE(j.role, '') ILIKE $${paramIdx}
      OR COALESCE(j.location_raw, '') ILIKE $${paramIdx}
      OR COALESCE(j.job_link, '') ILIKE $${paramIdx}
      OR COALESCE(j.job_application_id, '') ILIKE $${paramIdx}
      OR COALESCE(j.keyword_matching, '') ILIKE $${paramIdx}
      OR COALESCE(j.oa_status, '') ILIKE $${paramIdx}
      OR COALESCE(j.oa_deadline_date::text, '') ILIKE $${paramIdx}
      OR COALESCE(j.referral_status, '') ILIKE $${paramIdx}
      OR COALESCE(ref.referred_by_name, '') ILIKE $${paramIdx}
      OR COALESCE(j.response_status, '') ILIKE $${paramIdx}
      OR COALESCE(j.application_status, '') ILIKE $${paramIdx}
      OR COALESCE(j.notes, '') ILIKE $${paramIdx}
      OR COALESCE(j.date_saved::text, '') ILIKE $${paramIdx}
      OR COALESCE(j.applied_at::text, '') ILIKE $${paramIdx}
    )`);
    params.push(`%${searchQuery}%`);
    paramIdx += 1;
  }
  // statusFilter semantics:
  // - '' or 'active'  => exclude archived/rejected
  // - 'archive'       => only archived/rejected
  // - 'rejected'      => only explicit "rejected" status (backward compat)
  // - 'all'           => no filter
  const applicationStatusExpr = "LOWER(TRIM(COALESCE(j.application_status, 'Applied')))";
  if (!statusFilter || statusFilter === "active") {
    whereParts.push(`${applicationStatusExpr} NOT IN ('rejected', 'archive', 'archived')`);
  } else if (statusFilter === "archive") {
    whereParts.push(`${applicationStatusExpr} IN ('rejected', 'archive', 'archived')`);
  } else if (statusFilter === "rejected") {
    whereParts.push(`${applicationStatusExpr} = 'rejected'`);
  }
  if (stageFilter) {
    whereParts.push(`(${stageSql}) = $${paramIdx}`);
    params.push(stageFilter);
    paramIdx += 1;
  }

  if (applicationStatusFilter) {
    whereParts.push(`LOWER(TRIM(COALESCE(j.application_status, 'Applied'))) = $${paramIdx}`);
    params.push(applicationStatusFilter);
    paramIdx += 1;
  }

  if (timeRangeRaw && timeRangeRaw !== "all") {
    const timeRange = Number(timeRangeRaw);
    if (Number.isFinite(timeRange) && timeRange >= 0 && timeRange <= 3650) {
      const anchorParam = paramIdx;
      params.push(anchorDay);
      paramIdx += 1;
      const anchorExpr = `COALESCE($${anchorParam}::date, CURRENT_DATE)`;
      const dayExpr = `COALESCE(j.applied_at::date, j.date_saved::date, j.created_at::date)`;
      if (timeRange === 0) {
        whereParts.push(`${dayExpr} = ${anchorExpr}`);
      } else {
        whereParts.push(
          `${dayExpr} >= (${anchorExpr} - INTERVAL '${Math.max(0, Math.floor(timeRange) - 1)} days')::date AND ${dayExpr} <= ${anchorExpr}`,
        );
      }
    }
  }

  if (referralFilterRaw === "yes") {
    whereParts.push(`LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('yes', 'requested')`);
  } else if (referralFilterRaw === "no") {
    whereParts.push(`LOWER(TRIM(COALESCE(j.referral_status, ''))) NOT IN ('yes', 'requested')`);
  }

  if (oaFilterRaw === "yes") {
    whereParts.push(`LOWER(TRIM(COALESCE(j.oa_status, ''))) = 'yes'`);
  } else if (oaFilterRaw === "no") {
    whereParts.push(`LOWER(TRIM(COALESCE(j.oa_status, ''))) <> 'yes'`);
  }

  const whereClause = ` WHERE ${whereParts.join(" AND ")}`;
  const [countRow] = await query<{ total: number }>(
    c.env,
    `SELECT COUNT(*)::int AS total ${fromSql}${whereClause}`,
    params as unknown[],
  );
  const total = Number(countRow?.total ?? 0);
  // add limit/offset params
  params.push(limit, offset);
  const orderLimitOffset = ` ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const rows = await query(
    c.env,
    `
    SELECT
      j.*,
      ref.referred_by_name,
      (${stageSql}) AS dashboard_stage
    ${fromSql}
    ${whereClause}
    ${orderLimitOffset}
    `,
    params as unknown[],
  );
  return c.json({ page, limit, total, data: rows });
});

const jobInput = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  location_raw: z.string().optional(),
  job_link: z.string().url().optional(),
  job_application_id: z.string().optional(),
  oa_deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional(),
  oa_status: z.string().optional(),
  referral_status: z.string().optional(),
  response_status: z.string().optional(),
  application_status: z.string().optional(),
  referred_by_name: z.string().optional(),
  notes: z.string().optional(),
  date_saved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type CreateJobRecordInput = {
  user_id: number;
  source: string;
  role: string;
  company: string;
  location_raw: string | null;
  job_link: string | null;
  job_application_id: string | null;
  oa_deadline_date: string | null;
  keyword_matching: unknown;
  oa_status: unknown;
  referral_status: unknown;
  response_status: string | null;
  application_status: string | null;
  notes: string | null;
  date_saved: string | null;
  referred_by_name: string | null;
};

type DuplicateJobRecord = {
  id: number;
  role: string | null;
  company: string | null;
  job_link: string | null;
  job_application_id: string | null;
  created_at: string | null;
  date_saved: string | null;
};

async function findDuplicateJobForUser(
  env: Bindings,
  input: CreateJobRecordInput,
): Promise<DuplicateJobRecord | null> {
  const jobLink = asTrimmedString(input.job_link);
  if (jobLink) {
    const [existingByLink] = await query<DuplicateJobRecord>(
      env,
      `
      SELECT id, role, company, job_link, job_application_id, created_at::text, date_saved::text
      FROM jobs
      WHERE user_id = $1
        AND TRIM(COALESCE(job_link, '')) = TRIM($2)
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [input.user_id, jobLink],
    );
    if (existingByLink) return existingByLink;
  }

  const jobApplicationId = asTrimmedString(input.job_application_id);
  if (jobApplicationId && jobApplicationId !== "-") {
    const [existingByJobId] = await query<DuplicateJobRecord>(
      env,
      `
      SELECT id, role, company, job_link, job_application_id, created_at::text, date_saved::text
      FROM jobs
      WHERE user_id = $1
        AND LOWER(TRIM(COALESCE(job_application_id, ''))) = LOWER(TRIM($2))
        AND LOWER(TRIM(COALESCE(company, ''))) = LOWER(TRIM($3))
        AND LOWER(TRIM(COALESCE(role, ''))) = LOWER(TRIM($4))
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 1
      `,
      [input.user_id, jobApplicationId, input.company, input.role],
    );
    if (existingByJobId) return existingByJobId;
  }

  return null;
}

async function createJobRecord(env: Bindings, input: CreateJobRecordInput): Promise<Record<string, unknown> | null> {
  const [row] = await query(
    env,
    `
    INSERT INTO jobs (user_id, source, role, company, location_raw, job_link, job_application_id, oa_deadline_date, keyword_matching, oa_status, referral_status, response_status, application_status, notes, date_saved)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, COALESCE($9, 'Medium'), COALESCE($10, 'No'), $11, $12, COALESCE($13, 'Applied'), $14, (COALESCE($15::date, CURRENT_DATE))::timestamp)
    RETURNING *
    `,
    [
      input.user_id,
      input.source,
      input.role,
      input.company,
      input.location_raw,
      input.job_link,
      input.job_application_id?.trim() ? input.job_application_id.trim() : null,
      input.oa_deadline_date,
      normalizeKeywordMatching(input.keyword_matching),
      normalizeOaStatus(input.oa_status),
      normalizeReferralStatus(input.referral_status),
      input.response_status,
      input.application_status,
      input.notes,
      input.date_saved,
    ],
  );

  if (row) {
    await syncReferralFromJob(env, input.user_id, row as Record<string, unknown>, {
      referredByName: input.referred_by_name,
    });
  }

  return (row as Record<string, unknown>) || null;
}

const extensionApplicationInputV1 = z.object({
  payload_version: z.literal("v1"),
  source: z.string().trim().min(1).max(120).optional(),
  submitted_at: z.string().optional(),
  submitted_local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  extracted_job: z
    .object({
      location: z.string().optional(),
      url: z.string().url().optional(),
      ats_platform: z.string().optional(),
      job_id: z.string().optional(),
      employment_type: z.string().optional(),
      job_type: z.string().optional(),
      salary_min: z.string().optional(),
      salary_max: z.string().optional(),
      currency: z.string().optional(),
      period: z.string().optional(),
    })
    .partial()
    .optional(),
  application: z.object({
    job_title: z.string().trim().min(1),
    company: z.string().trim().min(1),
    job_application_id: z.string().optional().nullable(),
    job_link: z.string().url(),
    keyword_match: z.enum(["Strong", "Medium", "Weak", "Week"]).optional(),
    referral: z.enum(["Requested", "Yes", "No"]).optional(),
    referral_name: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

function mapExtensionV1ToCreateJobInput(
  userId: number,
  payload: z.infer<typeof extensionApplicationInputV1>,
): CreateJobRecordInput {
  const referralName = asTrimmedString(payload.application.referral_name);
  const explicitReferral = normalizeReferralStatus(payload.application.referral);
  const referralStatus = referralName ? "Yes" : explicitReferral ?? "No";
  const extracted = payload.extracted_job || {};

  return {
    user_id: userId,
    source: "extension-v1",
    role: payload.application.job_title.trim(),
    company: payload.application.company.trim(),
    location_raw: asTrimmedString(extracted.location),
    job_link: asTrimmedString(payload.application.job_link),
    job_application_id: asTrimmedString(payload.application.job_application_id),
    oa_deadline_date: null,
    keyword_matching: payload.application.keyword_match ?? "Medium",
    oa_status: "No",
    referral_status: referralStatus,
    response_status: "Review",
    application_status: "Applied",
    notes: asTrimmedString(payload.application.notes),
    // Prefer extension-local submission day so "today" metrics align with the user's local timezone.
    date_saved: payload.submitted_local_date ?? toIsoDate(payload.submitted_at) ?? null,
    referred_by_name: referralName,
  };
}

app.post("/api/jobs", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = jobInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;

  const row = await createJobRecord(c.env, {
    user_id: userId,
    source: "manual",
    role: p.role,
    company: p.company,
    location_raw: p.location_raw ?? null,
    job_link: p.job_link ?? null,
    job_application_id: p.job_application_id?.trim() ? p.job_application_id.trim() : null,
    oa_deadline_date: p.oa_deadline_date ?? null,
    keyword_matching: p.keyword_matching,
    oa_status: p.oa_status,
    referral_status: p.referral_status,
    response_status: p.response_status ?? null,
    application_status: p.application_status ?? null,
    notes: p.notes ?? null,
    date_saved: p.date_saved ?? null,
    referred_by_name: p.referred_by_name ?? null,
  });

  if (!row) return c.json({ error: "Unable to create application right now." }, 500);
  return c.json(row, 201);
});

app.post("/api/extension/applications", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = extensionApplicationInputV1.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const createInput = mapExtensionV1ToCreateJobInput(userId, parsed.data);
  const duplicate = await findDuplicateJobForUser(c.env, createInput);
  if (duplicate) {
    return c.json(
      {
        error: "Application already exists for this job.",
        code: "DUPLICATE_APPLICATION",
        payload_version: "v1",
        existing_job: duplicate,
      },
      409,
    );
  }

  const row = await createJobRecord(c.env, createInput);
  if (!row) return c.json({ error: "Unable to create extension application right now." }, 500);

  return c.json(
    {
      payload_version: "v1",
      source: parsed.data.source ?? "atriveo-job-assistant",
      job: row,
    },
    201,
  );
});

const jobsCsvImportInput = z.object({
  csv: z.string().min(1),
});

app.post("/api/jobs/import/csv", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = jobsCsvImportInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const csv = parsed.data.csv;
  const csvBytes = new TextEncoder().encode(csv).length;
  if (csvBytes > CSV_MAX_BYTES) {
    return c.json({ error: "CSV file is too large. Maximum allowed size is 10 MB." }, 413);
  }

  const rows = parseCsvText(csv);
  if (rows.length < 2) {
    return c.json({ error: "CSV must include a header row and at least one data row." }, 400);
  }

  const headerMap = new Map<CsvHeader, number>();
  rows[0].forEach((rawHeader, idx) => {
    const resolved = resolveImportHeader(rawHeader);
    if (resolved && !headerMap.has(resolved)) headerMap.set(resolved, idx);
  });

  const missingHeaders = IMPORT_REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
  if (missingHeaders.length > 0) {
    return c.json({ error: `Missing required header(s): ${missingHeaders.join(", ")}` }, 400);
  }
  const hasDateHeader = IMPORT_DATE_HEADERS.some((h) => headerMap.has(h));
  if (!hasDateHeader) {
    return c.json({ error: "Missing required date header: provide date_saved or applied_at." }, 400);
  }

  const imports: CsvImportRow[] = [];
  let skippedEmptyRows = 0;
  let skippedMissingRequired = 0;
  let skippedInvalidDate = 0;
  let defaultsApplied = 0;
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const csvRow = rows[i];
    const rowNumber = i + 1;
    const getCell = (field: CsvHeader): string => {
      const idx = headerMap.get(field);
      if (idx == null) return "";
      return (csvRow[idx] ?? "").trim();
    };

    const role = getCell("role");
    const company = getCell("company");
    const dateSavedRaw = getCell("date_saved");
    const appliedAtRaw = getCell("applied_at");
    if (!role && !company && !dateSavedRaw && !appliedAtRaw) {
      skippedEmptyRows += 1;
      continue;
    }
    if (!role || !company || (!dateSavedRaw && !appliedAtRaw)) {
      skippedMissingRequired += 1;
      if (warnings.length < 12) {
        warnings.push(`Row ${rowNumber} skipped: role, company and (date_saved or applied_at) are mandatory.`);
      }
      continue;
    }

    const parsedDateSaved = parseImportDateOnly(dateSavedRaw);
    const parsedAppliedAt = parseImportAppliedAt(appliedAtRaw, parsedDateSaved ?? undefined);
    const derivedDateSaved = parsedDateSaved ?? (parsedAppliedAt ? parsedAppliedAt.slice(0, 10) : null);

    if (!derivedDateSaved) {
      skippedInvalidDate += 1;
      if (warnings.length < 12) {
        warnings.push(`Row ${rowNumber} skipped: date_saved/applied_at is invalid.`);
      }
      continue;
    }

    if (dateSavedRaw && !parsedDateSaved) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: date_saved normalized from applied_at.`);
    }

    if (appliedAtRaw && !parsedAppliedAt) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: applied_at ignored (expected ISO timestamp or YYYY-MM-DD).`);
    }

    const jobLink = getCell("job_link");
    let normalizedJobLink: string | null = null;
    if (jobLink) {
      try {
        new URL(jobLink);
        normalizedJobLink = jobLink;
      } catch {
        defaultsApplied += 1;
        if (warnings.length < 12) warnings.push(`Row ${rowNumber}: invalid job_link replaced with default (empty).`);
      }
    }
    const jobApplicationIdRaw = getCell("job_application_id");
    const jobApplicationId = jobApplicationIdRaw || "-";
    if (!jobApplicationIdRaw) defaultsApplied += 1;
    const oaDeadlineRaw = getCell("oa_deadline_date");
    let oaDeadlineDate: string | null = null;
    if (oaDeadlineRaw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(oaDeadlineRaw)) {
        oaDeadlineDate = oaDeadlineRaw;
      } else {
        defaultsApplied += 1;
        if (warnings.length < 12) warnings.push(`Row ${rowNumber}: oa_deadline_date ignored (expected YYYY-MM-DD).`);
      }
    }

    const keywordMatchingRaw = getCell("keyword_matching");
    const keywordMatching = normalizeAllowed(
      keywordMatchingRaw,
      KEYWORD_MATCHING_ALLOWED,
      "Medium",
    ) as "Strong" | "Medium" | "Weak";
    if (keywordMatchingRaw && keywordMatchingRaw.trim().toLowerCase() !== keywordMatching.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: keyword_matching normalized to ${keywordMatching}.`);
    }
    const oaStatusRaw = getCell("oa_status");
    const oaStatus = normalizeAllowed(oaStatusRaw, OA_STATUS_ALLOWED, "No");
    if (oaStatusRaw && oaStatusRaw.trim().toLowerCase() !== oaStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: oa_status normalized to ${oaStatus}.`);
    }
    const referralRaw = getCell("referral_status");
    const referralStatus = normalizeAllowed(referralRaw, REFERRAL_STATUS_ALLOWED, "No");
    if (referralRaw && referralRaw.trim().toLowerCase() !== referralStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: referral_status normalized to ${referralStatus}.`);
    }
    const responseRaw = getCell("response_status");
    const responseStatus = normalizeAllowed(responseRaw, RESPONSE_STATUS_ALLOWED, "Review");
    if (responseRaw && responseRaw.trim().toLowerCase() !== responseStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: response_status normalized to ${responseStatus}.`);
    }
    const applicationRaw = getCell("application_status");
    const applicationStatus = normalizeAllowed(applicationRaw, APPLICATION_STATUS_ALLOWED, "Applied");
    if (applicationRaw && applicationRaw.trim().toLowerCase() !== applicationStatus.toLowerCase()) {
      defaultsApplied += 1;
      if (warnings.length < 12) warnings.push(`Row ${rowNumber}: application_status normalized to ${applicationStatus}.`);
    }

    const locationRaw = getCell("location_raw") || "Not specified";
    const notes = getCell("notes") || "Imported via CSV";
    if (!getCell("location_raw")) defaultsApplied += 1;
    if (!getCell("notes")) defaultsApplied += 1;

    imports.push({
      role,
      company,
      date_saved: derivedDateSaved,
      applied_at: parsedAppliedAt ?? `${derivedDateSaved}${IMPORT_DEFAULT_TIME_SUFFIX}`,
      location_raw: locationRaw,
      job_link: normalizedJobLink,
      job_application_id: jobApplicationId,
      oa_deadline_date: oaDeadlineDate,
      keyword_matching: keywordMatching,
      oa_status: oaStatus,
      referral_status: referralStatus,
      response_status: responseStatus,
      application_status: applicationStatus,
      notes,
    });
  }

  if (imports.length === 0) {
    return c.json({ error: "No valid CSV rows found. Ensure role, company and date_saved or applied_at are present." }, 400);
  }

  const batches = chunkRows(imports, IMPORT_BATCH_SIZE);
  const statements: SqlStatement[] = [];
  for (const batch of batches) {
    statements.push(insertJobsImportBatchStatement(userId, batch));
    statements.push(syncReferralsFromImportRowsBatchStatement(userId, batch));
  }
  await transaction(c.env, statements);

  return c.json({
    imported: imports.length,
    skippedEmptyRows,
    skippedMissingRequired,
    skippedInvalidDate,
    defaultsApplied,
    rowsReceived: rows.length - 1,
    requiredHeaders: [...IMPORT_REQUIRED_HEADERS, "date_saved|applied_at"],
    optionalHeaders: IMPORT_OPTIONAL_HEADERS,
    warnings,
  });
});

app.get("/api/jobs/export/csv", async (c) => {
  const userId = c.get("authUser").id;
  const range = String(c.req.query("range") ?? "30").toLowerCase();
  const validRange = range === "30" || range === "60" || range === "90" || range === "all" ? range : "30";
  const params: unknown[] = [userId];
  let whereDate = "";
  if (validRange !== "all") {
    whereDate = " AND date_saved >= (CURRENT_DATE - ($2::text || ' days')::interval)";
    params.push(Number(validRange));
  }

  const rows = await query<Record<string, unknown>>(
    c.env,
    `
    SELECT
      TO_CHAR(COALESCE(date_saved, NOW())::date, 'YYYY-MM-DD') AS date_saved,
      TO_CHAR(COALESCE(applied_at, date_saved, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS applied_at,
      role,
      company,
      location_raw,
      job_link,
      job_application_id,
      TO_CHAR(oa_deadline_date, 'YYYY-MM-DD') AS oa_deadline_date,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes
    FROM jobs
    WHERE user_id = $1${whereDate}
    ORDER BY date_saved DESC NULLS LAST, id DESC
    `,
    params,
  );

  const headers = [
    "date_saved",
    "applied_at",
    "role",
    "company",
    "location_raw",
    "job_link",
    "job_application_id",
    "oa_deadline_date",
    "keyword_matching",
    "oa_status",
    "referral_status",
    "response_status",
    "application_status",
    "notes",
  ];
  const csvLines = [headers.join(",")];
  rows.forEach((row) => {
    csvLines.push(
      headers
        .map((key) => {
          if (key === "keyword_matching") {
            const raw = String(row[key] ?? "");
            if (raw.trim().toLowerCase() === "week") return csvEscape("Weak");
          }
          return csvEscape(row[key]);
        })
        .join(","),
    );
  });
  const csv = csvLines.join("\n");
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="jobs_${validRange}_${today}.csv"`,
      "cache-control": "no-store",
    },
  });
});

const jobUpdateInput = z.object({
  role: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  location_raw: z.string().optional(),
  job_link: z.string().url().optional().nullable(),
  job_application_id: z.string().optional().nullable(),
  oa_deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional().nullable(),
  oa_status: z.string().optional().nullable(),
  referral_status: z.string().optional().nullable(),
  response_status: z.string().optional().nullable(),
  application_status: z.string().optional().nullable(),
  referred_by_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date_saved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

app.patch("/api/jobs/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = jobUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `
    UPDATE jobs SET
      role = COALESCE($1, role),
      company = COALESCE($2, company),
      location_raw = COALESCE($3, location_raw),
      job_link = COALESCE($4, job_link),
      job_application_id = COALESCE($5, job_application_id),
      oa_deadline_date = COALESCE($6::date, oa_deadline_date),
      keyword_matching = COALESCE($7, keyword_matching),
      oa_status = COALESCE($8, oa_status),
      referral_status = COALESCE($9, referral_status),
      response_status = COALESCE($10, response_status),
      application_status = COALESCE($11, application_status),
      notes = COALESCE($12, notes),
      date_saved = COALESCE($13::date, date_saved),
      archive_date = CASE
        WHEN LOWER(TRIM(COALESCE($11, ''))) = 'rejected' THEN COALESCE(archive_date, CURRENT_DATE)
        ELSE archive_date
      END,
      updated_at = NOW()
    WHERE id = $14 AND user_id = $15
    RETURNING *
    `,
    [
      p.role ?? null,
      p.company ?? null,
      p.location_raw ?? null,
      p.job_link ?? null,
      p.job_application_id?.trim() ? p.job_application_id.trim() : null,
      p.oa_deadline_date ?? null,
      normalizeKeywordMatching(p.keyword_matching),
      normalizeOaStatus(p.oa_status),
      normalizeReferralStatus(p.referral_status),
      p.response_status ?? null,
      p.application_status ?? null,
      p.notes ?? null,
      p.date_saved ?? null,
      id,
      userId,
    ],
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  await syncReferralFromJob(c.env, userId, row as Record<string, unknown>, { referredByName: p.referred_by_name ?? null });
  return c.json(row);
});

app.delete("/api/jobs/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/oa/active", async (c) => {
  const userId = c.get("authUser").id;
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));

  // Reopen archive rows explicitly marked Pending:
  // move fields back to jobs as active OA and remove from archive table.
  await query(
    c.env,
    `
    WITH pending_archive AS (
      SELECT *
      FROM online_assessment_records
      WHERE user_id = $1
        AND oa_result = 'Pending'
    )
    UPDATE jobs j
    SET
      role = COALESCE(p.role, j.role),
      company = COALESCE(p.company, j.company),
      location_raw = COALESCE(p.location_raw, j.location_raw),
      job_link = COALESCE(p.job_link, j.job_link),
      job_application_id = COALESCE(p.job_application_id, j.job_application_id),
      oa_deadline_date = COALESCE(p.oa_deadline_date, j.oa_deadline_date),
      keyword_matching = COALESCE(p.keyword_matching, j.keyword_matching),
      oa_status = 'Yes',
      referral_status = COALESCE(p.referral_status, j.referral_status),
      response_status = COALESCE(p.response_status, j.response_status),
      application_status = CASE
        WHEN LOWER(TRIM(COALESCE(j.application_status, ''))) = 'rejected' THEN 'Applied'
        ELSE COALESCE(NULLIF(TRIM(p.application_status), ''), j.application_status)
      END,
      notes = COALESCE(p.notes, j.notes),
      date_saved = COALESCE(p.date_saved, j.date_saved),
      applied_at = COALESCE(p.applied_at, j.applied_at),
      updated_at = NOW()
    FROM pending_archive p
    WHERE j.id = p.job_id
      AND j.user_id = $1
    `,
    [userId],
  );

  await query(
    c.env,
    `
    DELETE FROM online_assessment_records
    WHERE user_id = $1
      AND oa_result = 'Pending'
    `,
    [userId],
  );

  // Auto-archive overdue OA items as missed so Active OA only shows actionable items.
  await query(
    c.env,
    `
    INSERT INTO online_assessment_records (
      user_id,
      job_id,
      source,
      role,
      company,
      location_raw,
      job_link,
      job_application_id,
      oa_deadline_date,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes,
      date_saved,
      applied_at,
      archive_date,
      oa_completed_date,
      oa_completed_at,
      oa_result,
      oa_result_date
    )
    SELECT
      j.user_id,
      j.id,
      'oa-auto-missed',
      j.role,
      j.company,
      j.location_raw,
      j.job_link,
      j.job_application_id,
      j.oa_deadline_date,
      j.keyword_matching,
      j.oa_status,
      j.referral_status,
      j.response_status,
      j.application_status,
      j.notes,
      j.date_saved,
      j.applied_at,
      j.archive_date,
      COALESCE($2::date, CURRENT_DATE),
      NOW(),
      'Missed',
      COALESCE($2::date, CURRENT_DATE)
    FROM jobs j
    LEFT JOIN online_assessment_records oar
      ON oar.job_id = j.id AND oar.user_id = j.user_id
    WHERE j.user_id = $1
      AND LOWER(TRIM(COALESCE(j.oa_status, ''))) = 'yes'
      AND LOWER(TRIM(COALESCE(j.application_status, 'Applied'))) != 'rejected'
      AND j.oa_deadline_date IS NOT NULL
      AND j.oa_deadline_date < COALESCE($2::date, CURRENT_DATE)
      AND oar.id IS NULL
    ON CONFLICT (job_id) DO UPDATE SET
      source = EXCLUDED.source,
      role = EXCLUDED.role,
      company = EXCLUDED.company,
      location_raw = EXCLUDED.location_raw,
      job_link = EXCLUDED.job_link,
      job_application_id = EXCLUDED.job_application_id,
      oa_deadline_date = EXCLUDED.oa_deadline_date,
      keyword_matching = EXCLUDED.keyword_matching,
      oa_status = EXCLUDED.oa_status,
      referral_status = EXCLUDED.referral_status,
      response_status = EXCLUDED.response_status,
      application_status = EXCLUDED.application_status,
      notes = EXCLUDED.notes,
      date_saved = EXCLUDED.date_saved,
      applied_at = EXCLUDED.applied_at,
      archive_date = EXCLUDED.archive_date,
      oa_completed_date = EXCLUDED.oa_completed_date,
      oa_completed_at = NOW(),
      oa_result = 'Missed',
      oa_result_date = EXCLUDED.oa_result_date,
      updated_at = NOW()
    `,
    [userId, anchorDay],
  );

  const rows = await query<Record<string, unknown>>(
    c.env,
    `
    SELECT
      j.*,
      j.date_saved::text AS date_saved_text,
      j.applied_at::text AS applied_at_text,
      j.oa_deadline_date::text AS oa_deadline_date_text,
      CASE
        WHEN j.oa_deadline_date IS NULL THEN 'no_deadline'
        WHEN j.oa_deadline_date < COALESCE($2::date, CURRENT_DATE) THEN 'overdue'
        WHEN j.oa_deadline_date = COALESCE($2::date, CURRENT_DATE) THEN 'today'
        ELSE 'upcoming'
      END AS oa_urgency,
      CASE
        WHEN j.oa_deadline_date IS NULL THEN NULL
        ELSE (j.oa_deadline_date - COALESCE($2::date, CURRENT_DATE))
      END::int AS days_to_deadline
    FROM jobs j
    LEFT JOIN online_assessment_records oar
      ON oar.job_id = j.id AND oar.user_id = j.user_id
    WHERE j.user_id = $1
      AND LOWER(TRIM(COALESCE(j.oa_status, ''))) = 'yes'
      AND LOWER(TRIM(COALESCE(j.application_status, 'Applied'))) != 'rejected'
      AND oar.id IS NULL
    ORDER BY
      CASE
        WHEN j.oa_deadline_date IS NOT NULL AND j.oa_deadline_date < COALESCE($2::date, CURRENT_DATE) THEN 0
        WHEN j.oa_deadline_date IS NOT NULL THEN 1
        ELSE 2
      END ASC,
      j.oa_deadline_date ASC NULLS LAST,
      COALESCE(j.applied_at, j.date_saved, j.created_at) DESC NULLS LAST,
      j.id DESC
    `,
    [userId, anchorDay],
  );
  return c.json({ anchorDay: anchorDay ?? null, data: rows });
});

const oaCompleteInput = z.object({
  oa_completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

app.post("/api/oa/complete/:jobId", async (c) => {
  const userId = c.get("authUser").id;
  const jobId = c.req.param("jobId");
  const parsed = oaCompleteInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const completedDate = parsed.data.oa_completed_date ?? null;

  const [existing] = await query<{ id: number }>(
    c.env,
    "SELECT id FROM online_assessment_records WHERE user_id = $1 AND job_id = $2 LIMIT 1",
    [userId, jobId],
  );

  const rows = await query<Record<string, unknown>>(
    c.env,
    `
    INSERT INTO online_assessment_records (
      user_id,
      job_id,
      source,
      role,
      company,
      location_raw,
      job_link,
      job_application_id,
      oa_deadline_date,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes,
      date_saved,
      applied_at,
      archive_date,
      oa_completed_date,
      oa_completed_at
      ,
      oa_result,
      oa_result_date
    )
    SELECT
      j.user_id,
      j.id,
      COALESCE(j.source, 'oa-completed'),
      j.role,
      j.company,
      j.location_raw,
      j.job_link,
      j.job_application_id,
      j.oa_deadline_date,
      j.keyword_matching,
      j.oa_status,
      j.referral_status,
      j.response_status,
      j.application_status,
      j.notes,
      j.date_saved,
      j.applied_at,
      j.archive_date,
      COALESCE($3::date, CURRENT_DATE),
      NOW(),
      'Completed',
      COALESCE($3::date, CURRENT_DATE)
    FROM jobs j
    WHERE j.id = $2
      AND j.user_id = $1
      AND LOWER(TRIM(COALESCE(j.oa_status, ''))) = 'yes'
    ON CONFLICT (job_id) DO UPDATE SET
      source = EXCLUDED.source,
      role = EXCLUDED.role,
      company = EXCLUDED.company,
      location_raw = EXCLUDED.location_raw,
      job_link = EXCLUDED.job_link,
      job_application_id = EXCLUDED.job_application_id,
      oa_deadline_date = EXCLUDED.oa_deadline_date,
      keyword_matching = EXCLUDED.keyword_matching,
      oa_status = EXCLUDED.oa_status,
      referral_status = EXCLUDED.referral_status,
      response_status = EXCLUDED.response_status,
      application_status = EXCLUDED.application_status,
      notes = EXCLUDED.notes,
      date_saved = EXCLUDED.date_saved,
      applied_at = EXCLUDED.applied_at,
      archive_date = EXCLUDED.archive_date,
      oa_completed_date = EXCLUDED.oa_completed_date,
      oa_completed_at = NOW(),
      oa_result = 'Completed',
      oa_result_date = EXCLUDED.oa_result_date,
      updated_at = NOW()
    RETURNING *
    `,
    [userId, jobId, completedDate],
  );

  if (!rows.length) {
    return c.json({ error: "OA-enabled job not found." }, 404);
  }

  return c.json({ already_completed: Boolean(existing), record: rows[0] });
});

app.get("/api/oa/archive", async (c) => {
  const userId = c.get("authUser").id;
  const rows = await query<Record<string, unknown>>(
    c.env,
    `
    SELECT
      id,
      user_id,
      job_id,
      source,
      role,
      company,
      location_raw,
      job_link,
      job_application_id,
      oa_deadline_date::text AS oa_deadline_date,
      keyword_matching,
      oa_status,
      referral_status,
      response_status,
      application_status,
      notes,
      date_saved::text AS date_saved,
      applied_at::text AS applied_at,
      archive_date::text AS archive_date,
      oa_result,
      oa_result_date::text AS oa_result_date,
      oa_completed_date::text AS oa_completed_date,
      oa_completed_at::text AS oa_completed_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
    FROM online_assessment_records oar
    WHERE oar.user_id = $1
    ORDER BY oar.oa_result_date DESC NULLS LAST, oar.oa_completed_at DESC NULLS LAST, oar.id DESC
    LIMIT 200
    `,
    [userId],
  );
  return c.json({ data: rows });
});

const oaArchiveUpdateInput = z.object({
  role: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  location_raw: z.string().optional().nullable(),
  job_link: z.string().optional().nullable(),
  job_application_id: z.string().optional().nullable(),
  oa_deadline_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional().nullable(),
  oa_status: z.string().optional().nullable(),
  referral_status: z.string().optional().nullable(),
  response_status: z.string().optional().nullable(),
  application_status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date_saved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  oa_result: z.enum(["Pending", "Completed", "Missed"]).optional().nullable(),
  oa_result_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  oa_completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

app.patch("/api/oa/archive/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = oaArchiveUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;

  // Reopen flow: Status = Pending means move this row back to active OA.
  // Active OA is sourced from jobs table and excludes rows that exist in archive.
  if (p.oa_result === "Pending") {
    const [existing] = await query<Record<string, unknown>>(
      c.env,
      "SELECT * FROM online_assessment_records WHERE id = $1 AND user_id = $2 LIMIT 1",
      [id, userId],
    );
    if (!existing) return c.json({ error: "Record not found" }, 404);

    const jobId = Number(existing.job_id);
    if (!Number.isFinite(jobId)) {
      return c.json({ error: "Cannot reopen record without a valid job reference." }, 400);
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (p.role !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(p.role == null ? null : p.role.trim());
    }
    if (p.company !== undefined) {
      updates.push(`company = $${i++}`);
      values.push(p.company == null ? null : p.company.trim());
    }
    if (p.location_raw !== undefined) {
      updates.push(`location_raw = $${i++}`);
      values.push(p.location_raw == null ? null : p.location_raw.trim());
    }
    if (p.job_link !== undefined) {
      updates.push(`job_link = $${i++}`);
      values.push(p.job_link == null ? null : p.job_link.trim());
    }
    if (p.job_application_id !== undefined) {
      updates.push(`job_application_id = $${i++}`);
      values.push(p.job_application_id == null ? null : p.job_application_id.trim());
    }
    if (p.oa_deadline_date !== undefined) {
      updates.push(`oa_deadline_date = $${i++}::date`);
      values.push(p.oa_deadline_date ?? null);
    }
    if (p.keyword_matching !== undefined) {
      updates.push(`keyword_matching = $${i++}`);
      values.push(normalizeKeywordMatching(p.keyword_matching));
    }
    if (p.referral_status !== undefined) {
      updates.push(`referral_status = $${i++}`);
      values.push(normalizeReferralStatus(p.referral_status));
    }
    if (p.response_status !== undefined) {
      updates.push(`response_status = $${i++}`);
      values.push(p.response_status == null ? null : p.response_status.trim());
    }
    if (p.application_status !== undefined) {
      updates.push(`application_status = $${i++}`);
      values.push(p.application_status == null ? null : p.application_status.trim());
    }
    if (p.notes !== undefined) {
      updates.push(`notes = $${i++}`);
      values.push(p.notes == null ? null : p.notes.trim());
    }
    if (p.date_saved !== undefined) {
      updates.push(`date_saved = $${i++}::date`);
      values.push(p.date_saved ?? null);
    }

    // Explicitly reopen as active OA.
    updates.push(`oa_status = 'Yes'`);

    values.push(jobId);
    values.push(userId);
    const [job] = await query<Record<string, unknown>>(
      c.env,
      `UPDATE jobs SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND user_id = $${i} RETURNING id`,
      values,
    );
    if (!job) return c.json({ error: "Linked job not found for reopen." }, 404);

    await query(
      c.env,
      "DELETE FROM online_assessment_records WHERE id = $1 AND user_id = $2",
      [id, userId],
    );

    return c.json({ reopened: true, job_id: jobId });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (p.role !== undefined) {
    updates.push(`role = $${i++}`);
    values.push(p.role == null ? null : p.role.trim());
  }
  if (p.company !== undefined) {
    updates.push(`company = $${i++}`);
    values.push(p.company == null ? null : p.company.trim());
  }
  if (p.location_raw !== undefined) {
    updates.push(`location_raw = $${i++}`);
    values.push(p.location_raw == null ? null : p.location_raw.trim());
  }
  if (p.job_link !== undefined) {
    updates.push(`job_link = $${i++}`);
    values.push(p.job_link == null ? null : p.job_link.trim());
  }
  if (p.job_application_id !== undefined) {
    updates.push(`job_application_id = $${i++}`);
    values.push(p.job_application_id == null ? null : p.job_application_id.trim());
  }
  if (p.oa_deadline_date !== undefined) {
    updates.push(`oa_deadline_date = $${i++}::date`);
    values.push(p.oa_deadline_date ?? null);
  }
  if (p.keyword_matching !== undefined) {
    updates.push(`keyword_matching = $${i++}`);
    values.push(normalizeKeywordMatching(p.keyword_matching));
  }
  if (p.oa_status !== undefined) {
    updates.push(`oa_status = $${i++}`);
    values.push(normalizeOaStatus(p.oa_status));
  }
  if (p.referral_status !== undefined) {
    updates.push(`referral_status = $${i++}`);
    values.push(normalizeReferralStatus(p.referral_status));
  }
  if (p.response_status !== undefined) {
    updates.push(`response_status = $${i++}`);
    values.push(p.response_status == null ? null : p.response_status.trim());
  }
  if (p.application_status !== undefined) {
    updates.push(`application_status = $${i++}`);
    values.push(p.application_status == null ? null : p.application_status.trim());
  }
  if (p.notes !== undefined) {
    updates.push(`notes = $${i++}`);
    values.push(p.notes == null ? null : p.notes.trim());
  }
  if (p.date_saved !== undefined) {
    updates.push(`date_saved = $${i++}::date`);
    values.push(p.date_saved ?? null);
  }
  if (p.oa_result !== undefined) {
    updates.push(`oa_result = $${i++}`);
    values.push(p.oa_result ?? null);
  }
  if (p.oa_result_date !== undefined) {
    updates.push(`oa_result_date = $${i++}::date`);
    values.push(p.oa_result_date ?? null);
  }
  if (p.oa_completed_date !== undefined) {
    updates.push(`oa_completed_date = $${i++}::date`);
    values.push(p.oa_completed_date ?? null);
  }

  if (!updates.length) return c.json({ error: "No fields to update" }, 400);

  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE online_assessment_records SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Record not found" }, 404);
  return c.json(row);
});

app.delete("/api/oa/archive/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM online_assessment_records WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Record not found" }, 404);
  return c.json({ ok: true });
});

const referralInput = z.object({
  company: z.string().min(1),
  request_log: z.string().optional(),
  request_date: z.string().optional(),
  request_link: z.string().url().optional(),
  referral_received: z.string().optional(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional(),
  referred_by_name: z.string().optional(),
  comment: z.string().optional(),
});

app.get("/api/referrals", async (c) => {
  const userId = c.get("authUser").id;
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25) || 25, 1), 100);
  const offset = (page - 1) * limit;
  const filter = String(c.req.query("filter") ?? "").trim().toLowerCase();
  const searchQuery = String(c.req.query("search") ?? "").trim();

  const whereParts: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];
  let paramIdx = 2;
  if (filter === "open") {
    whereParts.push(`COALESCE(TRIM(referral_received), '') = 'Requested'`);
  } else if (filter === "applied") {
    whereParts.push(`COALESCE(TRIM(referral_received), '') = 'Yes'`);
  }
  if (searchQuery) {
    whereParts.push(`(
      COALESCE(company, '') ILIKE $${paramIdx}
      OR COALESCE(request_log, '') ILIKE $${paramIdx}
      OR COALESCE(referred_by_name, '') ILIKE $${paramIdx}
    )`);
    params.push(`%${searchQuery}%`);
    paramIdx += 1;
  }

  const whereClause = ` WHERE ${whereParts.join(" AND ")}`;
  const [countRow] = await query<{ total: number }>(
    c.env,
    `SELECT COUNT(*)::int AS total FROM referrals${whereClause}`,
    params as unknown[],
  );
  const total = Number(countRow?.total ?? 0);

  const orderBy = filter === "applied"
    ? "ORDER BY COALESCE(updated_date, request_date) DESC NULLS LAST, id DESC"
    : "ORDER BY request_date DESC NULLS LAST, id DESC";
  params.push(limit, offset);
  const rows = await query(
    c.env,
    `SELECT * FROM referrals${whereClause} ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params as unknown[],
  );
  return c.json({ page, limit, total, data: rows });
});

app.post("/api/referrals", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = referralInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `
    INSERT INTO referrals (user_id, source, company, request_log, request_date, updated_date, request_link, referral_received, keyword_matching, referred_by_name, comment)
    VALUES ($1, 'manual', $2, $3, $4::date, COALESCE($4::date, CURRENT_DATE), $5, $6, COALESCE($7, 'Medium'), $8, $9)
    RETURNING *
    `,
    [
      userId,
      p.company,
      p.request_log ?? null,
      p.request_date ?? null,
      p.request_link ?? null,
      normalizeReferralStatus(p.referral_received),
      normalizeKeywordMatching(p.keyword_matching),
      p.referred_by_name ?? null,
      p.comment ?? null,
    ],
  );
  return c.json(row, 201);
});

app.get("/api/referrals/trend", async (c) => {
  const env = c.env;
  const userId = c.get("authUser").id;
  const days = Math.max(7, Math.min(60, Number(c.req.query("days") ?? 30)));
  const anchorDay = parseAnchorDay(c.req.query("anchorDay"));
  const anchorDateSql = anchorDay ? `$2::date` : `CURRENT_DATE`;
  const params = anchorDay ? [userId, anchorDay] : [userId];

  // Daily counts of Requested (from referrals table) vs Referral received (from jobs table with referral_status='Yes')
  const trendData = await query<{ day: string; requested: number; received: number }>(
    env,
    `
    SELECT
      d.day::text AS day,
      COALESCE(req.cnt, 0)::int AS requested,
      COALESCE(rec.cnt, 0)::int AS received
    FROM (
      SELECT generate_series(
        (${anchorDateSql} - (${days}::text || ' days')::interval)::date,
        ${anchorDateSql}::date,
        '1 day'::interval
      )::date AS day
    ) d
    LEFT JOIN (
      SELECT DATE(request_date) AS day, COUNT(*)::int AS cnt
      FROM referrals
      WHERE user_id = $1
        AND request_date IS NOT NULL
        AND (TRIM(COALESCE(referral_received, '')) = 'Requested' OR TRIM(COALESCE(referral_received, '')) = '' OR referral_received IS NULL)
      GROUP BY DATE(request_date)
    ) req ON req.day = d.day
    LEFT JOIN (
      SELECT DATE(date_saved) AS day, COUNT(*)::int AS cnt
      FROM jobs
      WHERE user_id = $1
        AND date_saved IS NOT NULL
        AND TRIM(COALESCE(referral_status, '')) = 'Yes'
      GROUP BY DATE(date_saved)
    ) rec ON rec.day = d.day
    ORDER BY d.day ASC
    `,
    params,
  );

  return c.json({ data: trendData });
});

app.get("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const [row] = await query(c.env, "SELECT * FROM referrals WHERE id = $1 AND user_id = $2 LIMIT 1", [id, userId]);
  if (!row) return c.json({ error: "Referral not found" }, 404);
  return c.json(row);
});

const referralUpdateInput = z.object({
  company: z.string().min(1).optional(),
  request_log: z.string().optional(),
  request_date: z.string().optional(),
  request_link: z.string().url().optional().nullable(),
  referral_received: z.string().optional().nullable(),
  keyword_matching: z.enum(["Strong", "Medium", "Weak", "Week"]).optional().nullable(),
  referred_by_name: z.string().optional().nullable(),
  comment: z.string().optional(),
});

app.patch("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = referralUpdateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.company !== undefined) {
    updates.push(`company = $${i++}`);
    values.push(p.company);
  }
  if (p.request_log !== undefined) {
    updates.push(`request_log = $${i++}`);
    values.push(p.request_log);
  }
  if (p.request_date !== undefined) {
    updates.push(`request_date = $${i++}`);
    values.push(p.request_date);
  }
  if (p.request_link !== undefined) {
    updates.push(`request_link = $${i++}`);
    values.push(p.request_link);
  }
  if (p.referral_received !== undefined) {
    updates.push(`referral_received = $${i++}`);
    values.push(p.referral_received == null ? null : normalizeReferralStatus(p.referral_received));
  }
  if (p.keyword_matching !== undefined) {
    updates.push(`keyword_matching = $${i++}`);
    values.push(normalizeKeywordMatching(p.keyword_matching));
  }
  if (p.referred_by_name !== undefined) {
    updates.push(`referred_by_name = $${i++}`);
    values.push(p.referred_by_name);
  }
  if (p.comment !== undefined) {
    updates.push(`comment = $${i++}`);
    values.push(p.comment);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE referrals SET ${updates.join(", ")}, updated_date = CURRENT_DATE, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Referral not found" }, 404);
  return c.json(row);
});

app.delete("/api/referrals/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM referrals WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Referral not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/notes", async (c) => {
  const userId = c.get("authUser").id;
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 25), 100);
  const offset = (page - 1) * limit;
  const showArchive = c.req.query("archive") === "true";
  const showOnDashboard = c.req.query("show_on_dashboard");
  const onlyDashboard = showOnDashboard === "true";
  const whereDashboard = onlyDashboard ? " AND show_on_dashboard = TRUE" : "";
  const rows = await query(
    c.env,
    `
    SELECT *
    FROM daily_notes
    WHERE user_id = $1 AND is_done = $2${whereDashboard}
    ORDER BY id DESC
    LIMIT $3 OFFSET $4
    `,
    [userId, showArchive, limit, offset],
  );
  return c.json({ page, limit, data: rows });
});

const noteInput = z.object({
  note_date: z.string().optional(),
  comments: z.string().min(1),
  priority: z.enum(["High", "Medium", "Low", "Archive"]).optional(),
  show_on_dashboard: z.boolean().optional(),
});

app.post("/api/notes", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = noteInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    "INSERT INTO daily_notes (user_id, source, note_date, comments, priority, show_on_dashboard, is_done) VALUES ($1, 'manual', $2, $3, $4, $5, FALSE) RETURNING *",
    [userId, p.note_date ?? null, p.comments, p.priority ?? "Medium", p.show_on_dashboard ?? true],
  );
  return c.json(row, 201);
});

const noteEditInput = z.object({
  note_date: z.string().optional(),
  comments: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low", "Archive"]).optional(),
  show_on_dashboard: z.boolean().optional(),
  is_done: z.boolean().optional(),
});

app.patch("/api/notes/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = noteEditInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.note_date !== undefined) {
    updates.push(`note_date = $${i++}`);
    values.push(p.note_date);
  }
  if (p.comments !== undefined) {
    updates.push(`comments = $${i++}`);
    values.push(p.comments);
  }
  if (p.priority !== undefined) {
    updates.push(`priority = $${i++}`);
    values.push(p.priority);
  }
  if (p.show_on_dashboard !== undefined) {
    updates.push(`show_on_dashboard = $${i++}`);
    values.push(p.show_on_dashboard);
  }
  if (p.is_done !== undefined) {
    updates.push(`is_done = $${i++}`);
    values.push(p.is_done);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE daily_notes SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.delete("/api/notes/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const rows = await query(
    c.env,
    "DELETE FROM daily_notes WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/pending", async (c) => {
  const userId = c.get("authUser").id;
  const showArchive = c.req.query("archive") === "true";
  let rows;
  if (showArchive) {
    rows = await query(
      c.env,
      "SELECT * FROM pending_items WHERE user_id = $1 AND is_done = TRUE ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 200",
      [userId],
    );
  } else {
    rows = await query(
      c.env,
      "SELECT * FROM pending_items WHERE user_id = $1 AND is_done = FALSE ORDER BY pending_date DESC NULLS LAST, id DESC LIMIT 200",
      [userId],
    );
  }
  return c.json({ data: rows });
});

const pendingPostInput = z.object({
  company: z.string().min(1),
  position_name: z.string().optional(),
  pending_date: z.string().optional(),
  end_date: z.string().optional(),
  comment: z.string().optional(),
  link: z.union([z.string().url(), z.literal("")]).optional(),
});
app.post("/api/pending", async (c) => {
  const userId = c.get("authUser").id;
  const parsed = pendingPostInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const [row] = await query(
    c.env,
    `INSERT INTO pending_items (user_id, source, company, position_name, pending_date, end_date, comment, link)
     VALUES ($1, 'manual', $2, $3, $4::date, $5::date, $6, $7) RETURNING *`,
    [
      userId,
      p.company.trim(),
      p.position_name?.trim() || null,
      p.pending_date || null,
      p.end_date || null,
      p.comment?.trim() || null,
      p.link?.trim() || null,
    ],
  );
  return c.json(row, 201);
});

const pendingEditInput = z.object({
  company: z.string().min(1).optional(),
  position_name: z.string().optional(),
  pending_date: z.string().optional(),
  end_date: z.string().optional(),
  comment: z.string().optional(),
  link: z.union([z.string().url(), z.literal("")]).optional(),
  is_done: z.boolean().optional(),
});

app.patch("/api/pending/:id", async (c) => {
  const userId = c.get("authUser").id;
  const id = c.req.param("id");
  const parsed = pendingEditInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (p.company !== undefined) {
    updates.push(`company = $${i++}`);
    values.push(p.company);
  }
  if (p.position_name !== undefined) {
    updates.push(`position_name = $${i++}`);
    values.push(p.position_name);
  }
  if (p.pending_date !== undefined) {
    updates.push(`pending_date = $${i++}`);
    values.push(p.pending_date);
  }
  if (p.end_date !== undefined) {
    updates.push(`end_date = $${i++}`);
    values.push(p.end_date);
  }
  if (p.comment !== undefined) {
    updates.push(`comment = $${i++}`);
    values.push(p.comment);
  }
  if (p.link !== undefined) {
    updates.push(`link = $${i++}`);
    values.push(p.link);
  }
  if (p.is_done !== undefined) {
    updates.push(`is_done = $${i++}`);
    values.push(p.is_done);
  }
  if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
  values.push(id);
  values.push(userId);
  const [row] = await query(
    c.env,
    `UPDATE pending_items SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    values,
  );
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return c.json({ error: message }, 500);
});

export default app;
