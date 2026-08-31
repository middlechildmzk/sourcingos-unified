# Technical Talent Graph (V33.3)

Status: additive infrastructure. GitHub V2 and Stack Overflow V2 are implemented behind reusable library contracts; this document does **not** imply that V2 is the recruiter-facing production route yet.

The Technical Talent Graph gives SourcingOS a common way to discover technical people, preserve public work as evidence, extract identity anchors, and feed the existing Candidate Graph / Identity Brain without turning role search terms into candidate facts.

Permanent product rule:

> **Autonomous research. Human hiring decisions.**

## 1. Why this layer exists

Technical recruiting sources expose fundamentally different records: repositories, contribution histories, Q&A, packages, models, datasets, publications, and profiles. If every connector invents its own candidate schema, SourcingOS eventually accumulates disconnected source-specific products instead of one talent graph.

V33.3A establishes one connector contract that future sources can implement while keeping four concerns separate:

1. retrieval intent — what the recruiter asked SourcingOS to search for;
2. observed source records — what a public API actually returned for a person;
3. evidence / technical artifacts — the public work that supports a statement;
4. identity anchors — public signals that may connect profiles across sources.

## 2. The source-truth boundary

Search criteria are retrieval instructions, never candidate evidence.

A role may ask for `Kubernetes`, `Terraform`, and `AWS`. Those terms may decide which API queries SourcingOS sends. They may not populate a candidate's technologies unless the candidate's own source records independently support them.

### Layer 1 — the type system

`RetrievalTerm` is a branded string. `DiscoveryIntent` stores retrieval-only values as `RetrievalTerm` objects.

An `ObservedTechnology` cannot be constructed from a string alone. It requires `ObservationProvenance`, including:

- source;
- source field;
- source record or artifact ID;
- evidence basis;
- observed timestamp;
- URL where available.

There is intentionally no helper that converts `RetrievalTerm` to `ObservedTechnology`.

### Layer 2 — the function signature

`buildGitHubDossier()` and `buildStackOverflowDossier()` are pure dossier builders. They do not accept a `DiscoveryIntent`.

That means the stage responsible for creating person-level evidence has no direct channel through which it can read the role query.

Discovery functions may read retrieval intent to formulate source queries. Dossier builders may only read source-returned data.

### Layer 3 — the runtime guard

TypeScript cannot protect against every untyped API payload or unsafe cast. `findRetrievalLeaks()` therefore checks constructed dossiers for provenance violations.

A requested term is allowed to appear as evidence when the source independently supports it. For example, searching `kubernetes` and then observing a candidate-owned repository topic `kubernetes` is valid.

The invalid state is a requested technology whose only provenance is the search request itself.

`enforceRetrievalBoundary()` removes such evidence rather than silently accepting it.

### Unknown means unknown

Absence of public evidence is not a negative candidate signal.

Each dossier has explicit `limits`, and the SourceResult bridge emits those as low-confidence "Not established by [source]" evidence items. GitHub, for example, cannot establish verified employment history, seniority, private technical work, or clearance.

## 3. Module map

`lib/connectors/contract-v33-3.ts`
: Canonical connector, dossier, technical artifact, evidence provenance, identity anchor, telemetry, and retrieval-boundary types.

`lib/connectors/request-ledger-v33-3.ts`
: Bounded in-process cache, in-flight dedupe, request budgeting, bounded concurrency, quota/backoff accounting, and partial-result handling.

`lib/connectors/github-v2.ts`
: GitHub V2 dossier builder plus official REST/GraphQL discovery/enrichment orchestration.

`lib/connectors/stackoverflow-v2.ts`
: Stack Overflow V2 tag planning, multi-strategy discovery, vectorized enrichment, dossier building, quota/backoff reporting.

`lib/connectors/source-truth-v33-3.ts`
: Runtime retrieval-leak detection/enforcement and the `TechnicalDossier -> SourceResult` bridge.

`lib/connectors/identity-anchors-v33-3.ts`
: Read-only cross-source identity assessment. It can explain deterministic anchors, supporting similarities, and conflicts. It cannot merge records.

`lib/connectors/source-quality-v33-3.ts`
: Source telemetry and evaluation summaries. Recruiter labels remain null until real recruiter decisions exist.

## 4. Evidence semantics

Evidence basis values are deliberately explicit:

- `observed_artifact` — read directly from a public artifact;
- `source_stated` — stated by the source account holder;
- `derived_from_source` — computed from source-returned records;
- `model_inference` — an inference, which must never silently become source fact.

`observedTechnology()` rejects model inference.

### Artifact relationships stay distinct

The technical artifact model distinguishes:

- `owner_maintainer`;
- `substantial_contributor`;
- `activity_participant`;
- `author`;
- `unknown`.

Owning a fork is not original authorship. Appearing in a repository activity history is not maintenance. A public answer is community evidence, not employment evidence.

### Trivial artifacts do not prove skills

GitHub artifacts can exist without being strong enough to support a person-level technology claim. Fork-only activity, empty/trivial repositories, and unsupported metadata remain visible artifacts without automatically promoting a technology to the candidate.

### Source metrics are not normalized

GitHub stars and Stack Overflow answer score are different source-native concepts. They remain labeled source metrics; V33.3A does not combine them into a universal technical-quality score.

## 5. GitHub V2

### API responsibility split

GitHub V2 uses official APIs only.

GraphQL is preferred for authenticated dossier enrichment because one connected query can retrieve profile data, social accounts, public organizations, repositories, languages/topics, and contribution collections.

REST remains useful for repository discovery, contributor lists, profile fallback, and unauthenticated public data.

### Without a credential

The REST fallback can still return a useful public dossier, but contribution volume is treated as **unknown**, not zero. The dossier explicitly records the limitation.

Production orchestration should use credential-aware request budgets. Do not spend an unauthenticated hourly budget as though it were an authenticated budget.

### Dossier contents

The GitHub dossier can represent:

- source profile identity;
- public profile fields;
- public personal website/email when exposed;
- original repositories and fork state;
- description, topics, languages, stars/forks, timestamps;
- contribution artifacts where the API exposes them;
- active years / recency;
- deterministic identity anchors;
- explicit source limitations.

Person-level technologies roll up only from observable candidate artifacts. Retrieval terms are never copied into the dossier.

### Contribution threshold

`SUBSTANTIAL_CONTRIBUTION_THRESHOLD = 10` is an exported implementation threshold used to distinguish `substantial_contributor` from `activity_participant` for contribution-count artifacts.

It is **not validated as a recruiting-quality threshold** and must not be surfaced as a consequential recruiter-facing judgement until calibrated against labeled review data.

## 6. Stack Overflow V2

### Tag planning

Recruiter language is mapped conservatively into Stack Overflow tag language (`aws -> amazon-web-services`, `k8s -> kubernetes`, etc.). Unmapped terms can still be attempted, but the API remains the source of truth.

### Discovery strategies

One role can generate several concrete strategies:

- all-time top answerers for primary tags;
- recent top answerers for leading tags;
- validation across additional role-relevant tags.

This is intentionally different from issuing one generic keyword query.

### Request efficiency

After discovery, vectorized Stack Exchange routes are used where available so multiple user IDs can be enriched in a small number of calls rather than N calls per person.

### Quota and backoff

Stack Exchange responses expose quota state and can include a `backoff` instruction. The connector records both in the request ledger. A source-requested backoff is not silently ignored.

### Evidence wording

Good evidence wording describes what the source observed:

> Stack Exchange returned this account among the top answerers for [kubernetes] over the all-time window.

It must not mutate that into unsupported claims such as "Kubernetes expert with eight years of experience."

## 7. Identity anchors

Identity resolution remains proposal-only across sources.

Deterministic/strong anchors can include:

- exact public email;
- same personal domain;
- explicit cross-profile link;
- GitHub account pointer;
- ORCID.

Supporting similarities include:

- display name;
- stated city/location;
- stated organization;
- technical overlap.

Conflicts include different public emails/domains or materially contradictory public profile context.

A deterministic anchor can justify asking the recruiter whether two profiles are one person. It does **not** grant automatic merge permission.

### Shared hosts are not personal domains

`github.com`, `linkedin.com`, `stackoverflow.com`, `github.io`, and other shared platforms are explicitly excluded from personal-domain treatment. Otherwise unrelated people would appear to share deterministic anchors merely because they use the same platform.

### Worked cases

Case A — GitHub Jane Smith publishes `jane.dev`; Stack Overflow Jane Smith publishes `jane.dev/about`.

Expected: deterministic shared-domain anchor; recruiter identity-review proposal; no automatic merge.

Case B — GitHub Alex Kim publishes `alexcloud.dev` in Seattle; Stack Overflow Alex Kim publishes `alexdata.ai` in Boston.

Expected: shared name is supporting only; domain/location conflicts remain visible; no deterministic proposal.

## 8. Request accounting and source quality

Every connector run can report:

- requests attempted;
- cache hits;
- deduplicated requests;
- API errors;
- quota remaining;
- source-requested backoff;
- people discovered/enriched;
- artifacts observed;
- identity anchors produced;
- partial-success state;
- duration.

Source-quality summaries can then measure:

- duplicate rate;
- evidence coverage;
- identity-anchor yield;
- unsupported-claim count;
- artifacts per person;
- API calls per useful candidate;
- cache hit rate;
- source errors/latency.

Recruiter acceptance remains `null` until real review labels exist. New/unreviewed candidates are never silently treated as rejected ground truth.

## 9. Adding a connector

A future connector such as Hugging Face should:

1. declare `ConnectorMetadata` and honest capabilities;
2. accept `DiscoveryIntent` only in the retrieval layer;
3. normalize a source person and stable source ID;
4. model source-native technical artifacts;
5. construct `ObservedTechnology` only with source provenance;
6. extract deterministic/supporting identity anchors;
7. record source limits explicitly;
8. use the request ledger for cache/budget/backoff telemetry;
9. run `enforceRetrievalBoundary()` before a dossier enters the canonical `SourceResult` path;
10. add deterministic fixtures covering contamination, non-person records, identity collisions, provenance, partial failures, and no-auto-merge behavior.

### Declaring capability honestly

A source may be strong for enrichment but weak for discovery, or strong for identity but weak for candidate breadth. Connector metadata should say so instead of making every source look equivalent.

Credential status also matters operationally. A follow-up should replace the binary `requiresCredential` field with an access-state model such as `not_required | recommended | required_in_practice`, because some public APIs technically run anonymously but are not operationally useful without authentication.

## 10. Regression gates

V33.3A fixtures cover the product-critical cases:

- Case A: shared personal-domain anchor creates review proposal, never merge;
- Case B: common-name collision remains separate;
- Case C: Kubernetes/Terraform/AWS role query does not contaminate a Go/PostgreSQL candidate;
- Case D: Stack Overflow tags returned for that person can become source-backed evidence;
- Case E: organization account cannot become a human candidate;
- fork-only GitHub activity does not become original-work technology evidence;
- evidence retains artifact URL/timestamp/provenance;
- no opaque candidate fit score;
- no auto-reject, auto-shortlist, or outreach action;
- source-quality telemetry does not manufacture recruiter labels;
- request cache/dedupe/budget/concurrency behavior remains deterministic.

One important integration test runs Case A through the existing `compareSourceProfiles` Identity Brain after `dossierToSourceResult()`. This ensures Technical Talent Graph feeds the canonical identity system rather than building a second merger.

## 11. Known limitations

- V33.3A is initially library infrastructure and is not automatically the production Agentic Search route.
- Live API behavior still needs exact-environment validation before V2 replaces V33.2 connector paths.
- The substantial-contribution threshold is unvalidated.
- In-process cache is intentionally not durable across serverless instances.
- Most private professional work is absent from public developer sources.
- Stack Overflow evidence is community activity, not employment-duration evidence.
- GitHub self-stated company/location are not verified employment facts.

## 12. Integration notes for V33.3B

V33.3B owns the recruiter-facing Agent → Review Slate workflow. It should consume Technical Talent Graph through the canonical source contract rather than importing source-specific UI logic.

Recommended integration sequence:

1. create credential-aware request ledgers;
2. convert the role/search hypothesis into a `DiscoveryIntent`;
3. execute GitHub V2 / Stack Overflow V2;
4. run `enforceRetrievalBoundary()`;
5. convert dossiers via `dossierToSourceResult()`;
6. allow the existing Agent Review Slate to accumulate/dedupe source records;
7. persist only after the recruiter's explicit `Create review slate` action;
8. reuse exact same-source identities;
9. route deterministic cross-source anchors through the existing Identity Brain;
10. measure the V2 source contribution against the existing retrieval evaluation harness.

Do not remove the V33.2 connector path until live V2 validation demonstrates equal or better reliability and source truth.

## 13. Next source sequence

The reusable connector contract is designed for additional technical sources. The current working sequence is:

1. repair / harden OpenAlex access handling;
2. Hugging Face V2;
3. DEV / Forem identity + technical-writing enrichment;
4. GitLab after credential/access economics justify the implementation;
5. additional research/patent/package sources based on measured contribution.

The priority is not source count. It is **unique, source-backed candidate intelligence that improves the same canonical person without weakening provenance or identity safety.**
