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

## Lesson — verification scope (2026-06-11)
**A "verified" claim must name WHERE it was verified: working tree, remote main, or live deployment — they were three different codebases this week.**
The June security sprint was fully verified in the working tree (typecheck/lint/30 tests/build), but remote main and production never received the patch. Production was still serving unauthenticated API routes (e.g. /api/persistence/status returning env-var names) days after a "12/12 pass" report that was true only of the patched tree. Durable rule: every closeout must end with three explicit lines — tree state, remote state, deployed state — each with its own evidence.
