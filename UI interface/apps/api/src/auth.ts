import type { Context, Next } from "hono";
import { query } from "./db";
import type { AuthUser, Bindings } from "./types";

const DEFAULT_OWNER_EMAIL = "katishay@gmail.com";
const DEFAULT_PASSWORD_ITERATIONS = 100000;

function unauthorized(c: Context) {
  return c.json({ error: "Unauthorized" }, 401);
}

function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out as Uint8Array<ArrayBuffer>;
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getOwnerEmail(env: Bindings): string {
  return normalizeEmail(env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL);
}

export function getSessionTtlDays(env: Bindings): number {
  const parsed = Number(env.SESSION_TTL_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.floor(parsed), 90);
}

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

async function derivePasswordHash(password: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHex(saltHex),
      iterations,
    },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = randomHex(16);
  const iterations = DEFAULT_PASSWORD_ITERATIONS;
  const hash = await derivePasswordHash(password, salt, iterations);
  return { hash, salt, iterations };
}

export async function verifyPassword(password: string, hash: string, salt: string, iterations: number): Promise<boolean> {
  const computed = await derivePasswordHash(password, salt, iterations || DEFAULT_PASSWORD_ITERATIONS);
  return computed === hash;
}

export async function ensureOwnerUser(env: Bindings): Promise<AuthUser> {
  const email = getOwnerEmail(env);
  await query(
    env,
    "INSERT INTO dashboard_users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
    [email],
  );
  const [owner] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
    env,
    "SELECT id, email, first_name, last_name FROM dashboard_users WHERE email = $1 LIMIT 1",
    [email],
  );
  if (!owner) throw new Error("Owner user is not initialized");
  return owner;
}

export async function createSession(env: Bindings, userId: number): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const ttlDays = getSessionTtlDays(env);
  await query(
    env,
    `
    INSERT INTO dashboard_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, NOW() + ($3::text || ' days')::interval)
    `,
    [userId, tokenHash, ttlDays],
  );
  return token;
}

export async function revokeSession(env: Bindings, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await query(
    env,
    "UPDATE dashboard_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [tokenHash],
  );
}

export async function revokeAllUserSessions(env: Bindings, userId: number): Promise<void> {
  await query(
    env,
    "UPDATE dashboard_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
}

export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: { authUser: AuthUser } }>,
  next: Next,
) {
  const rawBearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const bearer = rawBearer != null ? rawBearer.trim() : "";
  if (!bearer) return unauthorized(c);

  const sharedToken = c.env.API_SHARED_TOKEN?.trim();
  if (sharedToken && bearer === sharedToken) {
    const owner = await ensureOwnerUser(c.env);
    c.set("authUser", owner);
    await next();
    return;
  }

  const tokenHash = await sha256Hex(bearer);
  const [sessionUser] = await query<{ id: number; email: string; first_name: string | null; last_name: string | null }>(
    c.env,
    `
    SELECT u.id, u.email, u.first_name, u.last_name
    FROM dashboard_sessions s
    JOIN dashboard_users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash],
  );

  if (!sessionUser) return unauthorized(c);

  c.set("authUser", {
    id: Number(sessionUser.id),
    email: String(sessionUser.email),
    first_name: sessionUser.first_name ?? null,
    last_name: sessionUser.last_name ?? null,
  });
  await next();
}
