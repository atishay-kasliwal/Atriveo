# Atriveo Extension API Calls Catalog

## 1. External HTTP Calls (background.js)

### 1.1 Validate session
- Method: `GET`
- Path: `/api/auth/me`
- Called from: `validateSession()`
- Auth: Bearer token
- Purpose: verify extension/web-synced session and refresh user info.

### 1.2 Duplicate check and listing
- Method: `GET`
- Path: `/api/jobs?page={n}&limit={n}&company={optional}`
- Called from: `findExistingApplication()`
- Auth: Bearer token
- Purpose: prevent duplicate submissions by link or `(job id + company + role)`.

### 1.3 Primary extension submit
- Method: `POST`
- Path: `/api/extension/applications`
- Called from: `submitApplication()`
- Auth: Bearer token
- Purpose: send v1 extension contract payload.

### 1.4 Legacy fallback submit
- Method: `POST`
- Path: `/api/jobs`
- Called from: `submitApplication()` if extension endpoint returns 404
- Auth: Bearer token
- Purpose: backward compatibility.

## 2. API Base URL Resolution
- Default base: `https://job-tracker-api.katishay.workers.dev`
- Source key: `apiBaseUrl` in local storage.
- Logic:
  - try configured base first
  - retry known default for specific fallback cases (e.g., stale custom base 404)

## 3. Background Message API (Runtime)

### 3.1 Data capture and read
- `JOB_EXTRACTED`
  - Input: extractor payload
  - Output: persisted record
- `GET_JOB_FOR_URL`
  - Input: page URL
  - Output: matching stored record
- `GET_LATEST_JOB`
  - Output: latest record
- `GET_PREPARED_PAYLOAD`
  - Output: backend-ready payload

### 3.2 Extraction orchestration
- `RUN_EXTRACTION_FOR_TAB`
  - Input: implicit sender tab
  - Steps:
    - infer platform from URL/heuristics
    - ensure extractor injected
    - send `RUN_EXTRACTION` to tab
    - persist extracted result
  - Output: record or null

- `ENSURE_PLATFORM_EXTRACTOR`
  - Input: optional `platform`
  - Output: injection status (`ensured`, `platform`, `scriptFile`)

### 3.3 Auth and session
- `AUTH_STATUS`
  - Input: `sync_web` optional
  - Output: `authenticated`, `user`

- `OPEN_LOGIN_PAGE`
  - Output: opened/focused tab id

- `SYNC_WEB_SESSION`
  - Output: auth status after reading session from Atriveo web tab storage

- `LOGOUT`
  - Output: ok/error

### 3.4 Draft and submission
- `UPDATE_APPLICATION_DRAFT`
  - Input: `url`, editable `application`
  - Output: updated record + prepared payload

- `SUBMIT_APPLICATION`
  - Input: `url`, `keyword_match`, `referral_name`, `application`
  - Output:
    - success: created payload + updated record
    - duplicate: duplicate flag + existing info
    - auth error: unauthorized

## 4. Content-Script -> Background Emitters
Extractors emit `JOB_EXTRACTED`:
- `workday.js`
- `greenhouse.js`
- `lever.js`
- `applytojob.js`
- `ashby.js`
- `generic-ats.js`
- `generic-career.js`
- `linkedin.js`
- `amazon-jobs.js`
- `ultipro.js`
- `njoyn.js`

Detector emits:
- `ENSURE_PLATFORM_EXTRACTOR`

Floating widget emits:
- `AUTH_STATUS`
- `UPDATE_APPLICATION_DRAFT`
- `RUN_EXTRACTION_FOR_TAB`
- `GET_JOB_FOR_URL`
- `OPEN_LOGIN_PAGE`
- `SYNC_WEB_SESSION`
- `SUBMIT_APPLICATION`

## 5. Error and Duplicate Semantics
- Unauthorized: status 401 -> `unauthorized: true`
- Duplicate:
  - status 409, or
  - code `DUPLICATE_APPLICATION`
- Validation failures handled in widget before submit for required fields and URL format.
