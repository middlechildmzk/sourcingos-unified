# V29.3A1 — Durable Identity Foundation

## Objective

Establish the durable, owner-scoped foundation for resolving many source fragments into one canonical candidate while preserving provenance, conflicts, negative evidence, and recruiter control.

The central contract is:

`many source fragments -> one canonical candidate -> field-level provenance -> recruiter-controlled identity decisions`

## Stack

This slice is stacked on:

1. PR #52 — migration-ledger reconciliation
2. PR #53 — replay-safety remediation and held migrations
3. PR #54 — zero-change canonical baseline alignment

It must not merge before those three slices.

## Scope

V29.3A1 adds:

- durable identity schema
- conservative normalization
- observed-only identifier extraction
- owner-scoped blocking
- explicit deterministic rule inventory
- explainable probabilistic similarity
- blocking, material, and informational conflicts
- proposal-only resolver decisions
- field-level canonical selection without record rewriting
- labeled fixture evaluation
- PostgreSQL 17 migration rehearsal

It does not add a recruiter review UI or production write route. Those belong to the next slice after the schema and resolver contracts are approved.

## Source-role taxonomy

### Person anchors

- GitHub user
- Stack Overflow user
- OpenAlex author
- named ORCID profile
- NPI individual
- Semantic Scholar author
- authorized imported person profile

### Evidence artifacts

- repository
- package
- publication
- article
- model
- dataset
- notebook

### Organizations

- company
- GitHub organization
- institution
- laboratory
- government organization

### Unresolved identities

- identifier-only ORCID
- account without sufficient person evidence
- author string without authoritative person anchor

### Discovery lanes

- public resume X-ray
- Kaggle/manual-safe discovery paths

Only `person_anchor` enters candidate identity resolution.

## Active migrations

The active migration directory contains exactly:

1. `20260730172500_canonical_baseline_anchor.sql`
2. `20260730181000_durable_identity_foundation.sql`

Every unrelated migration remains held.

Production application is not authorized by this branch.

## New durable tables

### `source_profile_snapshots`

Immutable raw and normalized observations, idempotent by owner, source profile, and payload hash.

### `source_profile_identifiers`

Observed normalized identity anchors. Sensitive identifiers are matched by deterministic HMAC/SHA-256 values rather than avoidable plaintext.

### `identity_block_keys`

Bounded owner-scoped comparison keys. Name-location and name-organization are candidate-generation blocks only and never proof of identity.

### `identity_match_proposals`

Auditable source-profile-to-candidate proposals with decision class, component scores, rule evidence, conflicts, resolver version, status, reviewer decision, and supersession history.

Only one pending proposal may exist for an owner/source-profile/candidate pair.

### `evidence_claims`

Promotes and extends the V19 evidence-claim concept with:

- `value_json`
- normalized value
- field-specific source reliability
- freshness score
- corroboration count
- active/superseded/conflicting/rejected/unresolved lifecycle
- owner-safe candidate and source-profile foreign keys

### `evidence_claim_events`

Append-only claim event contract.

### `candidate_merge_events`

Reversible candidate-consolidation audit contract. V29.3A1 creates no merge executor and performs no candidate consolidation.

## Ownership and access

New tables use composite foreign keys such as:

- `(owner_id, source_profile_id) -> source_profiles(owner_id, id)`
- `(owner_id, candidate_id) -> candidates(owner_id, id)`

All new tables:

- enable RLS
- grant authenticated users owner-scoped SELECT only
- grant no browser INSERT, UPDATE, DELETE, or TRUNCATE privilege
- contain no public write policy

Server-side writes remain a later, explicitly authorized gateway.

## Normalization

The resolver preserves original values and uses normalized forms only for comparison.

Implemented normalization includes:

- Unicode names
- comparison-only diacritic folding
- punctuation-preserving handles
- organizations
- locations
- profile URLs
- website domains
- provider-specific email normalization
- validated ORCID checksums

Email plus-tags and dots are not removed universally. Gmail behavior is normalized only for Gmail/Googlemail.

## Identifier extraction

Only observed identifiers are extracted:

- stable platform IDs
- explicit profile URLs
- observed handles
- public email hashes
- website domains
- validated ORCID IDs
- explicit `sameAs` or outbound profile links

The resolver does not:

- guess email formats
- probe Gravatar
- probe SMTP
- infer a LinkedIn URL from name and employer
- treat a Git commit email as verified

## Blocking

Initial blocks include:

- stable platform identifier
- normalized profile URL
- explicit linked profile URL
- public email hash
- ORCID hash
- personal domain
- uncommon handle
- name plus location
- name plus organization

Block hashes include `owner_id`, preventing cross-tenant candidate generation.

Comparison candidates are capped and deterministically ordered.

## Deterministic rule inventory

- `same_source_stable_id`
- `explicit_cross_profile_link`
- `same_observed_public_email_and_compatible_name`
- `same_authenticated_or_imported_orcid`
- `same_personal_site_explicitly_linking_both_profiles`
- `same_authorized_resume_profile_url`

A numeric score is never a deterministic rule.

## Resolver decisions

### `exact_source_reuse`

Same owner, source, and stable source-profile ID. Reuse idempotently.

### `deterministic_attach`

At least one approved cross-source deterministic rule passes and no blocking conflict exists. The pure resolver marks the relationship safe to attach, but V29.3A1 does not execute a database attachment.

### `high_priority_review` / `standard_review`

Similarity and blocking evidence rank recruiter review. The source profile remains separate.

### `create_new_candidate`

No meaningful candidate comparison. The resolver returns a recommendation only and does not create a record automatically.

### `do_not_link`

Non-person source object, organization, artifact, publication, discovery lane, or unresolved identity.

## Similarity components

- name
- handle
- location
- organization
- personal domain
- explicit external link
- chronology compatibility

Jaro-Winkler is one component, not identity proof.

Thresholds rank fixtures for review only. They do not authorize linking.

## Conflict rules

### Blocking

- cross-owner candidate
- non-person source
- different stable account on the same platform
- different validated ORCID IDs

### Material

- materially different authoritative names
- different public emails
- different personal websites
- incompatible long employment chronology

Different emails are negative evidence, not proof of different people.

### Informational

- exact common-name match without a strong corroborating anchor

## Field-level canonical selection

Canonical values are selected from claims using:

- field-specific source reliability
- freshness
- corroboration
- recruiter review state
- conflict lifecycle

Examples:

- GitHub is strong for repository, skill, and public-link claims but weak for current employment.
- ORCID is strong for ORCID identity and works but weak for current corporate title.
- NPI is strong for provider identity and taxonomy but not full employment history.
- imported resumes are useful for candidate-supplied chronology but carry freshness risk.

The service returns the selected value, supporting claims, conflicting claims, reason, freshness, and review requirement. It never rewrites `candidates` automatically.

## Labeled fixture evaluation

The initial set includes 24 cases across:

- exact-source reuse
- explicit cross-links
- authorized resume links
- shared ORCID
- shared observed public email
- common-name prime/metro collisions
- common Chinese, Indian, and Spanish names
- diacritics
- missing middle names
- possible name changes
- same city or employer only
- different same-platform accounts
- different public emails
- different personal websites
- different ORCID IDs
- tenant isolation
- publications, packages, organizations, and identifier-only ORCID records

The evaluation report includes:

- exact-source precision
- deterministic-attach precision
- review recall
- false-positive and false-negative case IDs
- decision-class confusion matrix
- score distributions
- cohort accuracy

These fixtures validate behavior contracts only. They do not establish production accuracy. Thresholds require calibration against real recruiter-reviewed SourcingOS decisions.

## PostgreSQL migration gate

`npm run migration:identity`

The PostgreSQL 17 gate proves:

- identity migration fails without the canonical baseline
- reconstructed production applies
- baseline anchor applies first
- identity migration applies
- canonical row counts do not change
- every new table exists, starts empty, and has RLS
- browser roles receive no direct write privilege
- second application is idempotent
- schema fingerprint remains identical after replay
- cross-owner source-profile attachment fails at the foreign-key layer

## Known limitations

- No durable proposal write gateway yet
- No recruiter review API yet
- No review UI yet
- No source-profile attachment RPC yet
- No candidate-to-candidate merge executor
- No production threshold calibration
- No legacy 27,000-record backfill
- Existing canonical graph foreign keys remain ID-only; only new identity structures use composite ownership-safe relationships
- Applying unique owner keys to large production tables requires lock-duration preflight before any production approval

## Production boundary

This branch does not:

- connect to production
- apply migrations
- repair migration history
- backfill records
- attach source profiles
- merge candidates
- rewrite canonical fields
- activate contact vendors
- generate guessed emails
- perform outreach
- deploy to production

## Release recommendation

`READY FOR TECHNICAL REVIEW` only after TypeScript, deterministic fixtures, PostgreSQL replay, baseline, identity migration, and production build gates all pass.
