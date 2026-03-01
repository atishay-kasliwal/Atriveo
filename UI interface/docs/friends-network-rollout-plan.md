# Friends + Network Insights Rollout Plan

Goal: Add friend connections and friend-based insights without disturbing any currently live functionality.

## Guardrails

- Additive changes only (new tables/routes/pages), no breaking edits to existing flows.
- Backend-enforced authorization for all friend-based access.
- Existing API contracts and pages must continue to work unchanged.
- README updates happen only after feature testing is complete.

## Phase Checklist

### Phase 0: Scope Lock

- [ ] Finalize tab naming (`Friends`, `Network`, or other).
- [ ] Confirm v1 visibility behavior:
  - [ ] Option A: show all friend data
  - [ ] Option B: only data marked `friends`
- [ ] Confirm max accepted friends per user = `10`.

### Phase 1: Database Foundation

- [x] Add `friendships` migration (`014_friendships.sql`).
- [x] Apply migration in target environments after review.
- [x] Verify migration on staging/dev DB.

Deliverables:
- `friendships` table with statuses (`pending|accepted|rejected|blocked`)
- no-self-request constraint
- unique user-pair index (direction-agnostic)
- query indexes + updated_at trigger

### Phase 2: Friendship API (No UI Dependency)

- [x] Add endpoints:
  - [x] `GET /api/friends`
  - [x] `GET /api/friends/requests`
  - [x] `POST /api/friends/request`
  - [x] `POST /api/friends/:id/accept`
  - [x] `POST /api/friends/:id/reject`
  - [x] `POST /api/friends/:id/block`
- [x] Backend validations:
  - [x] no self-request
  - [x] no duplicate pair
  - [x] already-friends prevention
  - [x] max-10 enforcement on accept
- [x] Add transaction-safe accept logic to avoid race conditions.
- [ ] Add minimal audit log events for friendship state changes.

### Phase 3: Friends Management UI

- [x] Add new nav tab/page for friend management.
- [x] Add sections:
  - [x] My Friends
  - [x] Incoming Requests
  - [x] Sent Requests
- [x] Add actions:
  - [x] Send request
  - [x] Accept/Reject
  - [x] Block
- [x] Add empty states and error states.

### Phase 4: Network Insights API

- [x] Add endpoint: `GET /api/network/trend?days=10`
- [x] Add endpoint: `GET /api/network/today`
- [x] Restrict to accepted friends only.
- [x] Keep endpoints read-only.
- [x] Optimize for <=10 friends with single aggregate queries.

### Phase 5: Network Insights UI

- [ ] Add new tab/page: `Network` (or final name).
- [ ] Section 1: last 10 days application trend by friend (bar graphs).
- [ ] Section 2: today’s application list grouped by friend.
- [ ] Optional baseline card for current user (“You”).
- [ ] Empty state when user has no accepted friends.

### Phase 6: Hardening

- [ ] Rate limit friend-request endpoints.
- [ ] Add pagination to friend/request list endpoints.
- [ ] Add defensive tests for access checks.
- [ ] Validate blocked-user behavior in both directions.

### Phase 7: Test, Release, Docs

- [ ] Run build and regression smoke tests for existing pages.
- [ ] Validate old endpoints unchanged.
- [ ] End-to-end test friend flow + network views.
- [ ] Deploy API changes.
- [ ] Deploy web changes.
- [ ] Update README (only after successful testing).

## Test Matrix (Minimum)

- [ ] User A sends request to B (pending created).
- [ ] B accepts (becomes accepted).
- [ ] A/B each can view friend insights.
- [ ] Self-request blocked.
- [ ] Duplicate request blocked.
- [ ] Accept blocked when either side already has 10 accepted friends.
- [ ] Blocked users cannot access each other’s friend-based endpoints.
- [ ] Existing dashboard/jobs/referrals/notes/pending flows unaffected.

## Progress Notes

- 2026-02-28: Phase 1 migration file added: `db/migrations/014_friendships.sql` (not applied yet).
- 2026-02-28: Phase 1 migration applied to Neon via `npm run migrate -w @job-tracker/api`.
- 2026-02-28: Phase 2 API endpoints added in `apps/api/src/index.ts` and smoke-tested end-to-end.
- 2026-02-28: Phase 3 Friends UI added (`/friends`) with send/accept/reject/block wiring and build success.
- 2026-02-28: Phase 4 API endpoints added (`/api/network/trend`, `/api/network/today`) + web API client bindings.
