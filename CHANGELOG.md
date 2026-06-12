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

## Lesson — build on merged main, not the stale working copy (2026-06-11)
**Before building a new feature, confirm the build base is the latest MERGED main — a stale local working copy can silently reintroduce removed code.**
The Phase 2 build base was re-cloned from main (6f372c3, post-security-merge) rather than reusing the in-container working copy still at 573a2d1 (pre-patch). Building on the stale copy would have shipped the new tool on top of fail-open code. The Clearance Search Builder was authored, typechecked, linted, tested (30/30), and built against fresh main, so its patch applies cleanly without resurrecting removed routes.

## Lesson — reuse the existing deterministic extractor, don't rebuild it (2026-06-12)
**Before writing new client-side parsing, grep lib/ for an existing extractor — the JD→Boolean upgrade reused parseJobDescription() instead of duplicating entity recognition.**
The repo already had a 294-line deterministic JD parser (lib/jd-parser.ts) with must/nice section splitting, clearance/title/tool recognition, and false-positive detection. The flagship Boolean upgrade layered only the three-lane generator + noise stripping on top (lib/jd-boolean-lanes.ts) and reused the parser wholesale. This kept the new tool small, consistent with the JD Strategy tool's behavior, and free of a second extraction code path to maintain. The export name BooleanTool was preserved so /tools/boolean-generator stayed stable.
