#!/usr/bin/env python3
import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg

DEFAULT_OWNER_EMAIL = "katishay@gmail.com"


@dataclass
class ImportStats:
    jobs_inserted: int = 0
    referrals_inserted: int = 0
    referrals_synced_updated: int = 0
    referrals_synced_inserted: int = 0
    notes_inserted: int = 0
    pending_inserted: int = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "jobs_inserted": self.jobs_inserted,
            "referrals_inserted": self.referrals_inserted,
            "referrals_synced_updated": self.referrals_synced_updated,
            "referrals_synced_inserted": self.referrals_synced_inserted,
            "notes_inserted": self.notes_inserted,
            "pending_inserted": self.pending_inserted,
        }


def normalize_nan(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    return value


def to_date(value: Any) -> Any:
    value = normalize_nan(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    try:
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()
    except Exception:
        return None


def to_timestamp(value: Any) -> Any:
    value = normalize_nan(value)
    if value is None:
        return None
    try:
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.to_pydatetime()
    except Exception:
        return None


def get_df(xls: pd.ExcelFile, sheet_name: str) -> pd.DataFrame:
    return pd.read_excel(xls, sheet_name=sheet_name)


def resolve_owner_user_id(cur: psycopg.Cursor) -> int:
    owner_email = (os.getenv("OWNER_EMAIL") or DEFAULT_OWNER_EMAIL).strip().lower()
    cur.execute(
        "INSERT INTO dashboard_users (email) VALUES (%s) ON CONFLICT (email) DO NOTHING",
        (owner_email,),
    )
    cur.execute("SELECT id FROM dashboard_users WHERE email = %s LIMIT 1", (owner_email,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Failed to resolve owner user for email: {owner_email}")
    return int(row[0])


def import_jobs(cur: psycopg.Cursor, xls: pd.ExcelFile, stats: ImportStats, user_id: int) -> None:
    df = get_df(xls, "Enhanced Jobs Data")
    for idx, row in df.iterrows():
        if idx == 0:
            continue
        company = normalize_nan(row.get("Company"))
        role = normalize_nan(row.get("Role"))
        if company is None and role is None:
            continue
        cur.execute(
            """
            INSERT INTO jobs (
              source, source_row, date_saved, role, company, location_raw, job_link,
              oa_status, referral_status, response_status, application_count,
              applied_time_raw, applicant_count_raw, notes, user_id
            )
            VALUES (
              'import', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                idx + 2,
                to_timestamp(row.get("Date Saved")),
                role,
                company,
                normalize_nan(row.get("Location")),
                normalize_nan(row.get("Job Link")),
                normalize_nan(row.get("OA")),
                normalize_nan(row.get("Referral")),
                normalize_nan(row.get("Response")),
                normalize_nan(row.get("Application Count")),
                normalize_nan(row.get("Application Applied Time")),
                normalize_nan(row.get("Number of Applicant")),
                normalize_nan(row.get("Comment")),
                user_id,
            ),
        )
        stats.jobs_inserted += 1


def import_referrals(cur: psycopg.Cursor, xls: pd.ExcelFile, stats: ImportStats, user_id: int) -> None:
    df = get_df(xls, "Archive Referral List")
    for idx, row in df.iterrows():
        if idx == 0:
            continue
        company = normalize_nan(row.get("Company Name"))
        if company is None:
            continue
        cur.execute(
            """
            INSERT INTO referrals (
              source, source_row, company, request_log, request_date, updated_date,
              request_link, referral_received, comment, message_ready, resume_ready, user_id
            )
            VALUES (
              'import', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                idx + 2,
                company,
                normalize_nan(row.get("Request Log")),
                to_date(row.get("Request Date")),
                to_date(row.get("Updated Date")),
                normalize_nan(row.get("Request Link")),
                normalize_nan(row.get("Referral Received")),
                normalize_nan(row.get("Comment")),
                normalize_nan(row.get("Message Ready")),
                normalize_nan(row.get("Resume Ready")),
                user_id,
            ),
        )
        stats.referrals_inserted += 1


def import_notes(cur: psycopg.Cursor, xls: pd.ExcelFile, stats: ImportStats, user_id: int) -> None:
    df = get_df(xls, "Daily Notes")
    cols = list(df.columns)
    if len(cols) < 2:
        return
    date_col, comment_col = cols[0], cols[1]
    for idx, row in df.iterrows():
        if idx == 0:
            continue
        comment = normalize_nan(row.get(comment_col))
        note_date = normalize_nan(row.get(date_col))
        if comment is None and note_date is None:
            continue
        cur.execute(
            """
            INSERT INTO daily_notes (source, source_row, note_date, comments, user_id)
            VALUES ('import', %s, %s, %s, %s)
            """,
            (idx + 2, str(note_date) if note_date is not None else None, comment, user_id),
        )
        stats.notes_inserted += 1


def import_pending(cur: psycopg.Cursor, xls: pd.ExcelFile, stats: ImportStats, user_id: int) -> None:
    df = get_df(xls, "Pending Work 23th Feb")
    for idx, row in df.iterrows():
        if idx == 0:
            continue
        company = normalize_nan(row.get("Company Name"))
        if company is None:
            continue
        cur.execute(
            """
            INSERT INTO pending_items (
              source, source_row, company, position_name, pending_date, updated_date,
              comment, link, drafted_message, user_id
            )
            VALUES ('import', %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                idx + 2,
                company,
                normalize_nan(row.get("Position Name")),
                to_date(row.get("Current Date")),
                to_date(row.get("Updated Date")),
                normalize_nan(row.get("Comment")),
                normalize_nan(row.get("Link")),
                normalize_nan(row.iloc[-1]) if len(row) > 0 else None,
                user_id,
            ),
        )
        stats.pending_inserted += 1


def sync_referrals_from_jobs(cur: psycopg.Cursor, user_id: int) -> tuple[int, int]:
    cur.execute(
        """
        WITH candidate_jobs AS (
          SELECT
            j.id AS job_id,
            j.user_id,
            TRIM(j.company) AS company,
            TRIM(j.role) AS request_log,
            COALESCE(j.date_saved::date, j.applied_at::date, CURRENT_DATE) AS request_date,
            NULLIF(TRIM(COALESCE(j.job_link, '')), '') AS request_link,
            CASE
              WHEN LOWER(TRIM(COALESCE(j.referral_status, ''))) = 'requested' THEN 'Requested'
              WHEN LOWER(TRIM(COALESCE(j.referral_status, ''))) = 'yes' THEN 'Yes'
              ELSE NULL
            END AS referral_received,
            COALESCE(NULLIF(TRIM(COALESCE(j.keyword_matching, '')), ''), 'Medium') AS keyword_matching,
            NULLIF(TRIM(COALESCE(j.notes, '')), '') AS comment
          FROM jobs j
          WHERE j.user_id = %s
            AND TRIM(COALESCE(j.company, '')) <> ''
            AND TRIM(COALESCE(j.role, '')) <> ''
            AND LOWER(TRIM(COALESCE(j.referral_status, ''))) IN ('requested', 'yes')
        ),
        job_with_match AS (
          SELECT
            cj.*,
            COALESCE(
              (
                SELECT r.id
                FROM referrals r
                WHERE r.user_id = cj.user_id
                  AND cj.request_link IS NOT NULL
                  AND NULLIF(TRIM(COALESCE(r.request_link, '')), '') = cj.request_link
                ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
                LIMIT 1
              ),
              (
                SELECT r.id
                FROM referrals r
                WHERE r.user_id = cj.user_id
                  AND LOWER(TRIM(r.company)) = LOWER(cj.company)
                  AND LOWER(TRIM(COALESCE(r.request_log, ''))) = LOWER(cj.request_log)
                ORDER BY COALESCE(r.updated_date, r.request_date) DESC NULLS LAST, r.id DESC
                LIMIT 1
              )
            ) AS referral_id
          FROM candidate_jobs cj
        ),
        updated AS (
          UPDATE referrals r
          SET
            company = m.company,
            request_log = m.request_log,
            request_date = COALESCE(m.request_date, r.request_date),
            updated_date = COALESCE(m.request_date, CURRENT_DATE),
            request_link = COALESCE(m.request_link, r.request_link),
            referral_received = m.referral_received,
            keyword_matching = COALESCE(m.keyword_matching, r.keyword_matching, 'Medium'),
            comment = COALESCE(m.comment, r.comment),
            updated_at = NOW()
          FROM job_with_match m
          WHERE m.referral_id IS NOT NULL
            AND r.id = m.referral_id
          RETURNING r.id
        ),
        inserted AS (
          INSERT INTO referrals (
            user_id, source, company, request_log, request_date, updated_date, request_link, referral_received, keyword_matching, comment
          )
          SELECT
            m.user_id,
            'job-sync-import',
            m.company,
            m.request_log,
            m.request_date,
            COALESCE(m.request_date, CURRENT_DATE),
            m.request_link,
            m.referral_received,
            COALESCE(m.keyword_matching, 'Medium'),
            m.comment
          FROM job_with_match m
          WHERE m.referral_id IS NULL
          RETURNING id
        )
        SELECT
          (SELECT COUNT(*)::int FROM updated) AS updated_count,
          (SELECT COUNT(*)::int FROM inserted) AS inserted_count
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return (0, 0)
    return (int(row[0] or 0), int(row[1] or 0))


def run_import(db_url: str, source_file: Path, report_path: Path) -> dict[str, Any]:
    xls = pd.ExcelFile(source_file)
    stats = ImportStats()
    run_id = None
    started = datetime.utcnow().isoformat()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            user_id = resolve_owner_user_id(cur)
            cur.execute(
                "INSERT INTO import_runs (source_file, success, details) VALUES (%s, FALSE, '{}'::jsonb) RETURNING id",
                (str(source_file),),
            )
            run_id = cur.fetchone()[0]

            import_jobs(cur, xls, stats, user_id)
            import_referrals(cur, xls, stats, user_id)
            import_notes(cur, xls, stats, user_id)
            import_pending(cur, xls, stats, user_id)
            synced_updated, synced_inserted = sync_referrals_from_jobs(cur, user_id)
            stats.referrals_synced_updated = synced_updated
            stats.referrals_synced_inserted = synced_inserted

            details = {
                "started_at": started,
                "completed_at": datetime.utcnow().isoformat(),
                **stats.to_dict(),
            }
            cur.execute(
                "UPDATE import_runs SET success = TRUE, finished_at = NOW(), details = %s::jsonb WHERE id = %s",
                (json.dumps(details), run_id),
            )
        conn.commit()

    report = {"import_run_id": run_id, **stats.to_dict(), "source_file": str(source_file)}
    report_path.write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Job Tracker Excel data into Postgres.")
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL"),
        help="Postgres connection URL. Defaults to DATABASE_URL, then NEON_DATABASE_URL.",
    )
    default_xlsx = Path(__file__).resolve().parent.parent / "Job Tracker by Resumary.com.xlsx"
    parser.add_argument(
        "--xlsx-path",
        default=str(default_xlsx),
        help="Path to source XLSX file.",
    )
    parser.add_argument(
        "--report-path",
        default=str(Path(__file__).resolve().parent.parent / "import_report.json"),
        help="Path to write import validation report JSON.",
    )
    args = parser.parse_args()

    if not args.db_url:
        raise SystemExit("Missing database URL. Provide --db-url or set DATABASE_URL/NEON_DATABASE_URL.")

    source_file = Path(args.xlsx_path)
    if not source_file.exists():
        raise SystemExit(f"Source file not found: {source_file}")

    report = run_import(args.db_url, source_file, Path(args.report_path))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
