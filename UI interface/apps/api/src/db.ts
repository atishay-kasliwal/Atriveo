import { neon } from "@neondatabase/serverless";
import type { Bindings } from "./types";

export function getSql(env: Bindings) {
  if (!env.NEON_DATABASE_URL) {
    throw new Error("Missing NEON_DATABASE_URL secret");
  }
  return neon(env.NEON_DATABASE_URL);
}

export async function query<T = unknown>(
  env: Bindings,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sql = getSql(env);
  const rows = await sql.query(text, params);
  return rows as T[];
}

export type SqlStatement = {
  text: string;
  params?: unknown[];
};

export async function transaction(
  env: Bindings,
  statements: SqlStatement[],
): Promise<unknown[][]> {
  if (!statements.length) return [];
  const sql = getSql(env);
  const queries = statements.map((stmt) => sql.query(stmt.text, stmt.params ?? []));
  return sql.transaction(queries);
}
