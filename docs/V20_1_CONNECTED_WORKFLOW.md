# SourcingOS V20.1 — Connected Workflow

## Product outcome

V20.1 connects the previously separate private surfaces around a role-specific recruiting workflow:

1. Create and calibrate a role in `/app/roles`.
2. Approve or pause sourcing lanes.
3. Launch Candidate Search with the calibrated intake prefilled.
4. Import and normalize records in Candidate Database.
5. Add Candidate Database or Candidate 360 records to a role review queue.
6. Search imported network connections and add selected relationship-context records to a role.
7. Review evidence, contact state, fit rationale, and pipeline stage inside the role.
8. Check or synchronize browser workspaces through `/api/roles/sync` when durable storage is available.

## Browser-first continuity

The current production-safe fallback remains browser local storage:

- key: `sourcingos.v20.role-workspaces`
- active search context: `sourcingos.active-role-context.v1`
- Candidate Search intake draft: `sourcingos.workbench.intake-draft.v1`

Local role writes emit `sourcingos:role-workspaces-changed` so connected UI controls can refresh in the same tab.

## Candidate handoff behavior

Every handoff creates an unreviewed role candidate with:

- role-specific stage and fit decision
- source and optional source URL
- explicit contact state
- explicit evidence state
- duplicate protection based on source URL, canonical candidate id, or normalized profile identity
- activity event recording

A handoff does not verify or infer:

- same-person identity across profiles
- qualification or role fit
- current employer or location
- clearance or license status
- availability or job-seeking intent
- contact accuracy or permission to contact

## Durable contract

`sql/role-workspace-v20-1.sql` adds:

- `role_workspaces`
- `role_search_lanes`
- `role_candidates`
- `role_activity`

All tables are owner scoped with RLS. Direct `anon` and `authenticated` writes are revoked. Authenticated users receive owner-scoped SELECT only. Writes are performed through authenticated server APIs that scope every operation to `gate.userId`.

`POST /api/roles/sync` performs bounded, idempotent upserts. It never deletes local or server records during this phase.

`GET /api/roles/sync` returns the current owner’s durable workspaces when available, or an explicit preview-mode response when persistence is unavailable.

## Release boundary

The Supabase project is still reported as `INACTIVE`. Therefore:

- the SQL migration is not applied
- durable sync cannot be production verified
- browser storage remains the active workspace store
- real candidate data should not be treated as durably stored

Before enabling durable beta:

1. Restore or replace the Supabase project.
2. Inventory current schema, grants, migrations, and Data API exposure.
3. Create a Supabase preview branch.
4. Apply V19 and V20.1 migrations in preview only.
5. Run anonymous-denial and two-user owner-isolation tests.
6. Validate idempotent sync and recovery from a partial failure.
7. Confirm backup, export, and rollback.
8. Promote deliberately.

## Automated verification

CI must pass:

```bash
cd next-public
npm ci
npm run typecheck
npm run test
npm run build
```

Regression coverage includes:

- intake and clearance parsing
- internal-first sourcing lanes
- no invented candidates
- role-specific fit metrics
- minimum calibration sample
- role handoff duplicate identity keys
- normalized role schema
- RLS enablement
- SELECT-only authenticated grants
- idempotency constraints
