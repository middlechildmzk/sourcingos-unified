# SourcingOS V28 Phase 0 manual QA

This checklist validates the stabilization branch. It does not authorize production database changes.

## Environment record

Record before testing:

- deployment URL
- commit SHA
- browser and version
- operating system
- viewport
- authenticated account
- storage mode shown by the app

For every failure capture the route, exact steps, browser console stack, failed network request and response, screenshot, and whether refresh changes the result.

## 1. Application shell

1. Sign in and open `/app`.
2. Confirm the application lands on Today.
3. Click the desktop SourcingOS brand and confirm it opens `/app/today`.
4. On a mobile viewport, click the mobile SourcingOS brand and confirm it opens `/app/today`.
5. Open Candidate Search, Import Center, Evidence Ledger, Network Vault, and Agent OS.
6. Confirm Tools & Data is automatically expanded and the current route is visibly active.
7. Confirm primary navigation remains Today, Roles, AutoSource, Candidates.

## 2. Candidate Database resilience

Test `/app/candidate-database` with:

- zero candidates
- a normal candidate
- a candidate with no skills
- a candidate with missing related evidence
- null nested arrays returned from a controlled preview fixture
- 50 candidates
- next and previous page navigation
- search and clear search
- refresh and browser back

Expected:

- no global application crash
- malformed optional fields normalize to empty arrays or safe text
- Candidate 360 and Add to Role remain available
- route-level error boundary renders Retry and safe navigation for an intentionally thrown route error
- a real client exception produces one redacted `[SourcingOSClientError]` runtime event
- error telemetry contains no email address, phone, URL, UUID, token, or candidate payload

## 3. Calibration freshness

1. Create a role whose intake includes at least one must-have.
2. Add two candidates with matching recorded role signals.
3. Record strong-fit decisions without opening Calibration.
4. Open Today directly.
5. Confirm a calibration approval item is present.
6. Generate the Search Strategy Brief without first opening Calibration.
7. Confirm the report discloses the pending pattern count.
8. Open Calibration and confirm the same pattern appears once, with supporting candidates.
9. Approve the pattern, add another supporting candidate, and confirm approval remains intact while evidence refreshes.
10. Confirm proposed patterns do not affect ranking and approved patterns do.

## 4. Network Vault paging and lifecycle

1. Open `/app/network` with more than 50 imported connections.
2. Confirm the result header shows the current range and total count.
3. Move to the next and previous pages.
4. Search by name, title, and company and confirm search spans the full imported network.
5. Confirm page-local filters clearly say they apply to the loaded page.
6. Confirm rows use meaningful states:
   - Relationship only
   - In Candidate Graph
   - Identity confirmed
   - Kept separate
7. Confirm no row receives an unexplained universal Pending state.
8. Open the detail drawer and confirm the lifecycle explanation, source, imported date, relationship warning, and unverified contact warning.
9. Confirm Escape and the close button dismiss the drawer.

## 5. Role persistence and migration-required behavior

Until the database migrations are applied deliberately:

1. Attempt a durable role save.
2. Confirm a missing snapshot migration returns HTTP 503 with `role_snapshot_migration_required`.
3. Confirm browser-local changes remain visible and the UI does not claim they were persisted to the account.
4. Confirm no client-side direct database write fallback occurs.

After isolated migration rehearsal, separately test:

- role create and refresh
- calibration round trip
- two-device restore
- two-tab stale-version conflict
- owner isolation with two users
- unauthorized role id
- atomic rollback on malformed child rows
- deletion version conflict

## 6. Client error telemetry

1. Trigger one controlled client error on a private route.
2. Confirm one authenticated POST to `/api/client-errors`.
3. Confirm duplicate identical errors are suppressed within the session.
4. Confirm unauthenticated requests fail closed.
5. Confirm oversized or malformed payloads return 400.
6. Inspect runtime logs and confirm only the redacted structured event is present.

## 7. Responsive and accessibility smoke

Test Today, Roles, Candidate Database, Network Vault, and Candidate Review Pro at:

- 390 × 844
- 768 × 1024
- 1280 × 800
- 1440 × 900

Confirm:

- no unintended horizontal scrolling
- visible keyboard focus
- dialogs expose dialog semantics
- drawers close with Escape
- navigation opens and closes by keyboard
- page controls have clear disabled states
- status is never conveyed by color alone

## Exit criteria

Phase 0 is ready for review only when:

- deterministic CI passes
- PostgreSQL contract passes
- production build passes
- preview runtime has no unexplained error or fatal logs
- Candidate Database current status is reproduced as fixed or documented with an exact remaining stack
- calibration appears in Today and HM outputs without opening the Calibration tab first
- Network Vault pagination works beyond 300 records
- dependency findings are documented and assigned
- no production database mutation occurred
