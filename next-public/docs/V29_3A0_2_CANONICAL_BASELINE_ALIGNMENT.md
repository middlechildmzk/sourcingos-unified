# V29.3A0.2 — Canonical Baseline Alignment

## Objective

Create one safe migration-history anchor after the V29.3A0 reconciliation and replay-safety remediation.

The anchor must align future Supabase migration history without recreating, rewriting, or backfilling the existing production schema.

## Stack

This slice is stacked on:

1. V29.3A0 migration-ledger reconciliation
2. V29.3A0.1 replay-safety remediation

It must not merge before those slices.

## Active migration

`supabase/migrations/20260730172500_canonical_baseline_anchor.sql`

Ledger name:

`v29_3a0_canonical_baseline_anchor`

## Why this is not a squashed schema migration

Production was created through a mixture of manual SQL-editor work and ad hoc ledger entries. A traditional squashed baseline containing `CREATE TABLE`, policy, trigger, and index statements would be dangerous until production history is repaired because an accidental `db push` could try to recreate live objects.

The V29.3A0.2 anchor is intentionally different:

- It performs no DDL.
- It performs no DML.
- It does not create a migration-ledger row itself.
- It checks that the database already matches the reconciled canonical contract.
- It fails on an empty or materially different database.
- It can run repeatedly without changing schema or data.

## Contract asserted by the anchor

The migration requires:

- UUID `candidates.id`
- UUID `candidates.owner_id`
- UUID `source_profiles.candidate_id`
- Existing `candidates`
- Existing `source_profiles`
- Existing `evidence_items`
- Existing `candidate_contacts`
- Existing `identity_match_reviews`
- Existing `talent_graph_edges`
- Absent `evidence_claims` before V29.3A1
- Exact-source uniqueness on `(owner_id, source, source_profile_id)`
- RLS enabled on the five canonical candidate graph tables
- The unverified-only `candidate_contacts.verified` database guard

It does not assert production row counts because row counts are mutable application data, not schema identity.

## Repository state

After this slice:

- The active migration directory contains exactly one SQL file: the canonical baseline anchor.
- Jobs V2 remains held.
- Role workspace owner safety remains held.
- Role calibration state remains held.
- Historical production SQL remains immutable.
- The reconstruction-only replay guard remains outside the active migration directory.

## PostgreSQL gates

### Migration replay gate

`npm run migration:replay`

Proves:

- clean reconstruction 8/8
- raw historical hazards remain documented
- guarded replay 8/8
- identical full-schema fingerprint
- held migration rehearsal 3/3
- only the baseline anchor is active

### Baseline alignment gate

`npm run migration:baseline`

Proves:

- the anchor fails on an empty database
- the rejection contains a canonical baseline mismatch
- the anchor passes against reconstructed production
- the first application changes no schema fingerprint
- the first application changes no canonical row-count fingerprint
- the second application passes
- the second application also changes nothing

Both gates use disposable PostgreSQL 17 databases and never connect to production.

## Future production procedure

This procedure is documentation only. It is not authorized by this PR.

Before any production action:

1. Recheck production schema read-only.
2. Recheck the exact migration ledger.
3. Confirm the three held migrations remain outside `supabase/migrations`.
4. Confirm the active directory contains only the baseline anchor.
5. Run PostgreSQL replay and baseline gates from the exact approved commit.
6. Run a Supabase migration dry run against the linked project.
7. Review the exact planned ledger action.
8. Obtain explicit production migration approval.

The preferred production action is either:

- execute the zero-change anchor through the normal migration runner so Supabase records it as applied, or
- use an explicitly reviewed `supabase migration repair --status applied` action for the exact baseline version.

The final choice must be made after the live dry run. Neither action is included here.

## Rollback model

The anchor changes no schema and no application rows. Before ledger registration there is nothing to roll back.

After ledger registration, rollback means correcting only the migration-history record through an explicitly approved migration-repair action. No table, policy, trigger, index, or candidate record should be reverted because the anchor did not change them.

## Explicit non-goals

This slice does not:

- contact production
- run `supabase db push`
- run `supabase migration repair`
- apply the baseline anchor remotely
- activate held migrations
- add identity-resolution tables
- create `evidence_claims`
- backfill candidates
- merge candidates
- modify environment variables
- deploy an application release

## Release recommendation

`READY FOR TECHNICAL REVIEW` when both CI jobs pass.

Production migration-history alignment remains a separate explicit approval event.
