# V29.3A4 — Identity Decision Controls

## Purpose

V29.3A4 connects the durable identity-proposal review surface to the rehearsed transactional decision contract without activating that contract in production.

The product rule remains:

> No silent profile merges.

Similarity and review-rank scores never authorize attachment. A signed-in recruiter must inspect the source profile, canonical candidate, deterministic anchors, conflicts, and field provenance, then complete one explicit decision for one proposal.

## Added application surfaces

- `POST /api/identity/proposals/:id/decision`
- `lib/identity/proposal-decision.ts`
- `IdentityDecisionPanel`
- Optimistic-lock preconditions returned with proposal detail

The available recruiter actions are:

1. `approve`
2. `keep_separate`
3. `reject`

There is no bulk decision endpoint, no automatic probabilistic attachment, no candidate-deletion action, and no rollback control in this slice.

## Approval semantics

Approval does not merge two candidate rows and does not delete the provisional candidate.

The rehearsed PostgreSQL transaction reassigns only the incoming source profile and records explicitly tied to that source profile:

- evidence items
- contact signals
- availability signals
- field-level evidence claims

Independent evidence attached only to the provisional candidate stays there. Existing project or pipeline state on the provisional candidate blocks approval.

## Server safety boundary

The mutation route requires all of the following:

- authenticated application session
- owner-scoped workbench rate limit
- same-origin browser request
- UUID proposal ID
- exact action enum
- 10–1000 character audit reason
- current proposal `updated_at`
- current source-profile `updated_at`
- action-specific confirmation token
- durable persistence configuration
- `IDENTITY_DECISIONS_ENABLED=true`
- both held transactional SQL files activated together

The browser never supplies `owner_id` or `actor_id`. The server derives both from the authenticated session.

The route performs no direct table updates. It invokes the service-role-only transactional RPC and returns a bounded, structured result.

## Action-specific confirmation tokens

| Action | Required token |
|---|---|
| Approve | `attach_source_profile` |
| Keep separate | `keep_profiles_separate` |
| Reject | `reject_identity_proposal` |

These tokens are not secrets. They force the client and server to agree on the exact requested action and prevent a generic confirmation from being reused for a different decision.

## Stale-review protection

Proposal detail includes:

- `decisionPreconditions.proposalUpdatedAt`
- `decisionPreconditions.sourceUpdatedAt`

The confirmation request must submit both exact values. The RPC locks the proposal and source profile, compares the timestamps, and fails closed if either changed after the recruiter opened the review.

The UI reloads the proposal after stale, already-decided, or competing-review responses.

## Blocking conflicts

The approval button is disabled when the proposal contains a blocking conflict. The database RPC independently enforces the same rule.

Keep-separate and reject remain valid human decisions after activation.

## Activation remains held

The transactional SQL remains outside the active Supabase migration directory:

1. `supabase/held-migrations/20260730194500_transactional_identity_decisions.sql`
2. `supabase/held-migrations/20260730194600_transactional_identity_decision_serialization.sql`

The second file serializes decisions for the same source profile and must never be activated separately from the first.

The application also defaults to disabled unless the server environment contains:

```text
IDENTITY_DECISIONS_ENABLED=true
```

No environment value is added or changed by this branch.

## Required activation sequence

A later release must complete all of these steps under explicit approval:

1. Reconfirm the production schema and migration ledger.
2. Promote both held SQL files together into an approved migration sequence.
3. Re-run PostgreSQL 17 replay and transactional-decision rehearsals.
4. Apply the migration in a controlled production window.
5. Verify the functions and event table without deciding a proposal.
6. Enable `IDENTITY_DECISIONS_ENABLED=true` in the intended environment.
7. Run authenticated recruiter QA on approve, keep-separate, reject, stale-review, blocking-conflict, and competing-review behavior.
8. Review runtime logs and database audit events.
9. Only then approve wider production use.

## Explicit non-actions in V29.3A4

- No production migration applied
- No migration history repaired
- No production environment variable changed
- No proposal decided
- No profile reassigned
- No candidate merged or deleted
- No backfill
- No production deployment approval
- No rollback UI

## Verification target

The release gate includes:

- TypeScript
- deterministic tests
- full Next.js production build
- historical migration replay
- canonical baseline rehearsal
- durable identity-foundation rehearsal
- held transactional-decision rehearsal
- static contracts for authentication, same-origin enforcement, owner derivation, strict request validation, activation flag, stale timestamps, action confirmations, blocking conflicts, and held-migration status
