# Atriveo platform and domain plan

Status: planning baseline, 2026-08-25

## Product decision

`atriveo.com` should become the front door to the full Atriveo ecosystem, not the landing page for one product.

The existing job-search product becomes **Atriveo Tracker** and moves to `tracker.atriveo.com`. The apex site should present every intentionally public Atriveo project with the best action available for that project:

- **Open live** when a usable deployment exists.
- **View source** when a public repository exists.
- Both actions when both are available.
- **Private build** or **In development** only when the project owner has explicitly chosen to list a project without a public link.

Private repository metadata must never be discovered or published automatically.

## Current verified state

- The tracker is deployed from this repository to the Cloudflare Pages project `noobly`.
- `atriveo.com` and `www.atriveo.com` remain active on `noobly` during the compatibility window.
- `tracker.atriveo.com` is active as a custom domain on the `atriveo-tracker-router` Worker.
- The router in `infra/tracker-router` transparently serves `noobly.pages.dev`; Cloudflare manages its DNS record and certificate.
- The GitHub organization/user already has a repository named `Atriveo`; it is this tracker repository. That name cannot simultaneously be used by the new brand-site repository.

## Phase 0: move the tracker safely

### 0.1 Make the new hostname live

1. Deploy the tracker router and verify its custom domain and certificate are active.
2. Confirm `tracker.atriveo.com` resolves through public DNS.
3. Verify these routes on the new origin:

   - `/`
   - `/dashboard`
   - `/dashboard/jobs`
   - `/dashboard/referrals`
   - `/dashboard/pending`
   - `/extension-install`
   - `/privacy`
   - `/terms`

4. Test account login, Google login, logout, password reset, a read request, and a write request.
5. Test Chrome extension login synchronization and one application submission.

Do not detach `atriveo.com` or `www.atriveo.com` during this step. The subdomain must run in parallel first.

### 0.2 Change tracker-owned URLs

After `tracker.atriveo.com` is active, change functional and canonical references from the apex/`www` origin to the tracker origin:

- Web metadata: canonical URL, Open Graph URL/image, schema.org URL, `robots.txt`, and `sitemap.xml`.
- API-generated links: password-reset fallback, daily-digest dashboard links, network links, email preferences, and unsubscribe links.
- Production secret: `RESET_PASSWORD_URL_BASE=https://tracker.atriveo.com/?token=`.
- Chrome extension: login URL, fallback dashboard URL, and user-facing login copy.
- Documentation and repository homepage.
- Google OAuth client: add `https://tracker.atriveo.com` as an authorized JavaScript origin before deploying the URL change.
- Analytics: give the tracker and brand site separate web data streams, or explicitly report by hostname if one GA property is retained.

The extension currently grants access to `https://*.atriveo.com/*`, so the new subdomain is already covered. Its tab-selection logic should still be narrowed to prefer `tracker.atriveo.com`; otherwise an open brand-site tab could be mistaken for the application tab.

### 0.3 Account for origin-scoped sessions

Browser `localStorage` does not move between `atriveo.com` and `tracker.atriveo.com`. Existing users will need to sign in once on the new hostname. Their application data is server-side and is not moved or duplicated.

Use this transition:

1. Keep the old tracker available on the apex and `www` during a short parallel window.
2. Add an in-app notice announcing the new tracker address.
3. Publish the extension update that opens `tracker.atriveo.com`.
4. Make the new brand homepage's **Open Tracker** action highly visible so older extension versions still have a clear path.
5. At brand cutover, redirect only legacy product paths such as `/dashboard/*` and `/extension-install` to the equivalent tracker paths. The apex `/` becomes the new brand homepage.

### 0.4 Tracker migration acceptance criteria

- `tracker.atriveo.com` resolves globally and serves a valid certificate.
- Direct navigation and SPA refresh work on every dashboard route.
- Email and password-reset links land on the tracker origin.
- Google OAuth recognizes the tracker origin.
- The current and updated extension can both acquire a valid session and create an application.
- `atriveo.com/dashboard/*` redirects to the same path on `tracker.atriveo.com` after the brand cutover.
- No database or API hostname change is required for this migration.

## Brand-site concept

### Positioning

Atriveo is a product studio and open project ecosystem: practical tools that turn fragmented workflows into clear, usable systems.

Suggested hero copy:

> A growing ecosystem of practical tools.
>
> Atriveo builds focused products for careers, research, creativity, and personal intelligence—available live, open source, or both.

This separates the parent brand from the job-search-specific promise that the current homepage makes.

### Information architecture

```text
atriveo.com
├── /                         Brand story, featured products, recent activity
├── /projects                 Searchable/filterable project catalog
├── /projects/[slug]          Project story, screenshots, stack, links, status
├── /open-source              Public repositories and contribution activity
├── /about                    Builder story and operating principles
├── /privacy                  Shared brand privacy entry point
└── /terms                    Shared brand terms entry point
```

The initial release can ship `/`, `/projects`, `/open-source`, and `/about`; project-detail routes can follow when enough screenshots and case-study copy exist.

### Homepage structure

1. **Compact navigation** — Atriveo wordmark, Projects, Open Source, About, and a primary **Explore projects** action.
2. **Brand hero** — ecosystem-level promise, one short supporting paragraph, and two actions: **Explore projects** and **View GitHub**.
3. **Featured products** — two or three large visual cards, beginning with Atriveo Tracker and Atriveo Applications.
4. **Project constellation** — category groups for Career, Intelligence, Research, Creative, Health, Finance, and Infrastructure.
5. **Shipping activity** — a restrained feed of meaningful releases and open-source work, not a raw commit dump.
6. **Principles** — useful by default, evidence over hype, privacy-aware, and open when possible.
7. **Footer** — project index, GitHub profile, legal links, and the Atriveo subdomain directory.

### Project-card behavior

Every card uses a shared content model:

```ts
type Project = {
  slug: string;
  name: string;
  shortDescription: string;
  category: "career" | "intelligence" | "research" | "creative" | "health" | "finance" | "infrastructure";
  stage: "live" | "beta" | "development" | "archived";
  featured: boolean;
  liveUrl?: string;
  sourceUrl?: string;
  docsUrl?: string;
  image?: string;
  technologies: string[];
  lastMeaningfulUpdate?: string;
};
```

Action rules are deterministic:

| Available assets | Card actions |
| --- | --- |
| Live URL + public repository | **Open live** and **View source** |
| Live URL only | **Open live** |
| Public repository only | **View source** |
| Neither, explicitly curated | Status label and **Read details** only |

### Initial catalog to curate

The GitHub and Cloudflare inventories show these likely candidates. Titles, descriptions, and visibility should be reviewed before publication.

| Project | Current evidence | Proposed category |
| --- | --- | --- |
| Atriveo Tracker | Public source; current site moving to `tracker.atriveo.com` | Career |
| Atriveo Applications / JD Extractor | Public source; `application.atriveo.com` is live | Career |
| Atriveo Cortex | Public source; `cortex.atriveo.com` is live | Intelligence |
| Cortex Bio | Public source; `bio.atriveo.com` is live | Health |
| Atriveo Patent | Public source; no verified live URL yet | Research |
| Atriveo Knowledge | Public source; no verified live URL yet | Intelligence |
| Audiobook Atriveo | Public source; no verified live URL yet | Creative |
| Atriveo Reel | Public source; README describes a self-hosted version; public URL needs confirmation | Creative |

Private candidates are intentionally omitted from the public catalog until each project has an explicit publication decision.

Cloudflare also contains `grant.atriveo.com` and an `atriveo-h1b` Pages project. They should be matched to their source repositories and reviewed before they enter the catalog.

### GitHub and contribution data

Use a curated local project registry as the source of truth. A scheduled GitHub Action can enrich public projects with language, stars, repository activity, and the date of the latest release. This provides fresh metadata without putting a GitHub token in client-side JavaScript.

Contribution activity should show meaningful signals—recent releases, merged pull requests, and active repositories—rather than implying that commit count equals product quality. Private contribution counts should remain excluded unless the owner explicitly opts in, and private repository names or descriptions should never be written into the generated public data file.

## Visual direction

Keep the recognizable Atriveo wordmark and electric blue, but move from a single-product SaaS landing page to an editorial product index.

- **Foundation:** ink/navy text, warm white canvas, electric blue actions, subtle cool-gray panels.
- **Typography:** one strong grotesk/sans family with large, compact headlines and calm body copy.
- **Layout:** a clean 12-column grid, oversized featured cards, smaller catalog cards, generous whitespace.
- **Project identity:** one consistent Atriveo shell; project-specific accent colors appear only in artwork and tags.
- **Motion:** short hover elevation and image reveals; respect reduced-motion preferences.
- **Imagery:** real product captures or generated abstract cover art only when a meaningful screenshot does not exist.

The homepage should feel like a living studio index, not another job-tracker sales page and not a generic developer portfolio.

## Recommended implementation

### Repository naming decision

Recommended low-risk choice:

- Keep the current `atishay-kasliwal/Atriveo` repository name until all old source links and deployments have been updated.
- Create the brand implementation as `atishay-kasliwal/atriveo-site`; the public product and domain still use the name **Atriveo**.
- Rename the current repository to `atriveo-tracker` only when the migration is stable.

If the new repository must be named exactly `Atriveo`, rename the current repository first and immediately reuse the old name. This disables GitHub's redirect from the old tracker repository URL, so documentation, badges, clones, Pages integrations, and external links must be updated in the same cutover.

### Technical shape

- Build a static-first TypeScript site with Astro and small React islands where interaction is useful.
- Deploy it as a separate Cloudflare Pages project, suggested name `atriveo-site`.
- Store curated project content in typed source files; generate only public GitHub enrichment data during CI.
- Keep screenshots in the repository or R2 behind stable asset URLs.
- Add structured data for the organization and each public software project.
- Use a separate analytics stream from Atriveo Tracker.
- Add automated checks for type safety, links, accessibility basics, and a production build.

A React/Vite implementation is also viable if keeping one frontend stack is more important than static-first content rendering. The content model and deployment split remain the same.

## Delivery phases

### Phase 1 — content and product registry

- Confirm which private projects may be named publicly.
- Confirm live URLs and preferred screenshots.
- Write one-sentence descriptions and category assignments.
- Select two or three featured projects.
- Acceptance: every published card has intentional copy, status, and action behavior.

### Phase 2 — design specification

- Produce desktop and mobile wireframes for the homepage and project catalog.
- Finalize type scale, colors, spacing, cards, navigation, footer, and project status system.
- Acceptance: all page sections and responsive states are agreed before implementation.

### Phase 3 — application foundation

- Create the repository and static site.
- Add the design tokens, shared layout, SEO defaults, route skeletons, and typed project registry.
- Configure preview deployments on `atriveo-site.pages.dev`.
- Acceptance: all routes render and the preview is deployable without apex-domain changes.

### Phase 4 — homepage and catalog

- Implement hero, featured products, category browsing, filters, project cards, activity, and footer.
- Add real product imagery and live/source action logic.
- Acceptance: keyboard navigation, mobile layouts, reduced motion, and empty states are verified.

### Phase 5 — public GitHub enrichment

- Add a server-side or CI-only metadata sync.
- Generate a public JSON artifact from an allowlist.
- Add recent releases and merged-contribution activity.
- Acceptance: no token reaches the browser and no private repository metadata appears in build artifacts.

### Phase 6 — production cutover

1. Verify the brand site on its Pages preview domain.
2. Confirm tracker migration acceptance criteria.
3. Attach `atriveo.com` to the brand Pages project.
4. Keep or redirect `www` according to the extension transition window.
5. Add path redirects from legacy tracker routes to `tracker.atriveo.com`.
6. Verify SEO metadata, analytics, legal links, and every project action.
7. Monitor 404s, authentication failures, extension sync, and password-reset traffic for at least one release cycle.

## Decisions required before implementation

1. Should the brand repository use the low-risk name `atriveo-site`, or must it be exactly `Atriveo`?
2. Which private repositories may appear as named projects on the public site?
3. Which two or three projects should be featured on the homepage?
4. Should project detail pages ship in version one, or should cards link directly to live/source destinations?
