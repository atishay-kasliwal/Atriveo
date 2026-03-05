# CSV Import/Export Test Cases

Scope: jobs CSV import/export, pagination visibility, trend population, date/time preservation, and referral sync consistency.

## How to run automated audit

Prerequisites:
- API running (`API_URL`) and reachable
- Valid user credentials (`DASHBOARD_EMAIL`, `DASHBOARD_PASSWORD`)

Command:

```bash
API_URL=https://job-tracker-api.katishay.workers.dev \
DASHBOARD_EMAIL="you@example.com" \
DASHBOARD_PASSWORD="your-password" \
npm run audit:csv
```

Script path:
- `/Users/atishaykasliwal/Desktop/Atriveo/Noobly/UI interface/apps/api/scripts/audit-csv-import-export.mjs`

The script uses a unique prefix per run, validates behavior, and cleans up only its own records.

## Functional test matrix

### A) Header/schema compatibility

| ID | Scenario | Expected |
|---|---|---|
| H1 | New template headers (`date_saved`, `applied_at`, `role`, `company`, ...) | Accepted |
| H2 | Old template aliases (`Date`, `Position`, `Company Name`, `Referral`, ...) | Accepted and correctly mapped |
| H3 | Mixed case and spacing in headers (`Applied At`, `Company Name`) | Accepted via normalization |
| H4 | Missing `role` | Request rejected (`400`) |
| H5 | Missing `company` | Request rejected (`400`) |
| H6 | Missing both `date_saved` and `applied_at` | Request rejected (`400`) |
| H7 | Unknown extra headers present | Ignored without breaking import |

### B) Row validation/defaulting

| ID | Scenario | Expected |
|---|---|---|
| R1 | Blank row | Skipped (`skippedEmptyRows`) |
| R2 | Missing required fields in row | Skipped (`skippedMissingRequired`) |
| R3 | Invalid `date_saved`, valid `applied_at` | Imported, `date_saved` derived from `applied_at` |
| R4 | Invalid `date_saved` and invalid `applied_at` | Skipped (`skippedInvalidDate`) |
| R5 | Invalid `job_link` | Imported, link cleared with warning |
| R6 | Invalid `oa_deadline_date` | Imported, deadline cleared with warning |
| R7 | Invalid enums (`keyword_matching`, `oa_status`, etc.) | Imported with normalized defaults + warning |
| R8 | `applied_at` date-only value (`YYYY-MM-DD`) | Imported (normalized to `12:07 AM` UTC fallback time) |
| R9 | `job_application_id` blank | Default `-` applied |

### C) Performance/scale

| ID | Scenario | Expected |
|---|---|---|
| P1 | 150-row import | All rows imported |
| P2 | Pagination after large import | API returns `total`, UI shows multi-page correctly |
| P3 | CSV near 10 MB | Accepted if `<= 10MB` |
| P4 | CSV above 10 MB | Rejected with `413` |

### D) Export and round-trip

| ID | Scenario | Expected |
|---|---|---|
| E1 | Export includes `applied_at` column | True |
| E2 | Export contains imported rows | True |
| E3 | Export range filter (`30/60/90/all`) | Correct rows returned |
| E4 | Re-import exported file | All rows accepted (round-trip) |

### E) Referral sync correctness

| ID | Scenario | Expected |
|---|---|---|
| F1 | Imported row with `referral_status=Yes` | Referral record exists |
| F2 | Imported row with `referral_status=Requested` | Referral record exists |
| F3 | Imported row with `referral_status=No` | No new referral record |
| F4 | Re-import same company/role/link | Existing referral row updated (no duplicate explosion) |

### F) Trend/time behavior

| ID | Scenario | Expected |
|---|---|---|
| T1 | Imported row within visible trend window | Count appears in trend |
| T2 | Imported row outside trend window | Not shown in current chart (expected) |
| T3 | Explicit timezone in `applied_at` | UI shows local converted time consistently |
| T4 | `date_saved` only import | Date always present; time falls back to normalized value |

## Automated scenarios currently implemented

| ID | Scenario | Covered by `npm run audit:csv` |
|---|---|---|
| A1 | Old template aliases accepted | Yes |
| A2 | `applied_at`-only import | Yes |
| A3 | Invalid date skip + recoverable import | Yes |
| A4 | 150-row bulk import + pagination total | Yes |
| A5 | Export includes `applied_at` + exported row presence | Yes |
| A6 | Trend increases after import | Yes |
| A7 | Referral sync count correctness (`Yes/Requested`) | Yes |
| A8 | Date-only default time uses `12:07 AM` fallback | Yes |
| A9 | Formula-like cell values are export-sanitized | Yes |

## Manual UI regression checklist

| ID | Page | Check | Expected |
|---|---|---|---|
| M1 | Jobs | Import toast summary | `Imported X of Y` and skips/defaults visible |
| M2 | Jobs | Table + paginator after 150 import | 25/page, correct page count, correct total |
| M3 | Jobs | Applied time display | Matches intended local time from `applied_at` |
| M4 | Jobs | Export then open CSV | Header includes `applied_at` |
| M5 | Referrals | Imported Yes/Requested rows | Present in Referral Records |
| M6 | Graphs | Momentum chart after import | Counts reflect imported days |

## Current known limitations

1. **Still day-based trends:** trend charts aggregate by day using `COALESCE(date_saved, applied_at)`, not by intra-day time slices.
2. **Upload is memory-based:** CSV import still posts whole text payload (not streaming/chunked upload from client).
3. **Size cap remains:** max upload is now `10MB`; very large datasets may still require splitting.
