# V29.3A2 — Identity Review Read Surface

## Objective

Expose durable identity proposals to recruiters without introducing a premature profile-attachment or candidate-merge write path.

This slice converts the resolver output from an invisible database contract into an explainable review queue while preserving the project rule:

**No silent profile merges.**

## Stack

V29.3A2 is stacked on:

1. PR #52 — migration-ledger reconciliation
2. PR #53 — replay-safety remediation
3. PR #54 — canonical baseline alignment
4. PR #55 — durable identity foundation

It must not merge before those slices.

## Read-only APIs

### `GET /api/identity/proposals`

Returns a bounded, owner-scoped proposal queue by status.

Supported statuses:

- pending
- approved
- rejected
- auto-attached deterministic
- superseded

The response contains:

- incoming source-profile summary
- proposed canonical candidate summary
- decision class
- review rank
- visible reasons
- conflict counts
- pagination
- owner-scoped status counts

### `GET /api/identity/proposals/:id`

Returns one owner-scoped comparison:

- incoming source profile
- proposed candidate
- deterministic rules
- similarity components
- conflicts and negative evidence
- non-sensitive identifier summaries
- candidate source profiles
- field-level claims
- snapshot count without snapshot payloads

No POST, PATCH, PUT, or DELETE route is introduced.

## Data minimization

The browser does not receive:

- raw source-profile snapshot payloads
- normalized snapshot payloads
- sensitive identifier hashes
- avoidable sensitive identifier display values
- contact-like field claim values
- production service credentials

Snapshot records are counted but not selected.

Sensitive identifier values are replaced by a statement that an observed hash exists.

Contact-like field claims are masked by the API response layer.

## Authentication and tenancy

Both routes:

- require an authenticated session
- apply owner-scoped workbench rate limiting
- constrain every durable query by `owner_id`
- validate query values and UUID parameters
- return 404 for an inaccessible or nonexistent proposal

The service-role client is used only after authorization and with explicit owner filters.

## Schema-unavailable behavior

The identity migrations are not applied merely because this UI exists.

When the durable tables are absent, the API returns:

- HTTP 503
- `available: false`
- `code: identity_schema_unavailable`

The UI displays a safe not-activated state and explicitly confirms that no proposal, candidate, source profile, or database record was changed.

This allows preview and production application code to deploy independently from database authorization without pretending the feature is active.

## Recruiter interface

The authenticated page is:

`/app/identity-review`

It provides:

- status queues
- incoming-versus-canonical comparison
- review rank with reasons
- deterministic anchors
- similarity components
- blocking, material, and informational conflicts
- masked identifiers
- candidate source profiles
- field-level claims
- links to Candidate 360 and public source profiles

The UI labels the numeric value **Review rank**, not confidence or identity probability.

Every numeric component appears beside an explanation that it is one ranking input and not proof.

## Legacy Candidate Database changes

The Candidate Database no longer allows the browser to:

- create an arbitrary comparison from the first two loaded profiles
- call the legacy match-review route
- call the legacy confirm-merge route
- confirm a match
- mark two records separate

Existing legacy review records remain visible as read-only history.

Candidate Database links to the durable Identity Review page.

## Why decisions remain disabled

The current canonical graph gives every source profile a non-null candidate ID. Approving a proposal therefore requires more than changing one foreign key.

A safe approval must atomically:

1. lock the proposal
2. verify owner identity and current proposal state
3. lock the incoming source profile
4. lock the provisional and target candidates
5. recheck blocking conflicts and resolver version
6. preserve source-profile and candidate snapshots
7. reassign the source profile
8. move or preserve related evidence and claims deliberately
9. record the recruiter decision
10. preserve the provisional candidate or mark it as a reversible duplicate
11. create an audit/merge event
12. support rollback

No existing route satisfies that contract. Adding a button before the transaction exists would recreate the exact trust failure V29.2.1 removed.

## Tests

V29.3A2 adds deterministic contracts for:

- GET-only APIs
- authentication and rate limiting
- bounded validation
- schema-unavailable behavior
- owner scoping
- zero proposal mutations
- no raw snapshot reads
- no sensitive identifier hash exposure
- contact-like claim masking
- no sensitive logging
- review-rank language
- visible reasons and conflicts
- no decision controls
- legacy action removal
- Candidate Database handoff
- unchanged migration inventory

## Explicit non-goals

This slice does not:

- apply a migration
- create a proposal
- approve or reject a proposal
- attach a source profile
- merge candidates
- delete a provisional candidate
- rewrite evidence or claims
- backfill legacy records
- change production environment variables
- deploy to production

## Next safe slice

V29.3A3 should design and rehearse a transactional, reversible identity-decision RPC before any decision control is enabled.

The RPC must be tested against duplicate candidates, evidence ownership, claim ownership, concurrent decisions, stale proposals, cross-owner attempts, and rollback.

## Release recommendation

`READY FOR RECRUITER QA` only when:

- TypeScript passes
- deterministic tests pass
- all migration gates remain green
- production build passes
- the schema-unavailable preview state is verified
- the proposal comparison layout is visually reviewed

Production remains unchanged until separately approved.
