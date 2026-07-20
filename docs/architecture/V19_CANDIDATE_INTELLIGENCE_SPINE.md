# SourcingOS V19 — Candidate Intelligence Spine

## Decision

V19 turns the existing evidence-first product language into reusable infrastructure. It does not add a free-roaming AI recruiter. It introduces the first shared trust layer that Candidate Search, Candidate Database, Network Vault, Career Match, market maps, ranking, outreach drafts, CRM writes, and deliverables can reuse.

## Delivered in this slice

- `lib/evidence-ledger.ts`
  - Field-level evidence classes
  - Confidence, freshness, provenance, reviewer state, permitted use, conflict preservation, and PII flags
  - Legacy Candidate Database adapter so existing data immediately benefits
- `lib/supabase-evidence-ledger.ts`
  - Server-only, owner-scoped reads across current candidate/evidence tables
- `GET /api/candidate-db/evidence-ledger`
  - Auth required
  - Rate limited
  - Read-only
  - Candidate-scoped filtering supported
- `/app/evidence-ledger`
  - Loading, error, empty, filtering, conflict, stale, review-required, and blocked-use states
- `sql/candidate-intelligence-spine-v19.sql`
  - Additive `evidence_claims`, append-only `evidence_claim_events`, and `action_approval_requests`
  - RLS and owner-scoped policies
  - No anonymous access
  - No autonomous action execution
- Regression tests for evidence separation, consent/suppression, stale availability, identity conflicts, and tenant-safe candidate filtering

## Evidence standard

- **Verified Fact** — the specific claim is directly supported. It does not verify unrelated identity, employment, clearance, availability, or consent conclusions.
- **Supported Inference** — corroborated enough to be useful, but still requires human review before consequential use.
- **Weak Signal** — plausible lead, not a fact.
- **Unknown** — not established.
- **Stale** — outside the claim-specific freshness window.
- **Conflicting** — credible sources disagree; preserve both sides.

## Action boundary

This slice is read-only. It does not:

- merge identities
- verify contact ownership or consent
- send outreach
- change ATS/CRM status
- export candidate data
- reject candidates
- alter permissions
- scrape authenticated or restricted platforms

The `action_approval_requests` table is only the durable approval contract for future safe-write workflows.

## Deployment sequence

1. Run `npm run typecheck`, `npm run test`, and `npm run build` from `next-public/`.
2. Validate `/app/evidence-ledger` in a protected Vercel preview using synthetic candidate fixtures.
3. Review the SQL migration against the actual production schema and Supabase Data API exposure settings.
4. Apply to a Supabase preview branch first.
5. Run RLS tests for two users and verify no cross-owner reads or writes.
6. Confirm anonymous roles have no access.
7. Promote only after rollback and backup evidence exists.

## Next slice after V19 foundation

1. Write new imports and source connectors directly into `evidence_claims` while preserving legacy adapters.
2. Add reviewer decisions and append-only claim events.
3. Add Candidate 360 evidence cards and source appendix.
4. Add explainable ranking features that reference claim IDs rather than copied text.
5. Add draft-only outreach grounded in approved claims.
6. Add the Safe Write Gateway using `action_approval_requests` and connector capability manifests.
