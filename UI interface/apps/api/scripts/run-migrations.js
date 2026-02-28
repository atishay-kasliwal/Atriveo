/**
 * Run SQL migrations from db/migrations against DATABASE_URL/NEON_DATABASE_URL.
 * Usage (from repo root): DATABASE_URL='postgresql://...' node apps/api/scripts/run-migrations.js
 * Splits on ";" but respects dollar-quoted strings ($$ ... $$) so CREATE FUNCTION / DO blocks stay intact.
 */
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const migrationsDir = path.join(repoRoot, "db", "migrations");

function splitSqlStatements(body) {
  const statements = [];
  let current = "";
  let i = 0;
  let inDollarQuote = false;
  while (i < body.length) {
    if (inDollarQuote) {
      if (body.slice(i, i + 2) === "$$") {
        current += "$$";
        i += 2;
        inDollarQuote = false;
      } else {
        current += body[i];
        i++;
      }
    } else {
      if (body.slice(i, i + 2) === "--") {
        while (i < body.length && body[i] !== "\n") current += body[i++];
        continue;
      }
      if (body.slice(i, i + 2) === "$$") {
        current += "$$";
        i += 2;
        inDollarQuote = true;
      } else if (body[i] === ";") {
        let stmt = current.trim();
        // Strip leading comment/blank lines so "-- comment\n\nCREATE TABLE ..." is kept
        while (stmt.length > 0) {
          const firstLine = (stmt.split("\n")[0] || "").trim();
          if (firstLine.length === 0 || firstLine.startsWith("--")) {
            const idx = stmt.indexOf("\n");
            if (idx === -1) break;
            stmt = stmt.slice(idx + 1).trim();
          } else break;
        }
        if (stmt.length > 0) statements.push(stmt);
        current = "";
        i++;
      } else {
        current += body[i];
        i++;
      }
    }
  }
  let stmt = current.trim();
  while (stmt.length > 0) {
    const firstLine = (stmt.split("\n")[0] || "").trim();
    if (firstLine.length === 0 || firstLine.startsWith("--")) {
      const idx = stmt.indexOf("\n");
      if (idx === -1) break;
      stmt = stmt.slice(idx + 1).trim();
    } else break;
  }
  if (stmt.length > 0) statements.push(stmt);
  return statements;
}

const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (or NEON_DATABASE_URL) to run migrations.");
  process.exit(1);
}

const sql = neon(url);

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.log("No migration files in db/migrations.");
  process.exit(0);
}

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const body = fs.readFileSync(filePath, "utf8");
  const statements = splitSqlStatements(body);
  console.log(`Running ${file} (${statements.length} statement(s))...`);
  for (const statement of statements) {
    if (statement) await sql.query(statement + ";", []);
  }
  console.log(`  Done: ${file}`);
}
console.log("Migrations complete.");
