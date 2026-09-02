# SourcingOS V35 — Candidate Intelligence Foundation

## Status

This slice is intentionally **shadow/read-only** for canonical Candidate 360 resolution and **provider-neutral** for contact enrichment orchestration.

It is stacked on the V34 search-quality branch so it can use:

- identity-readiness gating;
- Candidate Graph source-profile linkage;
- recruiter-confirmed atomic identity fusion;
- V34 public identity/contact fusion.

It does **not** add new persistent tables or change cross-source merge authority.

## Product boundary

V35 Candidate Intelligence answers:

> Which linked observations belong to this canonical candidate, which value should Candidate 360 currently display, what conflicts remain, and when is paid contact enrichment sufficiently grounded?

It does not answer:

> Is this person qualified for the job?

Role fit remains evidence/requirement assessment plus recruiter judgment. RIG remains responsible for role/search intelligence.

---

## Delivered

### 1. Shadow Candidate 360 field resolver

`lib/candidate-field-resolution-v35.ts`

Resolves, without mutating the candidate record:

- canonical professional name;
- headline;
- current title;
- current company;
- location;
- primary visible email from attached legacy contact observations.

The resolver:

- preserves legacy candidate scalars as compatibility observations;
- considers only source profiles already linked to the candidate and not rejected;
- discounts handle-like single-token names;
- uses field-specific normalization;
- treats compatible city / metro wording as the same location concept;
- rewards independent-source corroboration;
- marks close disagreements `needs_review` instead of silently overwriting;
- keeps alternatives/conflicts visible;
- blocks do-not-contact email signals from the actionable resolved view;
- treats old contact observations as stale.

The current utility calculation is explicitly a **shadow policy**, not a production hiring/ranking score.

### 2. Candidate assessment API integration

`POST /api/role-candidate-assessment`

Now returns:

- existing V34 `publicIdentity`;
- V35 `resolvedProfile`;
- `profileResolutionShadow` telemetry comparing legacy scalar values to the resolved projection.

Existing `canonicalName` and `headline` compatibility fields remain unchanged.

No database writes occur from field resolution.

### 3. Richer contact truth model

`lib/contact-enrichment/types.ts`

Separates:

- provider identity ownership confidence;
- technical deliverability/validity;
- permission to contact;
- provider-native status;
- safe provider match metadata.

A valid or verified contact never implies permission.

### 4. Provider-neutral enrichment orchestrator

`lib/contact-enrichment/orchestrator-v35.ts`

Introduces purpose-aware provider lanes:

- identity enrichment;
- work-email finder;
- email verification;
- phone enrichment.

The orchestrator supports:

- provider capability filtering by purpose;
- ordered fallback;
- maximum paid attempts;
- estimated-credit ceilings;
- deterministic stop reasons;
- normalized attempt telemetry.

The live API still runs **PDL only** in this slice. The value is the architectural seam: adding Hunter/Apollo later should not require rewriting the route or weakening identity gating.

### 5. PDL match provenance

The PDL adapter now:

- preserves `min_likelihood=6`;
- requests `include_if_matched=true`;
- preserves safe provider person ID;
- preserves top-level provider likelihood;
- preserves matched field names rather than a full raw response;
- maps identity-match confidence separately from contact deliverability;
- keeps permission unknown.

Rich V35 provider metadata is returned in shadow mode but is **not persisted** until the replay-safe durable Evidence Ledger write path is approved.

---

## Trust invariants

1. Search criteria never become candidate facts.
2. RIG/search inference never becomes Candidate 360 source truth by itself.
3. Contact providers never decide candidate fit.
4. Contact providers never decide cross-source identity merge.
5. Cross-source merge remains recruiter-confirmed.
6. Do-not-contact suppresses actionable contact resolution.
7. Contact deliverability never implies permission.
8. Provider identity conflicts must remain reviewable rather than overwrite canonical fields.
9. Candidate 360 field resolution is independent of role requirement scoring.
10. No new persistent metadata path ships before RLS/replay/idempotency safety is proven.

---

## Why no new tables in this slice

The existing Evidence Ledger already contains most observation primitives needed for durable Candidate 360 provenance:

- field name/value;
- evidence class;
- confidence;
- source/provenance;
- freshness;
- conflicts;
- reviewer state;
- permitted use;
- PII classification.

The intended next persistence milestone is to finish the durable Evidence Ledger transition, not create a second competing observation store.

A future `candidate_field_resolutions` table may persist **resolution decisions** (winner, conflicts, policy version, recruiter lock), while raw observations remain Evidence Ledger claims.

---

## Next substantial milestone

After this shadow foundation is validated:

1. reconcile durable `evidence_claims` writes with the replay-safety prerequisite;
2. persist provider match/contact dimensions through the Evidence Ledger;
3. add a professional work-email lane (Hunter or equivalent configured provider);
4. add email verification as a separate deliverability step;
5. add recruiter field confirm/reject/lock UI;
6. switch Candidate 360 display from legacy scalar fields to resolved projections only after shadow parity is understood;
7. keep phone enrichment explicit and opt-in.
