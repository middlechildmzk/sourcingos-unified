# Production Entity and Provenance Reconciliation

## Status

Read-only inventory complete. No production rows were changed, deleted, relabeled, or backfilled.

Production project:

- Name: `sourcingos-unified`
- Project ref: `dtkbddsjcovtesajmdix`
- Status during inventory: `ACTIVE_HEALTHY`

## Verified counts

| Table or workflow | Count |
| --- | ---: |
| candidates | 27,307 |
| source_profiles | 27,303 |
| evidence_items | 27,319 |
| candidate_contacts | 28,226 |
| role_workspaces | 0 |
| acquisition_campaigns | 0 |
| agent_workflows | 0 |
| autosource_inbox | 0 |

## Source-profile distribution

| Stored source | Rows |
| --- | ---: |
| resume_xray | 27,295 |
| github | 3 |
| devto | 2 |
| pypi | 2 |
| npm | 1 |

## Critical provenance finding

Of the 27,295 rows stored as `resume_xray`:

- 27,294 have `raw.importType = 'linkedin_connections'`
- 27,294 have `raw.importSource = 'linkedin_export'`
- one is an actual public Resume X-Ray search-lane record

The 27,294 imported rows are authorized LinkedIn connection records, not Resume X-Ray search artifacts. They were assigned misleading source provenance during ingestion.

Application compatibility now classifies those 27,294 rows as `person` at read time. The actual Resume X-Ray record remains `search_lane`.

## Confirmed non-person or uncertain records

Read-only inspection confirmed examples including:

- `devops`, a PyPI package with no author or maintainer name
- `Abel Solutions`, a DEV Community organizational account
- one public Resume X-Ray search-query record

These records must not appear in the main people list or be assignable to a role as candidates.

## Read-only inventory SQL

```sql
select
  (select count(*) from public.candidates) as candidates,
  (select count(*) from public.source_profiles) as source_profiles,
  (select count(*) from public.evidence_items) as evidence_items,
  (select count(*) from public.candidate_contacts) as candidate_contacts,
  (select count(*) from public.role_workspaces) as role_workspaces,
  (select count(*) from public.acquisition_campaigns) as acquisition_campaigns,
  (select count(*) from public.agent_workflows) as agent_workflows,
  (select count(*) from public.autosource_inbox) as autosource_inbox;
```

```sql
select
  source,
  count(*) as profiles,
  min(created_at) as first_created,
  max(created_at) as last_created
from public.source_profiles
group by source
order by profiles desc;
```

```sql
select
  coalesce(raw->>'importType', '(none)') as import_type,
  coalesce(raw->>'importSource', '(none)') as import_source,
  count(*) as rows
from public.source_profiles
where source = 'resume_xray'
group by 1, 2
order by rows desc;
```

```sql
select
  source,
  count(*) as rows,
  count(distinct source_profile_id) as distinct_source_ids,
  count(distinct candidate_id) as distinct_candidates,
  count(*) - count(distinct source_profile_id) as duplicate_source_rows
from public.source_profiles
group by source
order by rows desc;
```

## Proposed future backfill

A future rehearsed migration may:

1. Introduce an honest import provenance field or source value such as `authorized_linkedin_export`.
2. Update only rows satisfying both legacy markers:
   - `raw->>'importType' = 'linkedin_connections'`
   - `raw->>'importSource' = 'linkedin_export'`
3. Leave the actual Resume X-Ray search record unchanged.
4. Add an explicit subject-kind column only after application contracts and rollback behavior are verified.
5. Recalculate user-visible counts so candidate totals include people only.

## Required rehearsal checks

Before any production backfill:

- run against a disposable Supabase branch
- record exact before and after counts
- verify all 27,294 imported LinkedIn records remain linked to the same candidate IDs
- verify the actual Resume X-Ray record remains a search lane
- verify RLS remains enabled and owner-scoped
- verify Candidate Database pagination and search
- verify Candidate 360 for sampled imported records
- verify rollback restores the original provenance values

## Rollback strategy

A future migration must capture affected source-profile IDs in a reconciliation ledger or deterministic predicate. Rollback must restore the previous source label only for the exact rows changed by that migration.

No backfill is included in V28.1 and no production mutation was performed.
