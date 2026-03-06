# Atriveo Job Assistant (Chrome Extension)

`Atriveo Job Assistant` is a Manifest V3 Chrome extension that detects ATS job pages (Workday, Greenhouse, Lever), extracts job data, and prepares a payload that matches your **New Application** flow.

## Backend Contract (Locked)

- Endpoint: `POST /api/extension/applications`
- Payload version: `v1`
- Source: `atriveo-job-assistant`
- The backend route reuses the same job-create service used by `/api/jobs`, so all dashboard graphs/tables stay in sync.

## New Application Payload (Extension)

The extension stores:

```json
{
  "job_title": "",
  "company": "",
  "job_application_id": "",
  "job_link": "https://example.com/job",
  "keyword_match": "Medium",
  "referral": "No",
  "referral_name": "",
  "notes": ""
}
```

Notes behavior:

- Includes extra extracted fields (location, employment/job type, salary, currency, period, ATS platform, and metadata).
- Excludes `job_description`.

Referral behavior:

- If `referral_name` is filled, `referral` is set to `Yes`.
- If `referral_name` is empty, `referral` is set to `No`.

## Extension API Payload (v1)

```json
{
  "payload_version": "v1",
  "source": "atriveo-job-assistant",
  "submitted_at": "2026-03-06T00:00:00.000Z",
  "extracted_job": {
    "job_title": "",
    "company": "",
    "location": "",
    "job_id": "",
    "employment_type": "",
    "job_type": "",
    "salary_min": "",
    "salary_max": "",
    "currency": "",
    "period": "",
    "url": "",
    "ats_platform": ""
  },
  "application": {
    "job_title": "",
    "company": "",
    "job_application_id": "",
    "job_link": "https://example.com/job",
    "keyword_match": "Medium",
    "referral": "No",
    "referral_name": "",
    "notes": ""
  }
}
```

## v1 Mapping to Jobs Table

- `application.job_title` -> `jobs.role`
- `application.company` -> `jobs.company`
- `extracted_job.location` -> `jobs.location_raw`
- `application.job_link` -> `jobs.job_link`
- `application.job_application_id` -> `jobs.job_application_id`
- `application.keyword_match` -> `jobs.keyword_matching`
- `application.referral` (or inferred from `referral_name`) -> `jobs.referral_status`
- `application.referral_name` -> referral sync (`referred_by_name`)
- `application.notes` -> `jobs.notes`
- `source`/version -> `jobs.source = extension-v1`

## Guardrails

- Required fields before submit: `job_title`, `company`, `job_link`.
- `job_link` must be a valid `http/https` URL.
- Duplicate prevention at API for extension submissions:
  - Same `job_link` (per user), or
  - Same `job_application_id + company + role` (per user).
- Duplicate response:
  - HTTP `409`
  - `code: "DUPLICATE_APPLICATION"`
- Popup status messages include:
  - login/session errors
  - duplicate warning
  - validation errors
  - submit success

## Auth + Button Behavior

- Left button is always **Rescan Page**.
- Right button changes by auth state:
  - **Login** when no active extension session.
  - **Add Application** when session is active.
- Clicking **Login** opens `www.atriveo.com` (no email/password fields inside popup).
- Website login can use password or Google sign-in, same as main app.
- After website login, click **Login** again in popup to sync web session into extension.
- Extension validates session with `/api/auth/me`.
- Add Application submits through `/api/extension/applications` (v1) and writes to the same `jobs` flow.

## Load the Extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.

## Test on Job Pages

1. Open a job posting on Workday, Greenhouse, or Lever.
2. Open the extension popup.
3. Verify extracted fields and notes render.
4. If logged out:
   - Click **Login** (opens `www.atriveo.com`).
   - Login on website.
   - Return to popup and click **Login** again to sync session.
5. Set:
   - `Keyword Match`
   - `Referral Name` (optional)
6. Click **Add Application**.
7. Confirm success message appears.

## Debug

1. Content script debug on ATS page:

```js
window.__ATRIVEO_CURRENT_JOB;
```

2. Service worker debug:

```js
chrome.storage.local.get(["latestJob", "preparedPayload", "authSession"], console.log);
```

## QA Matrix (Manual)

Run these checks before release:

- Logged out + ATS page:
  - Right button shows `Login`
  - `Add Application` is not available
- Logged in + ATS page:
  - Right button shows `Add Application`
  - Submitting creates row in `jobs` table and updates dashboard
- Unsupported page:
  - Shows `Unsupported page`
  - Submit action disabled
- Duplicate submit:
  - Same job link (or same job id+company+role) returns duplicate message
- Required field validation:
  - Empty title/company/link blocked in popup
- URL validation:
  - Invalid URL blocked in popup
