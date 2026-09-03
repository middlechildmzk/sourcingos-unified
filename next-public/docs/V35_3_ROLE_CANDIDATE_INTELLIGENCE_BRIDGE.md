# V35.3 — Role ↔ Candidate Intelligence Bridge

## Purpose

V35.3 connects recruiter-controlled Entity Intelligence to actual retrieval and explains Candidate Graph matches without collapsing search strategy, recruiter requirements, and candidate evidence into one truth layer.

## Truth layers

1. **Recruiter intent** — approved Role Brief / `RoleIntake`. This remains authoritative for must-haves, preferences, location intent, clearance, and disqualifiers.
2. **Search intelligence** — recruiter-approved entity/location expansion. This may broaden discovery and source queries but cannot satisfy candidate requirements.
3. **Candidate evidence** — source-linked Evidence Ledger claims and Candidate Graph profile facts. This is the only layer that can support a candidate requirement under the existing evidence policy.

## Search approvals

The `RoleEntityIntelligenceV35` panel allows the recruiter to approve or remove suggested entity and location expansions. Approvals are recorded as versioned `search_intelligence_updated` role-activity events and replayed into `RoleWorkspace.searchIntelligence` during workspace reconciliation.

This uses the existing atomic role snapshot and activity log. No new database migration is required for V35.3.

### Retrieval behavior

- The exact-title lane remains unchanged.
- Approved occupation/title variants may expand adjacent-title/company discovery lanes.
- Approved skills, technologies, and credentials may expand capability/evidence discovery lanes.
- Approved company entities may expand target-company retrieval.
- Approved location entities are added to connector execution geography.
- Sensitive clearance/citizenship concepts are filtered from public-source queries even if present in search intelligence.

First-review admission and requirement assessment continue to use the unchanged recruiter `RoleIntake`.

## Candidate explanation packet

`buildRoleCandidateIntelligenceV35` returns a decomposable explanation rather than a universal fit score:

- supported recruiter requirements;
- requirements needing verification;
- missing evidence / unknowns;
- contradictions;
- observed recruiter-approved discovery signals, explicitly labeled search-only;
- structured geography relative to the role anchor and recruiter-approved location expansions;
- trust statements explaining the boundaries.

The Role Workspace renders these packets in `RoleCandidateIntelligenceV35` under **Why these people surfaced**.

## Non-negotiable invariants

- Search expansion != candidate evidence.
- Exact-title search is not silently broadened.
- Missing evidence != negative finding.
- Approved nearby location != candidate residence fact.
- Clearance remains verification-gated and is never inferred from public technical evidence.
- No opaque fit score, auto-rejection, auto-shortlist, auto-contact, or automatic cross-source identity merge is introduced.
- Recruiter-approved search expansion is auditable and reversible.

## Golden regression examples

- Approving Ansible can broaden RHEL discovery, but Ansible evidence cannot satisfy an RHEL must-have.
- Approving Fort Meade can add it to Annapolis Junction retrieval geography without rewriting the Role Brief location.
- Approving TS/SCI as a search concept cannot leak clearance language into GitHub/Stack Exchange/DEV/Hugging Face/research/X-Ray public queries.
- Search approval events restore correctly even when Supabase returns activity newest-first.
