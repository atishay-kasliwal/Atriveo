# Atriveo Job Assistant v1.0.7

Release date: 2026-08-25

## Changed

- The extension now opens `tracker.atriveo.com` for login and dashboard access.
- Dashboard tab discovery prioritizes the tracker subdomain.
- Existing sessions on the former apex deployment remain eligible for one-way extension session synchronization during the transition window.
- Dashboard refresh messages are limited to tracker tabs so the new Atriveo brand site is not treated as the application.

## Compatibility

- Existing API endpoints and saved extension application data are unchanged.
- The manifest retains Atriveo apex host permissions temporarily for migration compatibility.
- Users may need to sign in once on `tracker.atriveo.com` because browser storage is origin-scoped.

