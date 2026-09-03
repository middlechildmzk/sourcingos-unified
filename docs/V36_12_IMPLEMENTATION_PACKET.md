# V36.12 Implementation Packet — Search Truth, Contact Intelligence, Source Health

Branch: `v36-12-search-truth-contact-intelligence`
Base: `df50dc9e414854ece87aba17dc538c1c353d152c` (`v36-10-candidate-graph-identity-db`)

This packet is based on real Preview runtime testing on 3 September 2026, not static connector presence alone. Preserve all standing SourcingOS trust boundaries: no automatic cross-source identity merge, no auto-shortlist/reject/contact, provider retrieval is not qualification, contact ownership/deliverability is not permission, clearance mentions remain unverified unless explicitly verified, and public/provider observations retain provenance.

## 1. Runtime facts from the live test

### RHEL / Annapolis Junction test
Query:
`Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher`

Preview showed 7 executable search providers, but only 2 contributed returned observations:
- Pearch: completed, 5 discoveries
- Exa: completed, 30 discoveries
- PDL: provider returned 404/no records matching query
- Coresignal: completed, 0
- ContactOut: completed, 0
- SignalHire: completed/skipped with 0 depending structured filters
- LinkUp: 401
- DataVertex key missing in the tested Preview
- OpenWeb Ninja key missing / non-executable person search

Global result cap retained 30 observations from 35 discoveries. This proves orchestration executes, but also proves `executable` is not the same as `healthy`, `yielding`, or `contributing`.

### Dan Larson / Maximus test
Query:
`Dan Larson maximus`

Preview returned 30 Exa observations, including the intended `Dan L.` record at Maximus, but many other Dan/Maximus records. PDL returned no match, LinkUp returned 401, SignalHire search skipped because the Universal People Search person query did not produce a supported structured search filter. Exa was the only contributing provider.

The user saved the intended Exa observation into Candidate 360 and clicked the contact action. AnyMailFinder found a high-confidence work-email signal (`dan.larson@maximus.com`). Candidate 360 persisted and displayed that work-email signal correctly as unverified / permission unknown.

However the flow did not continue to search for a personal email or phone/cell number. This is a product/code behavior, not proof that no provider has those channels.

## 2. Immediate defects / gaps exposed by the runtime test

### P0-A — Universal People Search does not structure person-name anchors through the API route
`CandidateDataSearchRequestV36_8` already has optional `names?: string[]`, but `/api/candidate-data/search` does not accept or forward `names`. `UniversalPeopleProviderRequestV36_9` also does not emit names.

For `Dan Larson maximus`, PDL's local fallback `simplePersonName(request.query)` can interpret all three tokens as the full name (`dan larson maximus`) instead of `Dan Larson` plus employer/context. This materially weakens exact-person lookup.

Build:
1. Add `names` to Universal People Search provider request type.
2. Add `names` to `/api/candidate-data/search` Zod schema and forward into orchestrator.
3. Add a conservative person-name parser for `person_lookup` queries. The raw query must remain available to semantic providers.
4. Add explicit `companies?: string[]` to `CandidateDataSearchRequestV36_8`, Universal request, route schema and orchestrator input.
5. Support clear forms first: `Dan Larson at Maximus`, `Dan Larson, Maximus`, and explicit Company filter.
6. For ambiguous compact form `Dan Larson maximus`, use a soft company/context heuristic rather than making the third token merge/identity authority. Search must remain recoverable if the heuristic is wrong.
7. PDL should use name as strong structured search input and company as a professional search filter; company never becomes identity authority.
8. LinkUp official People Search supports `current_company`; wire `companies[0]` to that field.
9. Do not invent undocumented name/company fields for other providers. Preserve raw query for Exa/Coresignal/Pearch semantic lanes where appropriate.

Acceptance:
- `Dan Larson` -> `names=['Dan Larson']`
- `Dan Larson at Maximus` -> `names=['Dan Larson']`, `companies=['Maximus']`
- `Dan Larson, Maximus` -> same
- `Dan Larson maximus` -> provider fan-out still runs; PDL must not search for full_name=`dan larson maximus`.
- RHEL flagship parsing remains unchanged.

### P0-B — Contact lookup is not a comprehensive contact-resolution workflow
Universal People Search currently exposes `Find work contact`, which calls only `purpose='work_email_finder'`.

The contact orchestrator stops when one provider returns any signal. In the live test AnyMailFinder found a work email, so the flow stopped before phone/personal-email-capable lanes could run. The UI therefore cannot be interpreted as `we searched everything and no cell/personal email exists`.

Build an explicit goal-aware Contact Resolution flow:
- button copy: `Find contact info` (or separate `Find work email`, `Find phone`, `Find more` actions if clearer)
- requested channel goals are explicit: work email, personal email if provider explicitly labels one, phone/mobile if provider returns one
- local Candidate Graph/cache first ($0)
- do not call a provider twice for the same candidate/purpose if a fresh usable observation already exists
- continue only for still-missing requested channel types
- stop when requested goals are satisfied, provider budget is exhausted, or eligible providers are exhausted
- preserve attempt telemetry, latency and estimated credits
- never auto-send outreach
- never treat deliverability as permission

A clean implementation can either add a `contact_bundle` purpose or generalize the existing orchestrator to accept goal predicates and aggregate unique signals across attempts. Prefer the least invasive design that is deterministic/testable.

### P0-C — Contact signal schema cannot distinguish work vs personal email or mobile vs other phone
Current `ContactSignal` has only `type: email|phone|...`.

Add an optional normalized channel subtype, e.g.:
- `work_email`
- `personal_email`
- `other_email`
- `mobile_phone`
- `work_phone`
- `home_phone`
- `other_phone`
- `professional_profile`
- `social_profile`
- `company_domain`
- `unknown`

Only assign a subtype when the provider explicitly supplies enough information. Do not infer `personal` or `mobile` from the string alone.

Persist this subtype in Candidate Graph contact storage with a migration if necessary. Preserve backward compatibility for old contact rows.

### P0-D — PDL contact adapter requests direct email fields but does not map them
`PDL_DATA_INCLUDE_V35` requests `work_email` and `recommended_personal_email`, but `mapSignals()` currently loops `person.emails` and does not directly emit either field.

Fix:
- emit `work_email` as `contactKind='work_email'`
- emit `recommended_personal_email` as `contactKind='personal_email'`
- preserve/dedupe `emails[]`, using its provider type metadata where present
- add `mobile_phone` to the requested allowlist if supported by the current PDL schema, and map it explicitly without pretending verification/permission
- preserve `phone_numbers[]` and subtype metadata when present
- direct normalized fields should win dedupe over less-specific duplicate array entries

PDL 404/no-match should be represented as a valid zero-yield/no-match outcome when the provider payload indicates `No records were found matching your search`, not as a misleading infrastructure failure. True auth/rate/schema failures remain failures.

### P0-E — SignalHire subtype information is being thrown away
The synchronous SignalHire Person API adapter sees contact `subType` but uses it only in notes. Map provider subtype to the normalized contact kind when possible. SignalHire exact LinkedIn/provider-ID lookup may return multiple contact channels; preserve all returned professional contact signals and then let the goal-aware orchestrator decide whether more providers are needed.

Do not broaden SignalHire discovery search with undocumented raw recruiter prose. A person lookup should use an allowed supported person/name filter only if the current API contract explicitly supports it.

### P1 — Candidate 360 contact UX needs to reflect the real workflow
Candidate 360 currently has a generic `Enrich` button and an older `FindContactButton` whose comments and badge still imply PDL-only behavior. The badge is hard-coded `People Data Labs` even when another provider actually returned the signal.

Fix Candidate 360 contact research:
- show normalized channel label (`Work email`, `Personal email`, `Mobile phone`, etc.)
- show actual provider per signal
- show ownership confidence separately from deliverability
- show permission separately
- show observed/fetched time
- show `Find contact info` action with requested goals
- after new signals persist, refresh Candidate 360 automatically
- never label a provider result verified unless the provider contract/result actually supplies a technical verification/deliverability signal
- preserve current `primaryWorkEmail` shadow-mode resolver semantics unless deliberately promoted in a separately tested change

### P1 — Search source health must distinguish configured from operational
Implement source health telemetry with states such as:
- configured (key present)
- authenticated (real request succeeded)
- healthy / degraded / failing
- yielding / zero-yield
- last success
- last non-zero yield
- consecutive failures
- consecutive zero-yield runs
- average latency
- recent discovery count
- recent retained contribution count
- estimated credits where known

UI should not imply `7 executable` means `7 providers contributed`. The RHEL run must visibly say 2 contributed while retaining the 7 configured/executable context.

Persist health events or aggregate them in a durable, owner-safe way. A source returning zero across N consecutive representative runs should surface a warning. Do not treat a legitimate narrow no-match as an outage by itself.

### P1 — Provider Lift / evaluation harness
Build a small durable evaluation harness before adding more commercial people providers.

For a search run capture at least:
- total raw provider observations
- retained observations
- provider contribution mix
- safely unique identity anchors / reviewable duplicates
- novel people not already in Candidate Graph
- people with at least one evidenced must-have
- people with all currently evidenced must-haves (when deterministically computable)
- contact availability / resolved-channel rate
- recruiter Yes / Maybe / No outcomes when available
- estimated provider credits/cost
- latency

Start with canonical evaluation roles including the RHEL Annapolis Junction query. Support provider-off/provider-on comparisons without pretending ambiguous cross-provider rows are already the same person.

## 3. Provider-specific runtime follow-up

### LinkUp
Current code uses the documented `x-api-key` header and documented `/v1/data/search/profiles` endpoint. The current public API docs also expose `current_company` on People Search. The observed 401 is therefore most likely credential/account/entitlement related unless a live response proves otherwise.

Do not hide this as `0 results`. Surface `authentication rejected` in source diagnostics. Do not log the key. Add `current_company` once company filters are wired.

Research/optionally implement LinkUp Email Finder (`/v1/data/mail/finder`) only if its terms/entitlement are acceptable and the same key/account works. Keep it an explicit contact lookup lane, never search-time reveal.

### DataVertex
The tested Preview had no DataVertex key. Do not call it broken. Once configured, its existing anchored lookup can return a personal email and phone. Map those to explicit contact subtypes and include it in the goal-aware waterfall.

### PDL
Treat provider no-match separately from provider failure. Prefer the current documented Person Search request contract. Do not weaken the identity/provenance rules.

## 4. Governance/security slice that belongs in V36.12

### GitHub email firewall
GitHub can remain discovery/evidence/identity input. GitHub-derived public email must not silently become an outreach/contact source. Add a regression test and a policy gate such as `github_public_email -> research_only / blocked_for_outreach`. A future refactor must fail tests if GitHub public email reaches campaign recipients/outreach drafts.

### Dedicated observation signing secret
Stop using provider API keys as HMAC observation-signing keys. Add `OBSERVATION_SIGNING_SECRET` (versionable later). Provider key rotation must not invalidate otherwise valid signed review observations.

### Data governance dimensions
Keep these separate:
- `dataOrigin`: where the observation came from
- `processingBasis`: why it is being processed
- `permittedUse`: what SourcingOS may currently do with it
- `entitlementRef`: whose license/authorization covers it where relevant
- `retentionPolicy`: retention/refresh/deletion semantics

Do not use one overloaded `source` or `lawfulBasis` field for all five concepts.

## 5. OpenAlex repair

Current acquisition connector still uses legacy `mailto` query behavior and old `x_concepts` extraction. Repair the connector against the current OpenAlex API contract:
- add `OPENALEX_API_KEY`
- authenticate requests according to current official docs
- remove retired `mailto` behavior
- migrate legacy concepts extraction to current topic fields
- keep ORCID deterministic identity treatment
- add contract tests
- record provider health failures/zero-yield instead of silent thin results

## 6. Resume/artifact truth slice (V36.13 after V36.12 gate)

Do NOT build the product around mass-purchased resume databases. Do continue first-class resume/artifact support for candidate-submitted, recruiter-provided, customer ATS/CRM and explicitly licensed customer data.

A resume is an artifact/source observation, not verified truth.

Add `claimOrigin`, e.g.:
- candidate_self_reported
- recruiter_entered
- customer_ats_record
- provider_observed
- public_artifact
- public_professional_profile
- authoritative_registry
- derived_inference

Change generated evidence wording from generic `Skill signal: RHEL` to provenance-preserving wording such as `Recruiter-uploaded resume states RHEL`.

Remove `resume/CV present -> open-to-work` inference. A historical resume does not prove present availability.

Add source/field authority matrix and separate:
- source availability freshness
- semantic/currentness of the claim

Historical claims remain historical evidence even when not current.

Continue Artifact Vault toward original PDF/DOCX/storage ref + file hash + parser version + page/span provenance, not flattened text only.

## 7. Free/open sourcing expansion (V36.14 after evaluation exists)

Prioritize high-yield, provenance-friendly additions before another commercial people database:
1. Stack Exchange multi-site routing: Unix & Linux, Server Fault, Information Security, DevOps, DBA, Network Engineering, Data Science as role-appropriate lanes.
2. Hacker News `Who wants to be hired?` / `Seeking Work` via official Firebase data; model the thread date as a time-sensitive explicit work-opportunity availability signal, not permanent consent.
3. GitLab discovery/evidence connector after API/terms verification.
4. Wikidata as identity corroboration (ORCID/GitHub/institution/etc.), never silent merge authority.

## 8. Jobs/company architecture (V37 — separate major slice)

Do not simply put a cron on the current `jobs-v2` persistence layer and assume it becomes labor-market intelligence. Current job persistence/search is explicitly filtered by `isRecruitingRole`, so it excludes RHEL admins, systems engineers, cyber analysts, etc.

Split the concepts:

### A. Public Recruiting Jobs
Keep current recruiter-career/SEO job board behavior.

### B. Labor Market Posting Graph
New corpus for general professional job postings and employer demand intelligence. No recruiting-role filter.

Build a canonical Company entity / Company 360 with an identifier spine (UEI/CAGE/LEI/CIK and other appropriate identifiers), aliases/domains and parent/subsidiary relationships.

Connect dated job observations to Company. Derive company-level signals only:
- repeated technology terms -> observed company technology environment
- title vocabulary
- posting locations -> operates/hiring in
- clearance language -> cleared hiring environment, NEVER person clearance
- posting volume over time -> hiring trend
- disclosed compensation context

Then build recruiter-facing `Who else is hiring this role?` / target-company intelligence.

Schedule ingestion only after the split is correct. USAJOBS should become a persistent labor-demand corpus. Rebuild target employers around federal/cleared market and add permitted public ATS adapters (Workday/iCIMS/Taleo/SuccessFactors/Avature/etc.) based on actual public contracts/endpoints rather than scraping by default.

Adzuna belongs in the Labor Market Posting Graph, not candidate discovery. Dice MCP currently appears job-market oriented and should also route to job/company intelligence unless a separate authorized candidate contract is proven.

## 9. Tests / acceptance gates

At minimum add deterministic tests for:
- Universal People Search name and name+company parsing
- `/api/candidate-data/search` accepts/forwards names and companies
- `Dan Larson maximus` never becomes PDL exact full name `dan larson maximus`
- RHEL flagship parsing unchanged
- PDL direct `work_email` is emitted
- PDL `recommended_personal_email` is emitted and labeled personal
- SignalHire subtype survives normalization
- contact-goal orchestration continues after work email when phone is still requested
- contact-goal orchestration stops once requested goals are satisfied
- cache-first contact resolution avoids a paid provider call when a sufficiently fresh stored signal already satisfies the goal
- actual provider label is rendered in Candidate 360 / contact UI
- GitHub-derived email cannot reach outreach recipient/draft path
- PDL no-match 404 is not counted as infrastructure outage when provider response is an explicit no-match
- LinkUp 401 is categorized as auth failure
- source health distinguishes configured/authenticated/yielding
- observation signing uses dedicated secret
- resume presence alone does not create open-to-work signal
- historical artifact evidence does not expire merely because current-employment freshness does

Run:
- TypeScript
- deterministic test suite
- production Next build
- audit

Do not merge/deploy production. Keep this branch/PR draft until real Preview runtime testing passes.

## 10. Runtime acceptance after code gate

Use the real Preview credentials and repeat:

### Test A — RHEL
`Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher`

Record provider-by-provider discovered/retained contribution and the evaluation metrics. Verify failures are correctly classified and that retrieval explanations never become qualification claims.

### Test B — Person lookup
`Dan Larson at Maximus`
then `Dan Larson maximus`

Expected:
- intended name anchor structured correctly
- company used as professional search context/filter where supported
- results retain raw provider provenance
- exact candidate can be saved to Candidate 360
- `Find contact info` searches missing requested channel goals rather than stopping permanently at the first work email
- work/personal/phone labels only appear when provider returns that subtype
- if no personal email/cell is found after eligible providers are exhausted, UI says that clearly and shows which lanes attempted; never promise a result that providers do not have.

### Test C — exact identifiers
Email, phone and LinkedIn URL exact lookup must remain separate identity-enrichment lanes and must not authorize cross-provider merge or outreach.
