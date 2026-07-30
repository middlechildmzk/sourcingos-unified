# V29.3A0.1 Replay-Safety Remediation

Base reconciliation head: `3e190f511b35bf01e136717f03609253f906d382`

Branch: `v29-3a0-1-replay-safety-remediation`

Production migrations applied: none.

Production migration history repaired: no.

Production schema or data modified: no.

## Objective

Make the reconstructed production schema reproducible without rewriting historical SQL, and prevent three unapplied release candidates from being shipped implicitly by a future `supabase db push`.

## Design decision: preserve historical SQL

The five historical files that fail on a raw second application describe work that was already applied to production. This release does not edit them retroactively.

Instead, `sql/replay-safety-guards-v29-3a0.sql` is an explicit reconstruction-only prelude. It drops only the named triggers and policies recreated by the historical sequence. CI then reapplies all eight historical files and requires the resulting schema fingerprint to remain identical.

This separates two truths:

1. Raw historical replay remains unsafe and measurable.
2. The declared reconstruction sequence, guard plus eight files, is replay-safe.

The guard is not under `supabase/migrations/`, is not a production migration, and must never be run against a linked production project.

## Unapplied migration quarantine

Supabase CLI compares timestamped SQL under `supabase/migrations/` with the remote migration ledger and applies local versions that are absent remotely. Leaving unapproved files there made them eligible for an unrelated future push.

V29.3A0.1 moves the three files to `supabase/held-migrations/` without changing their contents:

| File | Decision |
|---|---|
| `20260701173000_jobs_v2_foundation.sql` | Hold for a dedicated Jobs V2 schema and product release. |
| `20260721173000_role_workspace_owner_safety.sql` | Hold for production ownership-consistency and lock-risk preflight. |
| `20260722160000_role_calibration_state.sql` | Hold until role calibration is intentionally promoted. |

The active `supabase/migrations/` directory must contain zero SQL files after this release.

Moving these files does not apply or revert SQL, and does not mutate the remote migration ledger.

## Replay gate

`npm run migration:replay` now runs `scripts/migration-replay-remediated.js` against disposable PostgreSQL 17 databases.

The gate requires:

1. all eight reconstructed production files apply from empty,
2. the five known raw replay failures remain correctly classified,
3. the reconstruction guard applies,
4. the guarded second application passes eight of eight,
5. the before and after schema fingerprints are identical,
6. the active Supabase migration directory contains no SQL files,
7. all three held migrations remain present,
8. all three held migrations still rehearse successfully on reconstructed production,
9. every unexpected outcome exits nonzero.

The earlier V29.3A0 diagnostic harness remains available as:

```bash
npm run migration:reconcile
```

The release gate is:

```bash
npm run migration:replay
```

## Manifest semantics

Historical records now use one of two valid reconstruction states:

- `replay_safe`: safe without a prelude,
- `replay_safe_with_guard`: safe only as part of the declared guarded reconstruction.

`isRawHistoricalReplaySafe()` remains false.

`isLedgerReplaySafe()` now means the declared composite reconstruction is replay-safe. It does not mean the remote Supabase migration ledger has been repaired.

## Remaining baseline blocker

The repository still does not contain an active migration baseline aligned with the six remote ledger versions and the manually applied V19 schema.

Before V29.3A1 production migration work can be applied, a separate baseline phase must:

1. generate and review a canonical schema baseline,
2. prove a zero-change diff against production,
3. align local and remote migration history using an approved control-plane plan,
4. run `supabase db push --dry-run`,
5. receive explicit production approval.

No migration repair, baseline registration, or production push is part of this release.

## Release boundary

This branch changes repository controls only:

- one reconstruction-only SQL guard,
- one remediated replay harness,
- migration manifest and deterministic tests,
- three file moves into a held directory,
- documentation and package scripts.

It does not:

- alter production schema,
- alter production data,
- alter the remote migration ledger,
- backfill candidates,
- rewrite identity records,
- deploy application behavior,
- begin V29.3A1 identity tables.

## Recommendation

`READY FOR TECHNICAL REVIEW` when all CI gates pass.

V29.3A1 remains blocked pending the canonical baseline and migration-history alignment phase.
