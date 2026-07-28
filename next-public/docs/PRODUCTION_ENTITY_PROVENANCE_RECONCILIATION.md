# Production Entity and Provenance Reconciliation

## Scope

This document records the read-only production inventory performed for SourcingOS. No backfill, deletion, migration, or production mutation was executed.

## Verified counts

- candidates: 27,307
- source_profiles: 27,303
- evidence_items: 27,319
- candidate_contacts: 28,226
- role_workspaces: 0
- acquisition_campaigns: 0
- agent_workflows: 0
- autosource_inbox: 0

## Source-profile distribution

- resume_xray: 27,295
- github: 3
- devto: 2
- pypi: 2
- npm: 1

## Critical provenance finding

Of the 27,295 rows labeled `resume_xray`, 27,294 contain:

- `raw.importType = 'linkedin_connections'`
- `raw.importSource = 'linkedin_export'`

These are authorized imported LinkedIn connection records and must be treated as people. They were historically assigned a misleading connector source label. One remaining `resume_xray` row is an actual manual public Resume X-Ray search lane.

## Confirmed non-person or uncertain records

- `devops`, a PyPI package with no author or maintainer name.
- `Abel Solutions`, a DEV organizational account.
- The actual Resume X-Ray query record.

## Application-layer reconciliation

V28.1 resolves legacy LinkedIn-export rows as `person` before applying connector defaults. New connector output carries a required entity kind. Non-person entities cannot be saved as candidates or added to roles.

## Proposed future database backfill

A separately reviewed and rehearsed migration may:

1. Add explicit entity/provenance columns if the production schema requires durable classification.
2. Relabel authorized LinkedIn imports to an honest import provenance such as `authorized_linkedin_export`.
3. Preserve canonical IDs, source-profile IDs, evidence, contact signals, and ownership.
4. Mark actual search lanes and artifacts without deleting them.
5. Exclude non-person entities from candidate counts and candidate workflows.

## Rollback strategy

- Capture affected row IDs and prior source/provenance values before any update.
- Apply updates in one transaction on an isolated Supabase branch first.
- Verify counts, ownership, RLS, candidate relationships, and route behavior.
- Retain a reversible mapping table or rollback SQL restoring original values.
- Do not delete rows as part of the provenance correction.

## Read-only verification queries

```sql
select count(*) from public.candidates;
select count(*) from public.source_profiles;
select source, count(*) from public.source_profiles group by source order by count(*) desc;

select
  coalesce(raw->>'importType', '(none)') as import_type,
  coalesce(raw->>'importSource', '(none)') as import_source,
  count(*)
from public.source_profiles
where source = 'resume_xray'
group by 1, 2
order by 3 desc;
```

## Explicit confirmation

No production backfill was executed. No rows were deleted or rewritten.
