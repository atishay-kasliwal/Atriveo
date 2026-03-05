# Atriveo Analytics

This app uses Google Analytics 4 with Measurement ID `G-D1XC74NKPG`.

## Architecture

- GA bootstrap script is loaded globally in [`apps/web/index.html`](/Users/atishaykasliwal/Desktop/Atriveo/Noobly/UI interface/apps/web/index.html).
- Core analytics runtime lives in:
  - [`apps/web/src/analytics/analytics.ts`](/Users/atishaykasliwal/Desktop/Atriveo/Noobly/UI interface/apps/web/src/analytics/analytics.ts)
  - [`apps/web/src/analytics/events.ts`](/Users/atishaykasliwal/Desktop/Atriveo/Noobly/UI interface/apps/web/src/analytics/events.ts)
- Router page views are tracked from [`apps/web/src/App.tsx`](/Users/atishaykasliwal/Desktop/Atriveo/Noobly/UI interface/apps/web/src/App.tsx) via `trackPageView(...)`.
- `analytics.ts` uses a provider interface so GA4 can later be complemented or replaced by PostHog, Mixpanel, or Amplitude without changing app-level calls.

## Event API

Use wrappers from `events.ts` instead of calling `gtag` directly:

```ts
import { ANALYTICS_EVENTS, trackFeatureEvent, trackProductEvent } from "../analytics/events";

trackProductEvent(ANALYTICS_EVENTS.add_application_clicked, {
  source: "dashboard_header",
});

trackFeatureEvent(ANALYTICS_EVENTS.sort_changed, {
  source: "jobs_table",
  sort_field: "applied_at",
  sort_order: "desc",
});

trackProductEvent(ANALYTICS_EVENTS.feedback_submitted, {
  source: "feedback_modal",
  sentiment: "positive",
});
```

## Event Families

- Product: `signup_started`, `signup_completed`, `login_completed`, `dashboard_opened`, `add_application_clicked`, `application_created`, `application_deleted`, `application_updated`, `share_data_enabled`, `share_data_disabled`, `privacy_settings_opened`, `chrome_extension_install_clicked`, `feedback_submitted`
- Features: `filter_used`, `search_used`, `sort_changed`, `export_data_clicked`
- Lifecycle milestones: `first_application_created`, `first_share_enabled`, `first_dashboard_visit`
- Errors: `form_submission_error`, `api_request_failed`, `validation_error`
- Performance: `slow_dashboard_load`, `slow_application_create`
- Funnel steps: `landing_page_view`, `signup_started`, `signup_completed`, `dashboard_opened`, `add_application_clicked`, `application_created`, `share_data_enabled`

## Event Trigger Notes

- `signup_started`: fired when signup modal/page opens.
- `signup_completed`: fired after successful signup API response.
- `login_completed`: fired after successful login API response.
- `dashboard_opened`: fired when Dashboard page mounts.
- `add_application_clicked`: fired when user opens the New Application modal.
- `application_created`: fired after successful application create (manual or prefill).
- `application_updated`: fired after successful edit/archive status update.
- `application_deleted`: fired after successful delete.
- `privacy_settings_opened`: fired when "Manage Shared Fields" opens.
- `share_data_enabled` / `share_data_disabled`: fired after saving privacy settings if optional shared field count changes.
- `search_used`, `filter_used`, `sort_changed`: fired from jobs table controls.
- `export_data_clicked`: fired after successful CSV export download.
- `form_submission_error`, `validation_error`, `api_request_failed`: fired on UI validation, failed form submits, and API/network failures.
- `slow_dashboard_load`, `slow_application_create`: fired when measured duration crosses thresholds.

## Conversion Events (mark in GA4 UI)

Mark these event names as conversions in GA4:

- `signup_completed`
- `application_created`
- `chrome_extension_install_clicked`

These are exported as `CONVERSION_EVENTS` in `events.ts` for reference.

## Context Metadata

`trackEvent` automatically attaches:

- `user_type` (`guest` or `logged_in`)
- `plan_type` (currently `free`)
- `device_type` (`mobile`, `tablet`, `desktop`)
- `referrer_source`
- `page_section`

`setSessionContext(...)` in `App.tsx` updates user/session context centrally.

## Privacy and PII Rules

- Do not send emails, names, job notes, company names, role titles, or raw job links.
- The analytics runtime blocks common PII keys automatically.
- Send behavioral metadata only (counts, booleans, enum values, durations).

## Debug Mode

- Debug mode is enabled automatically in development (`import.meta.env.DEV`).
- You can force debug mode in browser local storage with:
  - key: `atriveo_analytics_debug`
  - value: `1`
- Events can be validated in GA4 DebugView.

## Enhanced Measurement Checklist (GA4 Admin)

Confirm these are enabled in the GA4 web data stream:

- Page views
- Scrolls
- Outbound clicks
- Site search
- File downloads
- Video engagement

These toggles are managed in GA4 Admin, not in frontend code.
