# V33.4 Review-Speed Gate

This gate implements two high-confidence findings from the Aug. 31 product review without weakening SourcingOS trust boundaries.

## Recruiter reason chips

A **No** decision now requires one recruiter-authored reason category:

- Too hands-on
- Too junior
- Too senior
- Wrong domain
- Location / work mode
- Requirement conflict
- Other

The category is recruiter feedback, not candidate evidence. Optional free text is stored as recruiter context. `Other` requires detail. Changing a candidate from No to Yes/Maybe removes the structured negative-review reason so stale rejection feedback cannot continue to shape later calibration.

Unknown, missing, or unverifiable evidence never selects a rejection category automatically. A contradicted must-have or recruiter-defined disqualifier may preselect **Requirement conflict** as a convenience, but the recruiter still confirms the decision.

## Evidence in the review slate

Each canonical candidate row now promotes one real evidence snippet from the existing requirement assessment instead of generating a fit explanation or score. Selection order is deterministic:

1. supported must-have evidence,
2. other supported evidence,
3. must-have evidence needing verification,
4. other evidence needing verification,
5. contradiction only when no stronger evidence snippet is present.

When the evidence claim has a source URL, the row exposes a direct source link. When no source-linked evidence is available, the row says so explicitly. Missing evidence remains unknown, not negative.

## Guardrails

- no match percentage or fit score,
- no candidate fact derived from recruiter search criteria,
- no automatic No decision,
- no automatic shortlist,
- no automatic search mutation from a reason chip,
- no clearance/citizenship inference as verified fact,
- no silent identity merge,
- no outreach authorization.

These changes reduce review friction while preserving the existing **Autonomous research. Human hiring decisions.** contract.
