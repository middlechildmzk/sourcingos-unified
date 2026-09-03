# V36.12 Implementation Packet — Search Truth, Contact Intelligence, Source Health

Branch: `v36-12-search-truth-contact-intelligence`
Base: `df50dc9e414854ece87aba17dc538c1c353d152c` (`v36-10-candidate-graph-identity-db`)

This packet is based on real Preview runtime testing on 3 September 2026, but all person/employer examples below are synthetic. Preserve all standing SourcingOS trust boundaries: no automatic cross-source identity merge, no auto-shortlist/reject/contact, provider retrieval is not qualification, contact ownership/deliverability is not permission, clearance mentions remain unverified unless explicitly verified, and public/provider observations retain provenance.

> Mandatory companion: `docs/V36_12_VERIFICATION_ADDENDUM.md`. Where sequencing differs, the addendum wins.

## 1. Runtime findings driving this release

### Flagship cleared-infrastructure search
A natural-language RHEL / Annapolis Junction / 5+ years / Secret+ search executed seven configured professional-search lanes. Only two sources contributed retained observations. One source returned an explicit no-match, one returned an authentication/entitlement error, and several completed with zero yield.

This proves the orchestration is real, but also proves that `configured` / `executable` / `healthy` / `yielding` / `contributing` are different states and must be reported separately.

### Exact-ish person lookup
A synthetic person lookup such as `Jane Doe ExampleCo` can be found by semantic search, but structured providers must receive:
- name: `Jane Doe`
- company: `ExampleCo`

They must never receive the entire three-token string as an exact full name.

A work-email finder can succeed while personal-email and phone goals remain unattempted. Therefore a successful work-email lookup is not evidence that no other channels exist.

## 2. Mandatory execution order

### Phase A — Measure before changing retrieval
Build and persist the Provider Lift / Search Quality harness first. Capture stable canonical-role baselines before repairing OpenAlex or materially changing public-source retrieval.

At minimum record:
- raw provider observations
- retained observations
- provider contribution mix
- completed / failed / skipped / zero-yield providers
- safely resolvable novelty once Candidate Graph comparison is available
- evidenced must-have coverage once evidence-aware evaluation is available
- contact availability / resolved-channel rate
- recruiter Yes / Maybe / No when available
- estimated credits/cost
- latency

Canonical roles should include cleared infrastructure, cleared cyber, mainstream software engineering, ML/research, and GTM sourcing so a connector can be measured in the markets where it should matter.

### Phase B — Fix People Search and contact resolution
1. Add `names` and `companies` to the professional-search request contract and API route.
2. Support deterministic forms such as `Jane Doe at ExampleCo` and `Jane Doe, ExampleCo`.
3. Treat compact `Jane Doe ExampleCo` as name + soft company context, never identity authority.
4. Keep raw query available to semantic providers.
5. Wire company filters only to documented provider fields.
6. Distinguish explicit provider no-match from provider failure.
7. Distinguish authentication/entitlement rejection from zero yield.

### Phase C — Goal-aware, cache-first Contact Resolution
The recruiter-facing action should be `Find contact info`, with explicit requested goals such as:
- work email
- personal email when the provider explicitly labels it personal
- phone/mobile when the provider explicitly supplies it

Rules:
- Candidate Graph/cache first at $0.
- Do not call a provider when a sufficiently fresh stored signal already satisfies the requested goal.
- Continue only for still-missing goals.
- A LinkedIn/profile URL does not satisfy an email goal.
- A work email does not satisfy a personal-email or phone goal.
- Preserve attempts, latency and estimated credits.
- Never auto-send outreach.
- Never infer permission from deliverability or ownership.

### Phase D — Preserve channel subtype truth
Normalized contact metadata should support explicit provider-labeled subtypes:
- `work_email`
- `personal_email`
- `other_email`
- `mobile_phone`
- `work_phone`
- `home_phone`
- `other_phone`
- professional/social profile
- company domain
- unknown

Never infer `personal` or `mobile` from the value string alone.

### Phase E — Provider adapter corrections
People Data Labs:
- directly normalize `work_email`
- directly normalize `recommended_personal_email`
- preserve email-array type metadata
- request/map `mobile_phone` where supported
- preserve phone-array type/subtype metadata
- direct normalized fields win dedupe over less-specific duplicates

SignalHire:
- preserve contact `subType`
- preserve all returned professional contact signals from explicit person lookup
- keep synchronous/internal lookup limitations visible

AnyMail Finder / Hunter / Tomba:
- professional finder results should be labeled work-email only when their endpoint contract supports that interpretation
- email verification alone does not establish work vs personal ownership

DataVertex:
- anchored lookup may contribute explicit email/phone signals when configured
- preserve provider labels and permission separation

## 3. Candidate 360 contact UX

Candidate 360 should show:
- Work email / Personal email / Mobile phone / other normalized label
- actual provider
- ownership confidence
- deliverability/technical validity
- permission state
- observed/fetched time
- contact-resolution attempts and missing goals

After enrichment, refresh Candidate 360 automatically. A useful terminal state is:
`No additional requested contact channels returned after N eligible provider attempts.`

Do not hard-code a single provider badge in the multi-provider UI.

## 4. Source health

Track at least:
- key/configured
- authenticated
- healthy/degraded/failing
- yielding/zero-yield
- last success
- last non-zero yield
- consecutive failures
- consecutive representative zero-yield runs
- average latency
- recent discovery count
- retained contribution count
- estimated credits when known

A legitimate narrow no-match must not be counted as an outage. A repeated representative zero-yield pattern should be visible.

## 5. Governance and security

### GitHub email firewall
GitHub may remain a discovery/evidence/identity source. GitHub-derived public email must be explicitly blocked from becoming an outreach recipient or campaign contact. Add regression coverage so later refactors cannot silently promote it.

### Dedicated observation signing key
Add `OBSERVATION_SIGNING_SECRET`. Provider API-key rotation must not invalidate signed review observations or couple vendor credentials to an unrelated HMAC function.

### Separate governance dimensions
Do not overload `source`. Model separately:
- `dataOrigin`
- `processingBasis`
- `permittedUse`
- `entitlementRef`
- `retentionPolicy`

## 6. OpenAlex — only after Phase A baseline

Do not repair OpenAlex before baseline capture.

After the baseline exists, verify the current official API contract and then:
- add `OPENALEX_API_KEY`
- remove retired/legacy `mailto` behavior
- migrate legacy concepts extraction to current topics
- verify current search/filter syntax
- inspect `data_version` implications
- retain ORCID as deterministic identity evidence
- record health/no-yield telemetry
- rerun the identical canonical roles and report before/after lift

## 7. Immediate resume correctness P0s

These should not wait for the larger Artifact Truth release:

1. Remove generic `resume`, `curriculum vitae`, or bare `cv` -> open-to-work inference. Document existence is not present availability.
2. Keep explicit `open to work`, `#opentowork`, or clear current availability wording as reviewable signals.
3. Break the skill self-confirmation loop: evidence generated from source text must never be concatenated back into the source input used to extract scalar skills.

## 8. Follow-on artifact truth

A later artifact slice should add `claimOrigin`, for example:
- candidate self-reported
- recruiter entered
- customer ATS record
- provider observed
- public artifact
- public professional profile
- authoritative registry
- derived inference

A resume is an artifact/source observation, not verified truth. Field resolution should use a field x source-authority matrix and separate source-availability freshness from semantic/currentness. Historical evidence remains historical evidence even when it should no longer win current-title/company resolution.

## 9. Jobs/company architecture — mandatory split

The current recruiter-jobs system applies recruiting-role filtering upstream during ATS/live fetch, as well as persistence/search. General professional postings are discarded before storage.

Therefore future Company Intelligence requires two separate systems:

### A. Public Recruiting Jobs
Keep the existing recruiter/sourcer career and SEO surface.

### B. Labor Market Posting Graph
A separate ingestion/storage path with no recruiting-role filter. It should retain general professional postings as dated employer observations and connect them to a canonical Company entity.

Posting-derived signals are company evidence only:
- repeated technology terms -> observed company technology environment
- title vocabulary
- hiring locations
- clearance language -> cleared hiring environment, never person clearance
- posting volume -> hiring trend
- disclosed compensation

This enables recruiter-facing `Who else is hiring this role?` and target-company sourcing strategy.

## 10. Acceptance tests

At minimum pin:
- person name + company parsing
- API transport of `names` and `companies`
- compact name/company never becomes an exact three-token PDL full name
- flagship RHEL parsing unchanged
- PDL direct work and personal email normalization
- PDL mobile/phone subtype preservation where provider metadata exists
- SignalHire subtype preservation
- work-email success does not stop a still-requested phone goal
- profile URL does not satisfy email goal
- cache hit avoids paid provider execution
- actual provider/channel labels render in Candidate 360
- GitHub-derived email cannot reach outreach recipient/draft paths
- explicit PDL no-match is not infrastructure failure
- LinkUp auth rejection is not zero yield
- source health distinguishes configured/authenticated/yielding
- observation signing uses the dedicated secret
- resume presence alone creates no availability signal
- generated evidence cannot feed back into scalar skill extraction

## 11. Release gates

Before acceptance:
- TypeScript clean
- full deterministic suite green
- PostgreSQL migration smoke green
- dependency audit green
- production Next.js build green
- real Preview runtime retest
- canonical baseline captured before OpenAlex repair
- identical canonical roles rerun after OpenAlex repair
- PR remains draft until explicit review
- no production merge/deployment without explicit approval
