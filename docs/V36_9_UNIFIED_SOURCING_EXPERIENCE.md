# V36.9 — Unified Sourcing Experience

Status: product direction locked while V36.8 Candidate Data Fabric is completed.

## Product thesis

SourcingOS should replace the recruiter's fragmented 20–30-site sourcing workflow with one transparent control surface over many independent data and evidence systems.

The product is not a claim that SourcingOS owns a multi-billion-person canonical database. The product advantage is that SourcingOS can search many professional/public universes, measure incremental contribution, reconcile duplicate identities, preserve provenance, and present one recruiter-reviewable Candidate 360.

## Primary recruiter experiences

### 1. Universal People Search

A first-class traditional people-search surface must coexist with agentic sourcing. It accepts progressively stronger identity/search anchors:

- first and last name
- name + current/past company
- name + location
- title / skills / seniority / experience / geography
- professional email
- professional phone where a recruiting-permitted provider supports lookup
- LinkedIn URL
- GitHub URL
- Stack Overflow or other professional profile URL
- arbitrary free text

More supplied anchors should narrow identity resolution rather than merely adding ranking weight.

### 2. Agentic Sourcing

Natural-language role intent is parsed by Role Brain into recruiter-visible requirements, discovery expansions, geography, clearance breadcrumbs, and search hypotheses. SourcingOS should then run eligible public connectors and configured professional-data providers in parallel, not make the recruiter choose a database first.

### 3. Candidate 360 / Identity Graph

Search results from providers are observations, not canonical people and not qualification truth. SourcingOS should reconcile observations using deterministic anchors and recruiter-reviewable identity proposals. No silent cross-provider identity merge.

### 4. Contact Resolution

Contact discovery is explicit and separate from search. The contact fabric should run a bounded stop-on-success waterfall ordered by expected cost, confidence, and provider-specific success for the current use case. Ownership, deliverability, and outreach permission remain separate dimensions.

### 5. Browser Extension

After web search + Candidate Graph are stable, Chrome Extension V2 becomes a thin SourcingOS client:

- resolve person on current page
- show Candidate 360
- find contact info
- find additional professional/public profiles
- show existing project/history context
- save candidate to project / role review queue
- find similar candidates
- draft outreach without auto-send

The extension should request scoped/optional host permissions and avoid making unauthorized site automation the foundation of the product.

## Source architecture

### Professional candidate universe

Current executable fabric when credentials are present:

- Pearch
- People Data Labs
- Coresignal
- DataVertex
- ContactOut
- SignalHire
- LinkUpAPI
- Exa People

Next / queued after the core experience is stable:

- Apollo (search → explicit identity enrichment before Candidate Graph)
- Lusha
- CompanyEnrich
- Crustdata
- ZoomInfo subject to commercial access

### Public-web / professional evidence universe

Keep public artifact sources first-class and reverse-resolve artifact owners into people when possible:

- GitHub
- Stack Exchange / Stack Overflow
- DEV
- Hugging Face
- ORCID
- OpenAlex
- PubMed
- arXiv
- package registries and other existing SourcingOS connectors
- Exa public-web retrieval
- OpenWeb Ninja person-grounded corroboration
- Perplexity People / cited web locator lane
- future agent-web layers such as OpenAI / Claude web search as locator/research surfaces, not proprietary people databases

### Identity corroboration only

- Pipl
- OSINT Industries and similar OSINT systems

These may strengthen an already-grounded professional identity. They must not introduce consumer/background attributes into candidate qualification or ranking.

### Contact fabric

Current lanes include:

- AnyMail Finder
- Hunter
- Tomba
- SignalHire
- People Data Labs
- DataVertex

Queued: Apollo/Lusha/Snov/CompanyEnrich/ZoomInfo as contracts and economics justify them.

### Sources excluded from employment suitability

- EnformionGO / Endato: current provider restrictions make employment-suitability use incompatible with SourcingOS recruiting.
- TruePeopleSearch / generic consumer people-search sources: excluded unless a current first-party recruiting-permitted API/data contract is established.

Sensitive consumer/public-record attributes such as age, relatives, criminal records, divorce records, property records, partial DOB, etc. do not enter candidate matching/qualification logic.

## Unified execution model

A role search should ultimately execute as one orchestration pass:

1. Role Brain produces structured requirements and approved discovery expansions.
2. Source router selects eligible public + professional provider lanes.
3. All selected providers execute before the global result cap.
4. Results are normalized as observations with provider/source provenance.
5. Within-source exact duplicates are suppressed.
6. Cross-source identity is proposed, never silently merged.
7. Candidate evidence and missing requirements are evaluated separately from provider retrieval scores.
8. Source-diverse candidates enter recruiter review.
9. Contact enrichment occurs only on explicit recruiter action or an explicitly approved workflow step.
10. Recruiter decisions calibrate the next search without becoming autonomous rejection/selection logic.

## Metrics that matter

Do not sum vendor marketing database counts into a unique-human claim. Measure actual search behavior instead:

- raw discoveries per provider/source
- retained results per provider/source
- incremental unique contribution
- overlap rate
- canonical people after identity resolution
- review-ready candidates
- mandatory-requirement evidence coverage
- false-withhold / false-narrowing rate
- contact-resolution success rate
- cost per unique review-ready candidate
- latency per provider
- freshness / source availability

The source stack should eventually adapt by role/domain based on these metrics.

## Immediate completion sequence

1. Ship Universal People Search inside the private Candidate Search workbench.
2. Bridge configured provider observations into the visible role sourcing/review flow.
3. Make provider/public search feel like one run while preserving source truth.
4. Add signed provider-save → Candidate Graph → role queue flow.
5. Surface provider execution, contribution, overlap and contact-availability telemetry.
6. Add explicit contact lookup from result cards / Candidate 360.
7. Polish responsive layout and loading/empty/error states.
8. Verify current credentials and preview runtime behavior.
9. Merge/deploy only after full CI + preview validation.

## Non-negotiable trust boundaries

- provider retrieval score != qualification score
- provider observation != verified fact
- search requirement != candidate evidence
- contact ownership != deliverability != permission
- no autonomous rejection
- no autonomous outreach
- no silent identity merge
- no fake source execution
- no consumer/background-record suitability scoring
