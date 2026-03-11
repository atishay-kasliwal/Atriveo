# Release Notes — Atriveo Job Assistant v1.0.4

**Release Date:** March 2026  
**Package:** `atriveo-job-assistant-v1.0.4.zip`

---

## Summary

v1.0.4 is a significant feature and polish release. It adds universal career page support, improves the extraction feedback experience, fixes a Workday company name extraction bug, and aligns the extension UI with the Atriveo brand identity.

---

## New Features

### 1. Universal Career Page Support

The extension now activates on any company career page — not just the 11 hardcoded ATS platforms. When a supported ATS is not detected, the extension applies heuristics to determine if the current page is a job listing.

**How it works:**
- `detector.js` runs `isLikelyCareerPage()` after all ATS checks fail
- Detection signals: URL path (`/careers`, `/jobs`, `/openings`, etc.), query parameters (`jobId=`, `gh_jid=`, `req_id=`, etc.), page title keywords, and body text presence of job-related phrases
- If triggered, injects `content-scripts/generic-career.js`

**New file: `content-scripts/generic-career.js`**  
A multi-strategy extractor with confidence scoring:

| Strategy | Signal |
|---|---|
| JSON-LD `JobPosting` schema | `<script type="application/ld+json">` with `@type: "JobPosting"` |
| Meta tags | `og:title`, `og:site_name`, `twitter:title` |
| DOM heuristics | `<h1>` for title, schema.org selectors, aria-label patterns |
| URL extraction | Job ID from `?jobId=`, `?id=`, `/jobs/<slug>` |
| Hostname label | Derived from domain name as fallback company name |

**Confidence scoring:**

| Score | Level | Meaning |
|---|---|---|
| ≥ 4 signals | `high` | Strong extraction, safe to submit |
| ≥ 3 signals | `medium` | Likely correct, brief review recommended |
| < 3 signals | `low` | Partial extraction, manual review required |

**Manifest scope update:**  
`manifest.json` now uses `"https://*/*"` and `"http://*/*"` with `exclude_matches` for Atriveo domains. This allows the content script to load on any page and self-gate via heuristics.

---

### 2. Extraction Confidence UX

The floating widget now surfaces extraction quality signals to guide the user.

**Status bar messages (after extraction):**

| Condition | Status Message |
|---|---|
| Required fields missing | `"Partial extraction. Missing: Job Title, Company"` (error style) |
| `low` confidence | `"Low-confidence extraction. Please review before submitting."` |
| `medium` confidence | `"Review details once before submitting."` |
| `high` confidence + logged in | `"Ready to submit."` |
| `high` confidence + logged out | `"Login required to submit this job."` |

**Field-level highlighting:**  
Fields for Job Title, Company, and Job Link are individually highlighted in red when missing after extraction. The highlight clears as the user fills in the field.

CSS class: `.atriveo-control-missing` — red border (`#fca5a5`) and light red background (`#fff5f5`).

---

## Bug Fixes

### Workday Company Name Extraction
**Problem:** On Workday job pages, the company field was populated with overview/description text instead of the company name.  
**Root cause:** A broad `Company:` regex ran before hostname-based fallbacks and matched description paragraphs.  
**Fix:** Reordered extraction priority in `workday.js`:
1. `og:site_name` meta tag
2. Hostname label (derived from URL)
3. `Company:` text regex (now last resort)

---

## UI Changes

### Brand-Aligned Launcher Button
The floating launcher chip has been redesigned to reflect the Atriveo brand.

- **Before:** Plain grey chip with `AT` text label
- **After:** `64×64px` blue (`#2563EB`) rounded chip with the `A.` SVG brand mark in white

CSS details:
- `background: #2563eb`
- `border-radius: 18px 0 0 18px`
- `box-shadow: -2px 0 12px rgba(37,99,235,0.35)`
- Hover scale: `1.06` with stronger blue glow
- Widget anchored at vertical center: `top: 50%; transform: translateY(-50%)`

### Form Top Spacing Fix
**Problem:** The form panel opened with excessive whitespace at the top (`84px` desktop, `88px` mobile).  
**Fix:** Reduced to `12px` on both breakpoints.

---

## Files Changed

| File | Change Type | Description |
|---|---|---|
| `content-scripts/generic-career.js` | **New** | Universal career page extractor |
| `content-scripts/detector.js` | Modified | Added `isLikelyCareerPage()`, `genericcareer` platform detection |
| `content-scripts/workday.js` | Modified | Fixed company extraction priority order |
| `content-scripts/floating-widget.js` | Modified | Brand logo, career page gating, confidence UX, field highlighting |
| `content-scripts/floating-widget.css` | Modified | Brand blue, launcher redesign, `.atriveo-control-missing`, top spacing |
| `background.js` | Modified | Added `genericcareer` extractor mapping, career URL hint in URL inference |
| `manifest.json` | Modified | Broad `https://*/*` scope with `exclude_matches` |

---

## Documentation Added

New documentation files in `docs/`:

- [`extension-end-to-end-documentation.md`](./extension-end-to-end-documentation.md) — Architecture overview, Mermaid flow diagrams, storage model, message contracts, validation guardrails
- [`extension-api-calls-catalog.md`](./extension-api-calls-catalog.md) — Full HTTP API call catalog and background message handler reference

---

## Known Limitations

- Generic career extraction quality varies significantly by site design. JSON-LD structured data yields the best results.
- Some company career pages use JavaScript-rendered content (SPAs) — extraction may require a short delay after page load. The existing retry loop in `detector.js` handles most cases.
- LinkedIn job pages are partially supported; full extraction depends on login state.

---

## Upgrade Notes

No breaking changes. This is a drop-in replacement for v1.0.3. Users with v1.0.3 installed can load the unpacked extension from `atriveo-job-assistant-v1.0.4/` directly.
