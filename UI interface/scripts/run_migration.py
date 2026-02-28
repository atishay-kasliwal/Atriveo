#!/usr/bin/env python3
"""Run all db/migrations/*.sql against DATABASE_URL/NEON_DATABASE_URL."""
import os
import sys
from pathlib import Path

import psycopg

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"


def main() -> None:
    url = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL")
    if not url:
        print("Set DATABASE_URL (or NEON_DATABASE_URL) and run again.", file=sys.stderr)
        sys.exit(1)
    if not MIGRATIONS_DIR.exists():
        print(f"Migrations directory not found: {MIGRATIONS_DIR}", file=sys.stderr)
        sys.exit(1)

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        print(f"No migrations found in {MIGRATIONS_DIR}", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for migration_file in migration_files:
                sql = migration_file.read_text()
                cur.execute(sql)
                print(f"Applied: {migration_file.name}")
        conn.commit()
    print("All migrations applied successfully.")


if __name__ == "__main__":
    main()
