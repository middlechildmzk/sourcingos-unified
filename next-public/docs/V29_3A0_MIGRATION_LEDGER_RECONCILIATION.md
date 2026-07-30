# V29.3A0 Migration Ledger Reconciliation

Base SHA: `d451a22693eda01dc0df7262345f04445c2318af`

Branch: `v29-3a0-migration-ledger-reconciliation`

Migrations written: none.

Migrations applied to production: none.

## Verdict

The migration ledger can be reconciled, but the historical migration sequence is not replay-safe.

Every migration recorded in production maps to an ad hoc file under `next-public/sql/`. None of the files under `next-public/supabase/migrations/` appear in the production migration ledger. Five of the eight files required to reconstruct production fail when applied a second time, and three unapplied versioned migrations would be included in the next unqualified `supabase db push`.

V29.3A1 identity tables must not be introduced until replay safety and the pending-migration decisions are resolved.

## Independent production confirmation

The following facts were rechecked against production read-only on July 30, 2026 before publication:

- six migration-ledger entries exist,
- `candidates` contains 27,310 rows,
- `source_profiles` contains 27,306 rows,
- `identity_match_reviews` contains zero rows,
- `evidence_claims` is absent,
- `talent_graph_edges` is present,
- canonical candidate tables use UUID primary keys and owner-scoped rows,
- existing candidate foreign keys remain ID-only rather than composite ownership-safe keys.

Production was not modified.

## Applied migration inventory

| Production ledger entry | Repository file | Replay safe |
|---|---|---:|
| `v20_role_workspace_durable` | `sql/role-workspace-v20-1.sql` | yes |
| `v20_3_security_performance_hardening` | `sql/security-hardening-v20-3.sql` | yes |
| `role_workspace_v20_3_compatibility_index` | `sql/role-workspace-v20-3-indexes.sql` | yes |
| `candidate_acquisition_v21` | `sql/candidate-acquisition-v21.sql` | no |
| `autosource_v22` | `sql/autosource-v22.sql` | no |
| `agent_os_v23_v25` | `sql/agent-os-v23-v25.sql` | no |

The production candidate graph itself is not represented by a ledger entry. `sql/MIGRATION-CHECKLIST.md` directs an operator to paste these files into the Supabase SQL editor:

1. `sql/complete-schema-v19.sql`
2. `sql/rls-policies-v19.sql`

Manual SQL-editor execution does not create a normal migration-ledger entry. The actual production construction sequence therefore contains eight files, not six.

## Reconstructed production sequence

| Order | File | Application method |
|---:|---|---|
| 1 | `sql/complete-schema-v19.sql` | manual SQL editor |
| 2 | `sql/rls-policies-v19.sql` | manual SQL editor |
| 3 | `sql/role-workspace-v20-1.sql` | ledger |
| 4 | `sql/security-hardening-v20-3.sql` | ledger |
| 5 | `sql/role-workspace-v20-3-indexes.sql` | ledger |
| 6 | `sql/candidate-acquisition-v21.sql` | ledger |
| 7 | `sql/autosource-v22.sql` | ledger |
| 8 | `sql/agent-os-v23-v25.sql` | ledger |

This sequence is declared in `lib/migration-manifest.ts` and asserted by deterministic tests.

## Pending versioned migrations

The repository contains three versioned migrations that are absent from the production ledger:

| File | Current classification |
|---|---|
| `supabase/migrations/20260701173000_jobs_v2_foundation.sql` | unapplied, currently applies on reconstructed production |
| `supabase/migrations/20260721173000_role_workspace_owner_safety.sql` | unapplied, currently applies on reconstructed production |
| `supabase/migrations/20260722160000_role_calibration_state.sql` | unapplied, currently applies on reconstructed production |

This is operationally important because a future `supabase db push` could apply all three together with a new identity migration unless each receives an explicit decision first.

The owner-safety migration is also independent corroboration of the production state: it hardens relationships that production still exposes as ID-only foreign keys.

## Replay harness

`scripts/migration-replay.js` runs against disposable databases on a PostgreSQL 17 server. CI supplies the existing `postgres:17` service.

The harness:

1. creates uniquely named databases,
2. installs a minimal Supabase-compatible auth schema and roles,
3. applies the reconstructed production sequence from empty,
4. captures canonical-table contracts,
5. applies the sequence a second time,
6. verifies the exact expected replay failures,
7. applies all pending versioned migrations on a fresh reconstructed database,
8. classifies every orphan SQL file,
9. computes both table-shape and full-schema fingerprints so table-definition no-ops are distinguished from secondary-object drift,
10. writes a JSON report,
11. drops every database on exit.

Unexpected results exit nonzero. The replay is therefore a real CI contract rather than an informational log.

The harness uses only Node built-ins and the PostgreSQL client commands already installed by CI. It has no undeclared `embedded-postgres` dependency.

## Replay results represented by this reconciliation

### Clean reconstruction

All eight production-sequence files apply successfully from empty.

### Second application

Five files fail on replay:

| File | First replay hazard |
|---|---|
| `sql/complete-schema-v19.sql` | existing trigger |
| `sql/rls-policies-v19.sql` | existing policy |
| `sql/candidate-acquisition-v21.sql` | existing policy |
| `sql/autosource-v22.sql` | existing policy |
| `sql/agent-os-v23-v25.sql` | existing policy |

Three files are replay-safe:

- `sql/role-workspace-v20-1.sql`
- `sql/security-hardening-v20-3.sql`
- `sql/role-workspace-v20-3-indexes.sql`

The mechanical cause is unguarded `CREATE POLICY` and `CREATE TRIGGER` statements. PostgreSQL has no `CREATE POLICY IF NOT EXISTS` or `CREATE TRIGGER IF NOT EXISTS` syntax. The safe role-workspace migration already demonstrates the correct pattern by dropping a policy conditionally before recreating it.

`sql/autosource-v22.sql` is also wrapped in an explicit transaction. A failure inside that transaction can leave the session aborted until rollback and obscure the true source of later failures.

### Pending migration rehearsal

All three pending versioned migrations currently apply on a fresh reconstruction. This means they are not necessarily broken, but they remain unreviewed production drift.

## Orphan SQL classification

| File | Classification | Reason |
|---|---|---|
| `sql/candidate-graph-schema.sql` | incompatible | superseded text-ID shape; conflicts with canonical UUID schema |
| `sql/candidate-graph-schema-v17-3.sql` | incompatible | superseded text-ID shape; conflicts with canonical UUID schema |
| `sql/candidate-graph-v18.sql` | table-shape no-op with secondary drift | existing table definitions are silently preserved, but missing secondary indexes are still added |
| `sql/candidate-intelligence-spine-v19.sql` | additive, unapplied | defines `evidence_claims`, which is absent from production |
| `sql/sourcingos-jobs-v17-6.sql` | additive but superseded | older jobs scaffold replaced by jobs v2 direction |

The first integrated replay gate corrected the original classification. Counting columns alone made V18 look like a total no-op. Full-schema fingerprinting showed that its guarded table definitions do not change table shapes, while its `CREATE INDEX IF NOT EXISTS` statements still modify secondary objects. It is therefore not a valid source of truth and not a total no-op.

## Canonical identity-table contract

### `candidates`

- UUID primary key
- required `owner_id`
- canonical name, headline, location, company, title, summary and skills
- merge status constrained to pending, confirmed or rejected
- RLS enabled

### `source_profiles`

- UUID primary key
- required `owner_id`
- nullable candidate link
- stable source and source-profile identifier
- unique `(owner_id, source, source_profile_id)`
- source payload, match score and match reasons
- RLS enabled

The unique source key is the database anchor for exact-source idempotency and must remain intact.

### `evidence_items`

- UUID primary key
- owner, candidate and source-profile references
- source, label, detail, confidence and optional URL
- RLS enabled

### `candidate_contacts`

- UUID primary key
- owner, candidate and source-profile references
- contact type, value, source, confidence and permission status
- schema-level `CHECK (verified = false)`
- RLS enabled

The system currently enforces that no contact can be represented as verified.

### `identity_match_reviews`

- UUID primary key
- owner and candidate references
- `source_profile_ids uuid[]`
- score, reasons, conflicts and recruiter decision fields
- RLS enabled

The array representation cannot enforce one active source-profile/candidate proposal pair. This supports adding `identity_match_proposals` as a separate table in V29.3A1.

### `evidence_claims`

Absent from production. The existing V19 intelligence-spine design should be promoted and extended through a versioned migration rather than duplicated by a new `candidate_field_claims` table.

### `talent_graph_edges`

Present, owner-scoped and currently separate from canonical person identity resolution. It remains the generic relationship graph, not the source-profile-to-candidate identity mechanism.

## Ownership constraint

Existing candidate relationships generally reference record IDs alone. RLS protects normal user access, but the foreign-key layer does not itself guarantee that the referencing row and referenced row have the same owner.

New V29.3A1 structures should use ownership-safe composite relationships. Retrofitting the existing candidate graph is a separate migration decision because it affects more than 27,000 live records.

## Proposed reconciliation strategy

### Step 1: make the historical sequence replay-safe

Add `DROP POLICY IF EXISTS` and `DROP TRIGGER IF EXISTS` guards immediately before the corresponding creates. Rehearse until the second application succeeds eight of eight.

Do not apply those rewritten historical files to production merely because they become replay-safe. The purpose is to establish deterministic source truth and a reliable reconstruction path.

### Step 2: establish a versioned baseline

Create one reviewed, squashed baseline migration representing the reconciled production schema. Register the baseline as already applied only after a production schema diff proves it would make no change.

Migration-ledger repair is a production control-plane action and requires separate explicit approval.

### Step 3: decide each pending migration

- Review jobs v2 against the current live jobs tables.
- Review and rehearse owner-safety hardening independently.
- Hold role-calibration state until its product release is intentionally promoted.

Do not let these decisions ride implicitly with an identity migration.

### Step 4: archive superseded scaffolds

Move historical incompatible and superseded files into a clearly labeled archive. Keep the evidence-claims design available for promotion into V29.3A1.

## Release gates

The branch is documentation, manifest, deterministic contract tests and a disposable-database replay gate only.

It performs no production migration, repair, backfill, deletion, merge or schema write.

V29.3A1 remains blocked while `isLedgerReplaySafe()` returns false.

## Commands

```bash
cd next-public
npm ci
npm run typecheck
npm run test
npm run build
npm run migration:replay
```

Local replay requires PostgreSQL 17 plus `psql`, `createdb` and `dropdb`, configured through standard `PGHOST`, `PGPORT`, `PGUSER` and `PGPASSWORD` variables.
