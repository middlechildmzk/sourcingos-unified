# V39 — Owned Talent Graph + Hybrid Search Index

V39 turns the durable Candidate Graph into SourcingOS's first deliberately indexed owned talent graph. It does **not** claim that SourcingOS already owns 100M, 500M, or 1B people. The graph grows only as permitted candidate observations are saved, imported, refreshed, and recruiter-confirmed.

## Architecture

`canonical candidate <- source profiles <- evidence / contacts / recruiter role state`

V39 adds a separate search-document layer rather than flattening provenance into the canonical record. The index can therefore be rebuilt as source observations age, expire, become restricted, or move through recruiter-approved identity merges.

### Retrieval shipped in V39

- PostgreSQL full-text retrieval (`tsvector` + GIN)
- exact structured filters for title, skills, company, location, evidence-backed clearance terms, and evidence-backed certifications/credentials
- freshness and source/evidence counts returned as diagnostics
- canonical identity redirects excluded so an absorbed identity is not returned as another person
- one durable indexed row per canonical candidate

The retrieval rank is a search relevance signal only. It is never a hiring score or qualification decision.

### Semantic/vector status

The production Supabase project does not currently have the `vector` extension enabled. V39 therefore does not fake semantic search or silently introduce a vector dependency. The endpoint advertises `semanticVector: false`. A later V39.x tranche can deliberately enable pgvector, choose an embedding model/version, add backfill/versioning, and benchmark hybrid lexical+vector retrieval before turning it on.

## Source rights and retention

Every `source_profiles` observation gains explicit metadata:

- `acquisition_basis`
- `usage_scope`
- `search_allowed`
- `raw_export_allowed`
- `retention_until`
- `refresh_after`
- `rights_metadata`

Legacy rows remain searchable under `legacy_unclassified` until a more specific rights record is applied. Setting `search_allowed=false` or passing `retention_until` removes that source observation and its linked evidence from future index refreshes without destroying provenance/audit history.

Raw provider export remains false by default.

## Privacy/search boundary

Generic hybrid talent retrieval intentionally does not index email addresses or phone numbers. Known-person lookup can still resolve an already-observed contact through the dedicated person-lookup workflow, but contact values are not broad search-document material.

## Maintenance

The search document is refreshed when:

- canonical candidate fields change
- source profiles are inserted, changed, moved, or removed
- evidence is inserted, changed, moved, or removed
- an identity redirect changes

The migration also backfills existing candidates once.

At substantially larger scale we should move refresh into an asynchronous indexing queue rather than doing aggregate document rebuilds synchronously on every observation write.

## API

`POST /api/candidate-db/hybrid-search`

Accepted structured controls:

- `query`
- `titles[]`
- `skills[]`
- `companies[]`
- `locations[]`
- `clearances[]`
- `certifications[]`
- `limit`
- `offset`

Responses identify the retrieval capabilities and preserve explicit trust metadata.

## Next V39.x work

1. Feed owned-graph retrieval into the Smart source router so SourcingOS can search its own graph before spending on external providers, then federate only when needed.
2. Add embedding/version tables and pgvector only after a deliberate database-extension migration and benchmark set.
3. Add graph-growth telemetry: canonical candidates, source observations, coverage by field/source, freshness, identity confidence, rights classification, and refresh debt.
4. Add scalable asynchronous refresh/backfill jobs.
5. Build the Chrome extension as a thin client over known-person lookup, Candidate 360, approved contact enrichment, and save-to-role—not as a second candidate database.
