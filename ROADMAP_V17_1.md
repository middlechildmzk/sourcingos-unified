# SourcingOS V17.1 Roadmap Checkpoint

## Shipped in V17.1

- Source connector API foundation for GitHub, Stack Overflow, OpenAlex, and NPI Registry.
- `/api/sources/search` for multi-source public profile search.
- `/api/sources/refresh` preview route for future scheduled candidate refresh.
- Shared `SourceResult`, evidence, contact signal, and identity signal schema.
- Candidate Graph identity matching with name, location, website, public email, organization, and skill overlap.
- Public `/sources` connector preview UI.
- Candidate Graph explainer at `/app/candidate-graph`.
- Recruiter-confirmed merge model. No auto-merge at any confidence level.

## What is still preview

- Source connector results are live when public APIs respond, with demo-safe fallback when rate-limited or unavailable.
- Candidate graph persists locally/export only. Production persistence should use Supabase/Postgres.
- Background refresh is route-ready, but not scheduled. Production should use Vercel Cron, Inngest, Trigger.dev, or a queue.

## Recommended V17.2

- Add Supabase candidate graph tables.
- Add saved source profiles and merge review workflow.
- Add refresh jobs and stale profile detection.
- Add ORCID, Semantic Scholar, arXiv, PubMed, ClinicalTrials.gov, Hugging Face, npm, and PyPI connectors.
- Add Candidate 360 import from public connector results.
