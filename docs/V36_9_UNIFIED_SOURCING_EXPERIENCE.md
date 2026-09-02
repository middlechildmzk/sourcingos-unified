# V36.9 — Unified Sourcing Experience

Status: implementation release candidate on `v36-8-candidate-data-fabric`; production remains untouched pending authenticated provider runtime testing and recruiter preview acceptance.

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

Candidate Search now presents two explicit source scopes instead of visually stacking them into one ambiguous mobile flow:

- **Talent Universe** — configured external professional-data providers only.
- **My Database / Workbench** — imported LinkedIn connections, saved Candidate Graph records, resumes/CSV, and the existing local workbench.

Imported records are never presented as if they were external provider discoveries. When zero professional providers are executable, the Talent Universe surface says so explicitly and does not silently fall back to imported candidates.

### 2. Agentic Sourcing

Natural-language role intent is parsed by Role Brain into recruiter-visible requirements, discovery expansions, geography, clearance breadcrumbs, and search hypotheses. SourcingOS then runs eligible public connectors and configured professional-data providers in parallel, rather than making the recruiter choose a database first.

### 3. Candidate 360 / Identity Graph

Search results from providers are observations, not canonical people and not qualification truth. SourcingOS reconciles observations using deterministic anchors and recruiter-reviewable identity proposals. No silent cross-provider identity merge.

### 4. Contact Resolution

Contact discovery is explicit and separate from search. The contact fabric runs a bounded stop-on-success waterfall ordered by expected cost, confidence, and provider-specific success for the current use case. Ownership, deliverability, and outreach permission remain separate dimensions.

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

A role search executes as one orchestration pass:

1. Role Brain produces structured requirements and approved discovery expansions.
2. Source router selects eligible public + professional provider lanes.
3. All selected providers execute before the global result cap.
4. Results are normalized as observations with provider/source provenance.
5. Within-source exact duplicates are suppressed.
6. Cross-source identity is proposed, never silently merged.
7. Candidate evidence and missing requirements are evaluated separately from provider retrieval scores.
8. Source-diverse candidates enter recruiter review only after explicit save.
9. Contact enrichment occurs only on explicit recruiter action or an explicitly approved workflow step.
10. Recruiter decisions calibrate the next search without becoming autonomous rejection/selection logic.

## Natural-language search interpretation

The universal search box is a recruiter control surface, not direct vendor query syntax. For broad professional free text, SourcingOS now deterministically extracts only bounded search structure that providers can safely consume:

- role/title phrase
- explicit city/state geography
- explicitly named technical skills
- years-of-experience floor
- clearance requirement
- explicitly entered company/title/location/skill fields

Example:

`Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher`

is represented for structured provider lanes with:

- title: `RHEL admin`
- location: `Annapolis Junction, MD`
- skill/search term: `RHEL`
- hard requirement: `5+ years relevant experience`
- hard requirement: `Secret clearance or higher`

Free-text alternatives remain alternatives/search-expansion terms rather than becoming accidental AND constraints. For example, `cloud engineer with AWS or Azure` may search both technologies, but neither inferred term becomes an independent hard must-have unless the recruiter explicitly marks it required or it is part of the role phrase. Explicit structured Must Haves remain authoritative.

## Why a candidate appeared

Provider-native retrieval explanations are supplemented by a SourcingOS transparency layer derived only from normalized provider-observed fields and recruiter search criteria. Result cards can state:

- observed title overlap
- observed skill overlap
- observed location overlap
- must-have requirements not verified in the normalized provider observation

This is explanation, not qualification scoring. If the provider returns a record with no direct normalized title/skill/location overlap, SourcingOS says that explicitly instead of manufacturing a match reason.

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

## V36.9 implementation state

Implemented and regression-covered:

1. Universal People Search in the private Candidate Search workbench.
2. Explicit **Talent Universe** vs **My Database / Workbench** source scopes.
3. Provider-readiness banner with an explicit zero-provider state and no silent fallback to imports.
4. Configured provider observations bridged into visible Agentic Sourcing.
5. Public + professional provider fan-out in one recruiter action while preserving provenance.
6. Signed provider-save → Candidate Graph → duplicate-safe role queue.
7. Provider execution/contribution/contact-availability telemetry.
8. Explicit contact lookup from provider result cards / Candidate 360 path.
9. Responsive Candidate Search polish.
10. Structured natural-language extraction for provider lanes that require fields.
11. Evidence-safe “why this candidate appeared” analysis.
12. Alternative free-text skills remain soft instead of being converted into accidental hard AND requirements.

Current code gate at commit `60fab910da52185ee5722b1452d1a54d2f80e189`: GitHub CI #910 passed TypeScript, **919/919 deterministic tests across 320 suites**, dependency audit capture, production Next.js build, and atomic role/Postgres migration smoke.

## Remaining runtime gate

The remaining blocker is runtime/infrastructure, not an unimplemented search flow:

1. Add at least one professional candidate-provider credential to the authenticated Vercel Preview environment; ideally begin with several independent providers for overlap testing.
2. After Vercel's current Hobby build-rate limit resets, create a fresh preview from the exact branch head.
3. Confirm `/api/candidate-data/status` reports the actual executable provider set without exposing secrets.
4. Run the flagship RHEL / Annapolis Junction / Secret+ search and confirm `/api/candidate-data/search` executes.
5. Verify results include external people not already present in imported LinkedIn/Candidate Database records.
6. Inspect provider telemetry and “why this record is here” explanations.
7. Save a provider observation into Candidate 360 and verify duplicate-safe role linking.
8. Run explicit work-contact resolution and verify no automatic outreach.
9. Run Agentic Sourcing and confirm public + configured provider fan-out.
10. Re-check desktop and narrow/mobile rendering.
11. Merge/deploy production only after explicit recruiter approval.

Vercel is currently returning `Deployment rate limited — retry in 24 hours` for new preview builds. The last READY preview predates the source-scope/readiness/search-interpretation/match-explanation polish above, so it must not be represented as the exact current release candidate.

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
