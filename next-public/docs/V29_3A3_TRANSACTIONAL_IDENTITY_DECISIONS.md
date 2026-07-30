# V29.3A3 Transactional Identity Decisions

## Status

**Draft, rehearsed, and quarantined.**

The transaction design is implemented and fully exercised against disposable PostgreSQL 17 databases. Both SQL files remain under `supabase/held-migrations/`, so they are not eligible for an accidental `supabase db push`.

No production migration, proposal decision, source-profile reassignment, candidate merge, backfill, or deletion has occurred.

## Purpose

V29.3A3 proves that a recruiter decision about an identity proposal can be applied and reversed as one owner-scoped database transaction.

It does not expose a browser mutation endpoint or recruiter decision button. The V29.3A2 review surface remains read-only.

## Held SQL pair

The design must be reviewed and activated as one ordered pair:

1. `20260730194500_transactional_identity_decisions.sql`
2. `20260730194600_transactional_identity_decision_serialization.sql`

The first file adds the event ledger and transaction bodies. The second adds same-profile serialization before row locks. The second file must never be activated independently.

## Database contracts

### `identity_decision_events`

Each applied recruiter decision records:

- owner
- proposal
- source profile
- previous candidate
- target candidate
- action
- actor
- before state
- after state
- reason
- creation time
- rollback actor, reason, and time when reverted

Composite foreign keys prevent cross-owner event references. RLS permits an authenticated owner to read their event history, while browser roles receive no insert, update, or delete privilege.

### Decision actions

The transaction supports:

- `approve`
- `keep_separate`
- `reject`

Approval attaches the incoming source profile to the proposed canonical candidate. It moves only rows explicitly tied to that source profile:

- evidence items
- contact signals
- open-to-work signals
- evidence claims

Independent evidence that belongs to the provisional candidate but is not tied to the incoming source profile stays in place.

The provisional candidate is preserved. The RPC never deletes a candidate.

`keep_separate` and `reject` leave the source profile attached to its current candidate and create distinct audit events.

### Rollback

`revert_identity_decision(...)` restores an approved source profile and its source-tied records to the prior candidate. A reverted approval changes the proposal to `superseded`, requiring a fresh resolver proposal before another approval.

Rejected and keep-separate decisions revert to `pending`.

A decision cannot be reverted twice. Rollback also fails closed when the source profile changed after the decision or a later active event superseded it.

## Concurrency model

Two reviewers can inspect the same profile at the same time, but only one same-profile decision can enter the row-locking transaction at once.

The serialization wrapper:

1. Resolves the proposal's owner-scoped source-profile ID.
2. Acquires a transaction-scoped PostgreSQL advisory lock derived from that source-profile ID.
3. Calls the internal owner-scoped transaction body.

Unrelated source profiles remain independently reviewable. Competing decisions for one source profile are serialized, preventing the proposal/profile lock inversion that could otherwise deadlock.

After one approval succeeds, competing pending proposals are superseded. A waiting competing decision then fails closed because its proposal is no longer pending.

## Mandatory preconditions

Every decision requires both:

- the proposal `updated_at` value read by the recruiter
- the source profile `updated_at` value read by the recruiter

The transaction rejects:

- missing preconditions
- a stale proposal
- a stale source profile
- a non-pending proposal
- a source profile already attached to the proposed candidate
- an existing active approval for that source profile
- blocking identity conflicts
- cross-owner actors or lookups
- a provisional candidate with project or pipeline state that would be stranded

These checks occur again inside the database. A future API must not attempt to reproduce or bypass them in application code.

## Service boundary

Both decision RPCs use `SECURITY DEFINER` with an empty `search_path` and are executable only by the Supabase service role.

The browser does not receive direct RPC execution permission.

A future server route must:

- require an authenticated session
- use the session user as both owner and actor
- validate UUIDs, action, timestamps, and bounded reason text
- invoke only the serialized public RPC
- return structured error codes without exposing SQL details
- remain rate-limited and owner-scoped

## PostgreSQL rehearsal

`npm run migration:identity-decisions` uses disposable PostgreSQL 17 databases and proves:

- the transaction migration fails without the identity foundation
- both held SQL files apply in order
- both files replay without schema drift
- applying the files creates no identity rows
- event-table RLS is enabled
- browser roles have no event writes
- authenticated users cannot execute decision RPCs
- service role can execute the public decision and rollback RPCs
- blind decisions are rejected
- stale proposal and source-profile decisions are rejected
- blocking conflicts prevent approval
- project or pipeline state prevents unsafe reassignment
- cross-owner actors and lookups are rejected
- approve, keep-separate, and reject work
- every decision type can be rolled back according to policy
- source-tied records move and restore together
- independent evidence remains untouched
- provisional candidates remain present
- repeated rollback fails closed
- forced concurrent same-profile approvals complete without deadlock
- exactly one concurrent approval succeeds
- cross-owner event foreign keys fail

## Verified checkpoint

At branch head `34f65549e6e1ba71c46707dc93b3b14b8c788bf1` before this documentation-only commit:

- TypeScript: pass
- Vitest: 410/410 tests across 156/156 suites
- Historical replay: 53/53 assertions
- Canonical baseline: 21/21 assertions
- Durable identity foundation: 47/47 assertions
- Transactional identity decisions: 62/62 assertions
- Next.js production build: 117/117 pages

The final documentation head must pass the same gates before review.

## Review checkpoint

The appropriate next review is architectural, not production activation.

Reviewers should confirm:

1. Approval moves the correct source-tied records and nothing broader.
2. Preserving the provisional candidate is the desired initial policy.
3. Existing project/pipeline state should block approval rather than be migrated automatically.
4. Reverted approvals should require a fresh proposal.
5. Same-profile advisory locking is acceptable for the expected decision volume.
6. The API and UI should remain a separate follow-on slice.

## Explicit non-goals

- no production migration
- no migration-history repair
- no backfill
- no proposal generation
- no automatic probabilistic attachment
- no candidate deletion
- no bulk legacy merge
- no browser RPC access
- no decision API
- no approve, reject, or keep-separate button
- no production deployment approval

**No silent profile merges.**
