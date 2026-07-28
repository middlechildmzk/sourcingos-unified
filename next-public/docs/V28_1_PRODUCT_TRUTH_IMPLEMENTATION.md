# V28.1 Product Truth Implementation

## Purpose

V28.1 corrects the product boundary between people, organizations, artifacts, publications, and manual discovery lanes while making candidate results the primary recruiter surface.

## Implemented

- Required `EntityKind` classification on every `SourceResult`.
- Centralized connector classification policy.
- Artifact-first display for package, model, repository, and search-lane results.
- Generated demo candidate fallback removed.
- Legacy authorized LinkedIn export records resolve as people at read time despite the historical `resume_xray` source label.
- Candidate results render before full source diagnostics.
- Source diagnostics remain collapsed during and after search.
- Search runs use an active run token and abort controller so stale responses cannot alter a newer search.
- Source-profile saves reject non-person entities, reuse existing canonical candidates, and fail closed on required child-write errors.
- Public Candidate Search uses one workbench entry point.
- `/app/agent-os` redirects to the canonical `/app/today/` inbox.

## Guardrails

- No production database mutation was performed.
- No migration was applied.
- No production deployment was promoted.
- No candidate or contact data was fabricated.
- Existing imported LinkedIn people were preserved.

## Remaining human verification

Use `V28_1_AUTHENTICATED_QA.md` against the preview before merging.
