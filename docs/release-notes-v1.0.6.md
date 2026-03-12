# Release Notes — Atriveo Job Assistant v1.0.6

**Release Date:** March 2026  
**Package:** `atriveo-job-assistant-v1.0.6.zip`

---

## Summary

v1.0.6 expands platform coverage significantly and upgrades the in-page experience. This release adds JobRight support, broad company career-page support, Simplify.jobs coverage, and multiple reliability fixes to ensure users can always open Atriveo and add applications manually when needed.

---

## What's New

### 1. New Platform Support: JobRight

Added a dedicated extractor for `jobright.ai` pages.

- New file: `content-scripts/jobright.js`
- Extracts: job title, company, location, salary hints, employment type, experience level, job ID, and description

### 2. Expanded Career Site Coverage

Added support for 35 major company career domains, including:

- Apple, Meta, Microsoft, Tesla, Nvidia
- OpenAI, Anthropic, Stripe, Airbnb, Uber
- Cisco, Intel, IBM, Oracle, Salesforce
- Lyft, Snap, Databricks, Coinbase, Robinhood, Rivian
- Boeing, Lockheed Martin, RTX, Goldman Sachs, Morgan Stanley, JPMorgan
- Pinterest, Dropbox, Block/Square, Netflix, Google Careers

### 3. Simplify.jobs Support

Added support for `simplify.jobs` and mapped it to the generic career extractor flow.

### 4. Floater-First Experience

The extension icon now controls the in-page floating widget directly.

- Supported pages: opens/toggles Atriveo floater panel
- Unsupported pages: attempts dynamic floater injection for manual entry
- Restricted browser pages (`chrome://`, Web Store, extension pages): safely falls back to Atriveo website

### 5. Improved Auto-Open Behavior

For supported pages, Atriveo can auto-open on page load to reduce clicks.

- Added a background-triggered auto-open message (`AUTO_OPEN_PANEL`) for better reliability
- LinkedIn safeguard: auto-open is limited to LinkedIn job pages only

---

## Bug Fixes

### Popup not opening anywhere

- Restored proper action wiring and moved to icon-click floater behavior (instead of stale popup dependency)

### New supported domains showed as unsupported

- Updated popup/platform domain mapping logic for all newly added domains and extractors

### Launcher default position

- Fixed launcher default location to top-right (`top: 72px`) instead of centered vertically

### Unsupported page experience

- Preserved manual-entry fallback so users can still add applications even when extraction is not available

---

## Files Updated (Key)

- `extension/content-scripts/jobright.js` (new)
- `extension/content-scripts/detector.js`
- `extension/content-scripts/floating-widget.js`
- `extension/content-scripts/floating-widget.css`
- `extension/background.js`
- `extension/manifest.json`
- `extension/popup/popup.js` (domain/platform sync fixes)

Release mirror:

- `release/atriveo-job-assistant-v1.0.6/*`
- `release/atriveo-job-assistant-v1.0.6.zip`

---

## Chrome Web Store Notes

- Uses specific host permissions for supported domains (no broad wildcard host permissions)
- Includes `activeTab` fallback for user-invoked actions on active pages

---

## Upgrade Notes

No breaking changes for users. v1.0.6 is a drop-in replacement and includes broader site coverage plus improved reliability for opening and submitting from the floater.
