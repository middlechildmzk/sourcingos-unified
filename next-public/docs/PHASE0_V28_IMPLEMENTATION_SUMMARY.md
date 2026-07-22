# SourcingOS V28 Phase 0 implementation summary

Branch: `phase0-stabilization-v28`

Base: production V27 commit `f497f730b9d325b73429f5ed99c3e299f9c414c1`

## Implemented

### Application shell

- Desktop and mobile SourcingOS brand links now return to Today.
- Tools & Data automatically expands when the active route is one of its children.
- Primary navigation remains Today, Roles, AutoSource, Candidates.

### Candidate Database resilience

- Added one runtime normalization contract for Candidate Database list responses.
- Null, missing, malformed, or snake-case nested candidate fields normalize to safe values.
- Related records without ids are discarded before client actions use them.
- Candidate imports, normalization previews, identity-review creation, and merge decisions now handle malformed response bodies without a render crash.
- Added regression coverage for null arrays, malformed counts, invalid pages, related records, reviews, and import batches.

### Calibration freshness

- Added workspace-level calibration reconciliation outside the Calibration tab.
- Workspace writes, hydration, local refresh, direct sync, role creation, and role updates now consume reconciled role state.
- Reviewer approval, edit, rejection, pause, scope, and rollback state remains authoritative.
- Added tests proving Today and HM outputs see pending patterns before the Calibration tab is opened.

### Network Vault

- Replaced the fixed 300-row ceiling with bounded server pagination.
- Added owner-scoped, source-scoped, import-type-scoped count and page queries.
- Added previous and next page controls with total and range labels.
- Replaced the universal Pending chip with Relationship only, In Candidate Graph, Identity confirmed, and Kept separate states.
- Clarified which filters search the full network and which refine the loaded page.
- Added regression contracts for paging, owner scoping, lifecycle labels, and page controls.

### Client error observability

- Added a private-app error reporter for window errors and unhandled promise rejections.
- Added duplicate suppression per browser session.
- Redacts email addresses, URLs, UUIDs, phone numbers, and bearer tokens before transport.
- Added a second server-side redaction pass.
- Telemetry is authenticated, rate-limited, schema-bounded, and excludes user ids from logs.
- Added static security and integration tests.

### Dependency and build-risk triage

- Reviewed the locked CI audit artifact.
- Documented runtime Next.js and PostCSS advisories separately from Vitest, Vite, Playwright, and lint-tool advisories.
- Defined a dedicated framework-security upgrade gate rather than using a forced major audit fix in the stabilization branch.
- Added a detailed manual QA checklist for authenticated desktop, mobile, persistence, telemetry, Candidate Database, calibration, and Network Vault verification.

## Not changed

- No production database migrations were applied.
- No production branch or production deployment was changed.
- No identity, evidence, clearance, contact, or recruiter-approval trust rule was weakened.
- No legacy route was removed.
- No autonomous outreach, merge, ranking, or calibration action was added.

## Remaining release gates

- Full GitHub CI pass
- PostgreSQL migration contract pass
- Vercel preview build pass
- Preview runtime log sweep
- Authenticated manual QA
- Current Candidate Database browser verification
- Isolated Supabase migration rehearsal
- Explicit decision on runtime framework advisories before wider beta
