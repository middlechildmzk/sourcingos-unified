# V29 Role-Centric Sourcing Loop

## Product objective

Make the role, not the source connector or data graph, the primary recruiter object.

The canonical workflow is:

1. Open a role.
2. Review the approved intake and search lane.
3. Search for people in that role context.
4. Review candidate-first results and supporting evidence.
5. Save a person once.
6. Add the canonical candidate to the role review queue without duplication.
7. Review fit and evidence in the role workspace.
8. Surface the next decision in Today.

V29 must make this complete loop feel like one product. Candidate Graph, source profiles, provenance, and search lanes remain underlying systems rather than competing user destinations.

## Release slice

V29.0 is a focused vertical slice, not a broad connector or ATS expansion.

### A. URL-driven role context

- Launch Candidate Search from a role using `roleId` and optional `laneId` query parameters.
- Treat the URL as the source of truth for navigation.
- Remove the browser-local active-role handoff as the primary mechanism.
- Preserve a clear Back to role action that returns to the exact workspace.
- Show the selected lane and approved role criteria above the composer.

### B. Role-prefilled search

- Populate role title, must-haves, location, clearance breadcrumbs, target companies, exclusions, and hiring-manager notes from the role workspace.
- Prefer an approved lane query when a lane is selected.
- Keep the recruiter free to edit the query before running it.
- Do not silently change the approved role intake.

### C. Save once, add once

- Saving a person must return the existing canonical candidate when already saved.
- Adding that candidate to a role must be idempotent.
- The role queue stores the canonical `candidateId`, public source URL, source, headline, company, and location.
- New role candidates enter `needs_review` with unreviewed fit and evidence states.
- Non-person source subjects remain evidence only and cannot enter the role queue.
- Repeated saves must not create duplicate role candidates or duplicate activity items.

### D. Role-specific candidate review

- Candidate rows in a role link to Candidate 360 when a canonical candidate exists.
- Candidate 360 exposes the originating role and a return-to-role path.
- Role review remains distinct from identity verification.
- Fit decisions, concerns, tags, and pipeline stages remain role-specific.

### E. Today continuation

- A newly added unreviewed candidate creates one actionable role decision in Today.
- Resolving the role review clears or changes that decision deterministically.
- No automated outreach or autonomous stage change is introduced.

### F. First dependable source lane

Use GitHub as the first end-to-end technical sourcing lane because it supports:

- explicit upstream User versus Organization classification
- public profile identity
- public-work evidence
- source URLs and repository-footprint signals
- deterministic person-only gating

The goal is not to claim broad market coverage. The goal is to prove one dependable role-to-candidate loop.

## Acceptance criteria

1. From a role, choose Search this role or Search this lane.
2. Candidate Search opens with the correct role and editable query.
3. Search results render people before diagnostics.
4. Artifacts, organizations, unknowns, and search lanes are visibly separated.
5. Save a person and add them to the role.
6. Repeat the save and receive the same canonical candidate and one role-queue record.
7. Open Candidate 360, then return to the same role.
8. Review the candidate in the role workspace.
9. See the corresponding decision in Today.
10. Complete the flow with keyboard-only navigation on desktop and mobile widths.

## Automated coverage

V29 adds deterministic tests for:

- role and lane query-parameter parsing
- role-prefilled search intake
- selected-lane query precedence
- person-only role addition
- idempotent role-candidate insertion
- canonical candidate ID preservation
- exact role return links
- Today decision creation and resolution
- no duplicate activity entries
- no browser-local DOM mutation or synthetic candidate fallback

## Non-goals

V29.0 does not include:

- production database migrations
- provenance backfill
- autonomous outreach
- scheduling
- a full ATS replacement
- dozens of new connectors
- automated identity merging
- inferred protected-class attributes
- verified clearance claims from public data
- opaque candidate ranking

## Data and release guardrails

- Do not mutate production data during development.
- Do not apply calibration, owner-safety, or provenance migrations in this slice.
- Reuse the current fail-closed role sync and candidate-save boundaries.
- Preserve the 27,294 authorized LinkedIn imports as people at read time.
- Rehearse any future production reconciliation on disposable Supabase infrastructure.
- Require passing TypeScript, deterministic tests, migration contract, production build, Vercel preview, and authenticated QA before merge.

## Sequencing

### V29.0

Role-scoped search, idempotent role addition, role return paths, and Today continuation.

### V29.1

Candidate 360 role context, comparison improvements, shortlist ergonomics, and saved role searches.

### V29.2

One production-grade GitHub connector slice with observable source health and recruiter feedback.

### V29.3

ATS or CSV rediscovery pilot, selected only after the role loop is validated by trusted sourcers.
