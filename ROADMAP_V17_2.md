# SourcingOS V17.2 Roadmap Checkpoint

## What V17.2 adds

V17.2 expands the V17.1 source connector layer into a more complete Candidate Graph foundation.

### Connected source coverage

Live/demo-safe connectors now cover:

- GitHub
- Stack Overflow / Stack Exchange
- OpenAlex
- NPI Registry
- ORCID
- Semantic Scholar
- arXiv
- PubMed / NCBI E-utilities
- Hugging Face
- npm Registry
- PyPI package signal fallback

All connectors normalize into one `SourceResult` schema with evidence items, contact signals, identity signals, refresh timestamps, raw payloads, and guardrails.

### Persistent Candidate Graph scaffold

Added a preview persistence layer with:

- candidate save route
- candidate list route
- merge decision route
- manual candidate refresh route
- scheduled-refresh route for cron/queue integration
- in-memory adapter for local preview
- Supabase/Postgres SQL schema in `next-public/sql/candidate-graph-schema.sql`

### Candidate identity model

The model remains recruiter-confirmed:

1. Source profiles stay separate.
2. Identity signals generate match reviews.
3. Candidate Graph suggests possible rollups.
4. Recruiter confirms or rejects merge.
5. Background refresh updates source profiles and evidence over time.

No auto-merge at any confidence level.

## Next

V17.3 should connect the preview persistence layer to Supabase and add real background jobs through Vercel Cron, Inngest, Trigger.dev, or another queue.
