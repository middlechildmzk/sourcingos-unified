# SourcingOS RIG Research Vault — 2026-09-01

## Purpose
Canonical research handoff for the Recruiting Intelligence Graph (RIG) / Recruiter Brain work discussed on 2026-09-01.

This vault preserves:
- AI-team architecture recommendations from Gemini, Meta, Kimi, Perplexity, and Copilot.
- User-uploaded starter taxonomies, ontology files, O*NET/ESCO/Lightcast scripts, source-query builders, and recruiter-system prompts.
- The V33.11 / V34 lessons from the RHEL-admin regression.
- Claude's repository audit of `v34-search-quality-foundation` at `32b8445`.
- Accepted architectural decisions, rejected assumptions, and the V34 -> V35 sequencing plan.

## Core product thesis
SourcingOS should become a recruiter-grade intelligence system, not a Boolean generator or flat skills dictionary.

Canonical truth separation:
1. **Recruiter Intent** — what the recruiter explicitly asked for.
2. **Search / Ontology Inference** — aliases, adjacent titles, transferable concepts, query expansions, and source-selection logic used to discover people.
3. **Candidate Evidence** — what was actually observed about a person from permissible sources.

Search inference MUST NOT become candidate fact merely because a graph edge relates two concepts.

Example:
- Recruiter requests RHEL.
- RIG may expand discovery toward Linux, Red Hat, Ansible, Satellite, SELinux, RHCSA/RHCE, Bash, systemd.
- A candidate mentioning Ansible is not automatically a proven RHEL administrator.
- Clearance/citizenship/eligibility remain search context unless explicitly evidenced by an appropriate source.

## AI-team consensus
Across Gemini, Meta, Kimi, Perplexity, and Copilot, the common recommendation was:
- Build a typed role/title/skill/technology/certification/evidence graph.
- Normalize natural-language recruiter intent into role archetypes.
- Model how candidates actually describe themselves, including alternate titles and platform-specific vocabulary.
- Use platform-specific proof-of-work from GitHub, Stack Exchange, Hugging Face, research sources, portfolios, and later Kaggle where compliant/reliable.
- Use hybrid exact + semantic retrieval.
- Keep matching explainable and evidence-first.
- Learn from structured recruiter feedback.
- Maintain source/provenance/versioning.
- Separate direct evidence, inferred/transferable signals, gaps, and uncertainty.

## Important corrections / decisions
### Do not build a flat alias graph
Relationships need types, e.g.:
- EXACT_EQUIVALENT
- COMMON_MARKET_VARIANT
- IS_SUBTYPE_OF
- ADJACENT_ROLE
- TRANSFERABLE_FROM / TRANSFERABLE_TO
- REQUIRES
- PREFERS
- IMPLEMENTED_BY
- IMPLIES_FOR_SEARCH
- EVIDENCES
- WEAK_SIGNAL_FOR
- NOT_EQUIVALENT_TO
- CONFUSABLE_WITH
- DO_NOT_INFER_FROM
- LEGACY_ALIAS
- DISCOVERABLE_ON
- SEARCHED_AS

Similarity is not equivalence.

### Do not use universal source weights
A single formula such as 40% resume + 30% GitHub + 20% Stack Overflow is invalid across occupations.
Source usefulness is role-specific.

### Do not use prestige as candidate quality
Observable scope, scale, responsibility, technical complexity, regulatory context, and outcomes can be job-related evidence.
Company or school prestige must not become a hidden quality proxy.

### Do not auto-penalize career movement
Tenure patterns may be surfaced as context; they should not automatically down-rank candidates.

### Do not use universal 2-of-3 corroboration
Cross-platform corroboration can strengthen confidence where relevant, but many excellent candidates in cleared, infrastructure, clinical, GTM, and other fields will not have multiple public technical footprints.

### Do not auto-merge identities
Exact deterministic anchors can create high-confidence proposals.
Fuzzy/name/company/location/embedding similarity may propose a match only.
Recruiter confirmation remains the merge authority.

### Do not prematurely add Neo4j/Qdrant/Redis/Temporal
Use existing Postgres/Supabase first.
Typed edge tables and 1-3 hop joins are sufficient for the initial graph.
Defer pgvector until semantic retrieval has a demonstrated need.
Add specialized infrastructure only after profiling proves it is necessary.

### Do not prematurely implement RLHF
First collect clean, structured recruiter labels and use them for transparent calibration/rule/weight adjustments.
Do not create an autonomous reward/policy training loop without sufficient high-quality labels and safeguards.

## Seed data sources
### O*NET
Use current, versioned O*NET as broad occupation scaffolding.
Do not treat every numeric row as the same scale; preserve Scale ID, provenance, source version, and source fields.

### ESCO
Use as a multilingual occupation/skills graph and crosswalk source.
Import deterministic snapshots rather than relying on runtime network access.

### Lightcast
Potentially valuable, but treat as an optional licensed data source.
Do not assume commercially reusable production rights without a license.

### AI-team starter data
Use as `ai_team_seed`, not production truth.
Every seed relationship should receive:
- source
- source version
- relationship type
- confidence
- review status
- human-reviewed flag
- last validated date
- license/use notes

## Uploaded artifact caveats
### O*NET script
- Currently points at O*NET 30.2 in one AI-team artifact.
- Must be updated to the current version when the importer is implemented.
- Current `Data Value >= 3` logic needs scale-aware interpretation and provenance.

### ESCO/Lightcast join
- Described as fuzzy, but the supplied prototype effectively performs exact lowercased title joins.
- Does not yet constitute a robust occupation-skill crosswalk.
- Lightcast production use needs licensing review.

### GitHub signal builder
- Repository-oriented qualifiers cannot simply be treated as user-search semantics.
- Preferred recruiter workflow:
  artifact/repository discovery -> inspect meaningful authors/contributors/maintainers -> public person profile -> Candidate Graph.

### Stack Exchange builder
Prefer official tag/person evidence endpoints where available:
- tag synonyms / related tags
- top answerers
- user tag activity
- user top-answer tags
- answer quality/recency

## Source-specific evidence philosophy
### GitHub
Strong:
- recent original/substantive repositories
- meaningful contributions
- dependency/configuration artifacts
- tests, CI/CD, Docker/Kubernetes/Terraform
- maintainership/review activity where attributable

Weak/noisy:
- stars alone
- forks without substantive changes
- raw commit count
- language bytes alone
- tutorial-only repos

### Stack Exchange
Strong:
- sustained target-tag answer depth
- accepted/high-quality answers
- relevant troubleshooting expertise
- recency

Weak/noisy:
- reputation without tag relevance
- one question
- stale unrelated activity

### Hugging Face
Strong:
- owned/contributed models/datasets/Spaces
- model cards, evaluations, documentation
- relevant task/library metadata
- meaningful version/contribution history

Weak/noisy:
- likes/follows
- downloads alone
- generic profile claims

### Kaggle
Use later unless a compliant, stable candidate-discovery path is available.
Do not introduce fragile browser automation merely to claim support.

## False-positive shield examples
- ML Engineer: ChatGPT use or one ML course does not prove ML engineering.
- Data Engineer: dashboards/Excel/reporting alone do not prove data engineering.
- DevOps Engineer: generic delivery work does not prove IaC/cloud/CI/CD/operations/reliability.
- Kubernetes: Docker does not prove Kubernetes.
- Security Engineer: GRC-only work does not prove hands-on security engineering.
- Full Stack Engineer: generic SWE title does not prove equal frontend/backend depth.
- Recruiting Sourcing: coordination does not prove Boolean/passive sourcing/talent mapping.
- Senior/Staff/Principal: infer only from job-related scope/outcomes/influence/architecture context, not title alone.
- Certifications: supplemental evidence, not demonstrated experience.
- GitHub metrics: context, not proficiency/seniority proof.

## RHEL golden contract
Input:
`RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with a Secret security clearance or higher`

Expected:
- Primary archetype: Linux/RHEL Systems Administrator.
- RHEL/Linux mandatory.
- 5+ years relevant experience preserved.
- Location normalized to Annapolis Junction, MD.
- Secret or higher preserved as a search/eligibility constraint.
- Candidate vocabulary may include Linux Administrator, Linux Systems Administrator, RHEL Administrator, Red Hat Systems Administrator, Linux Systems Engineer, Unix/Linux Administrator.
- Discovery concepts may include Red Hat Enterprise Linux, RHCE, RHCSA, Red Hat Satellite, Ansible, SELinux, systemd, Bash.
- Discovery concepts must not automatically become candidate facts.
- TS/SCI must never map to TypeScript.
- Infrastructure-oriented Stack Exchange + GitHub/public/recruiter-authorized sources should outrank irrelevant DEV/Hugging Face execution.
- Candidate without observed Linux/RHEL admin evidence should not be promoted to strong first review.
- Clearance remains unverified until properly evidenced.

## Claude repository audit — 2026-09-01
Claude cloned and audited `v34-search-quality-foundation` at `32b8445` with `main` at V33.11 `4a308d6`.

Key conclusions:
1. RIG is a **consolidation problem**, not greenfield.
2. Role/title/source knowledge is already distributed across seven places.
3. `lib/domain-packs-v31.ts` and `lib/job-family-router-v34.ts` are near-duplicate regex classifiers over RoleIntake and source surfaces.
4. Adding RIG without retiring/consolidating them would create an eighth classifier and reduce explainability.
5. Existing role knowledge is hardcoded regex/TS with no versioning, provenance, or review flags.
6. Existing Golden Role fixture primarily asserts parsing; the fixture shape needs to expand before merely increasing case count.
7. The unmerged V29.3A0 ledger work means `isLedgerReplaySafe` is not available on this branch/main.
8. Postgres typed edge tables are recommended; Neo4j not needed; pgvector deferred because expected graph traversal is only 1-3 hops.

## Decisions for Claude's three calls
### 1. Retiring domain-packs and job-family-router into RIG
**YES, in scope — but not as a big-bang deletion.**
RIG should become the canonical intelligence layer.
Existing classifiers should move behind compatibility adapters during transition.
Require equivalence/regression tests before deleting old implementations.

### 2. Classifier call-site trace as Slice 0
**YES. Mandatory.**
Before schema/code:
- enumerate every classifier / role-normalizer / source-router / title-expander / requirement mapper
- list all call sites
- identify duplicate responsibility
- identify current production source of truth for each decision
- map each one to its eventual RIG replacement
- identify behavior that must remain temporarily as an adapter
This prevents an eighth intelligence layer.

### 3. Ledger gate and new tables
**The missing ledger helper should block production merge/deployment of new persistent RIG tables, but should NOT block design or branch implementation.**

Proceed with:
- ADR
- schema design
- migrations on an isolated review branch
- RLS/owner-scope tests
- local Postgres migration smoke
- repository integration tests

Before merging new tables to production:
- either land the missing ledger/replay-safety prerequisite, OR
- implement an equivalent owner-scoped, replay-safe, idempotent migration/write contract specific to RIG and prove it in CI.

Do not weaken RLS or bypass the safety gate just to unblock V35.

## V34 -> V35 sequencing
### V34
Finish:
- search correctness
- adaptive source routing
- Golden Role / Golden Candidate foundations
- evidence-aware admission
- contact identity readiness
- Candidate 360 profile/contact fusion
- atomic recruiter-confirmed identity fusion

### V35.0
- Slice 0 classifier/call-site inventory
- Architecture Decision Record
- typed/versioned ontology schema
- provenance + review-state model
- compatibility adapter strategy
- Role Intelligence Packet builder
- ~12-15 deeply reviewed archetypes

### V35.1
- current O*NET importer
- ESCO importer/crosswalk
- staging -> normalized snapshot pipeline
- licensing/provenance manifests
- deterministic taxonomy release tooling

### V35.2
- candidate vocabulary/title graph
- typed aliases/adjacency/confusables
- acronym/context disambiguation
- false-positive shield

### V35.3
- source-specific evidence/query graph
- GitHub
- Stack Exchange
- Hugging Face
- existing SourcingOS research/registry sources

### V35.4
- hybrid sparse/semantic retrieval where justified
- transparent reranking
- structured recruiter feedback learning
- evaluation dashboards/release gates

## Golden evaluation expansion
Extend the fixture shape first.
A complete Golden case should eventually assert:
- recruiter-intent preservation
- canonical role/family
- title expansion
- confusable-term safety
- source-routing expectations
- forbidden/irrelevant source execution
- candidate-evidence classification
- first-review admission/withholding
- hard-gap/unknown behavior
- explanation output
- clearance/eligibility truth boundary
- taxonomy/rule version provenance

Then grow to 40-60, 100, and eventually hundreds of role scenarios.

## Candidate 360 target
A fused canonical person should expose:
- canonical identity
- source identities
- current role/history
- observed skills
- direct evidence
- inferred/adjacent capabilities explicitly labeled
- missing evidence
- contradictions
- source provenance
- artifact links
- public/enrichment contact signals
- identity review status
- role-specific explanation
- freshness/source authority metadata

Never silently merge.
Never guess LinkedIn/email/profile identity.

## Long-term moat
The defensible asset is not a static 30,000-skill list.

It is:
Public taxonomy foundation
+ recruiter-curated candidate vocabulary
+ typed relationship semantics
+ source-specific evidence rules
+ false-positive knowledge
+ role-specific source strategy
+ structured recruiter corrections
+ versioned/provenance-aware evaluation.

SourcingOS should know the difference between:
- a job title
- a search expansion
- an adjacent capability
- a public artifact
- an inferred signal
- direct observed evidence
- an eligibility constraint
- a verified fact
and show its work.
