# Changelog

## V17.2 — Persistent Candidate Graph + Expanded Source Connectors

- Expanded source coverage to GitHub, Stack Overflow, OpenAlex, NPI, ORCID, Semantic Scholar, arXiv, PubMed, Hugging Face, npm, and PyPI.
- Added normalized `SourceResult` schema across technical, research, healthcare, and package ecosystem sources.
- Added persistent Candidate Graph preview adapter.
- Added candidate graph API routes:
  - `/api/candidates/save`
  - `/api/candidates/list`
  - `/api/candidates/merge`
  - `/api/candidates/refresh`
  - `/api/candidates/scheduled-refresh`
- Added Supabase/Postgres SQL schema for production persistence.
- Added explicit refresh policy, next refresh timestamp, match review records, and merge decision workflow.
- Updated connected source UI with source families, saved candidate graph preview, merge confirm/reject actions, and scheduled refresh preview.
- Preserved no-auto-merge and no-auto-outreach guardrails.
