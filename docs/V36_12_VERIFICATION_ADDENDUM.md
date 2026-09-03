# V36.12 Verification Addendum — Mandatory Read Before Implementation

Branch: `v36-12-search-truth-contact-intelligence`
Base audited: `df50dc9e414854ece87aba17dc538c1c353d152c`

This addendum records an independent verification pass against the exact V36.10/V36.11 head and **changes implementation priority** in several places. Read this file together with `docs/V36_12_IMPLEMENTATION_PACKET.md`. Where sequencing differs, **this addendum wins**.

## Verified baseline

At `df50dc9`:
- `npx tsc --noEmit`: clean
- deterministic suite: **940/940 passed across 130 files**
- stale V31 navigation assertion is fixed
- provider-observed professional links are now separated from source-native profile URLs

Do not attribute later failures to the baseline without evidence.

---

# 0. Mandatory first step: build and run the evaluation baseline BEFORE repairing connectors

The Provider Lift / Search Quality harness is not merely another V36.12 feature. It is the **first implementation step**.

Before repairing OpenAlex or materially changing provider/search behavior:

1. Implement the smallest durable evaluation harness capable of recording the canonical metrics below.
2. Freeze five representative canonical roles/queries.
3. Run and persist a baseline on the current behavior, including the currently broken OpenAlex state.
4. Only then repair OpenAlex and other connectors.
5. Re-run the exact same canonical roles and record the delta.

This turns the OpenAlex repair into the first validated Provider Lift result and creates a repeatable pattern for every subsequent connector/search change.

### Minimum canonical evaluation set

At least:
1. Cleared RHEL Administrator — Annapolis Junction / Fort Meade — 5+ years — Secret+
2. Cleared cybersecurity / DevSecOps engineer
3. General software engineer
4. AI/ML or scientific/research role where OpenAlex/ORCID/publication lanes should contribute
5. GTM / nontechnical professional role

Keep the fixtures stable enough for before/after comparison. Do not silently modify requirements between baseline and post-change runs.

### Minimum metrics per run

Persist:
- total discoveries
- retained observations
- provider contribution mix
- safe unique-person / identity-review counts without pretending ambiguous rows are merged
- novel people not already in Candidate Graph
- candidates with at least one evidenced must-have
- candidates with all currently evidenced must-haves where deterministically computable
- contact availability rate
- resolved work-email rate
- resolved phone/mobile rate when explicitly requested
- recruiter Yes / Maybe / No when available
- latency by provider and total
- estimated credits/cost by provider and total
- connector state: success / explicit no-match / zero-yield / auth failure / rate limit / schema/contract failure / network failure

Provider count is never a quality metric by itself.

---

# 1. Jobs finding is stronger than the base packet states

`isRecruitingRole()` is not merely a persistence/search gate. It is enforced upstream during ingestion/fetch as well.

Verified enforcement sites on the audited base include:
- `lib/jobs-ingestion.ts` ATS batch filtering
- Greenhouse fetch filtering
- Lever fetch filtering
- Ashby fetch filtering
- `lib/jobs-v2.ts` persistence eligibility
- `lib/jobs-v2.ts` persisted search
- live jobs search route paths including USAJOBS

## Consequence

General professional postings such as RHEL Administrator, Systems Engineer, Cybersecurity Analyst, Data Scientist, etc. are discarded **before persistence**.

Therefore:

> The two-job-systems split is not an optional V37 enhancement. It is the architectural prerequisite for any general labor-market/company-intelligence corpus.

Do **not** try to create labor-market intelligence by merely changing `persistEligible`, adding a cron, or loosening a final search filter. The ingestion/fetch layer must have a separate path that never applies the recruiting-role allowlist.

### Required V37 architecture

**A. Public Recruiting Jobs**
- preserve current recruiting-career/SEO behavior
- retain `isRecruitingRole()` semantics where appropriate

**B. Labor Market Posting Graph**
- separate ingestion contract
- no recruiting-role filter
- general professional job corpus
- company-linked observations
- firstSeenAt / lastSeenAt / postedAt / removedAt / lastSuccessfullyCheckedAt
- title, location, comp, clearance language, skills/technology language as job/company evidence only

Shared transport/parsing utilities are fine. Shared filtering policy is not.

USAJOBS should eventually feed the Labor Market Posting Graph, not merely the recruiting-jobs table.

---

# 2. Resume open-to-work inference is a P0 false positive by construction

The current candidate parsing path treats generic `resume`, `curriculum vitae`, or bare substring `cv` as a medium-confidence open-to-work/market-visibility signal.

That behavior is invalid.

Nearly every resume artifact can contain the word `resume`; bare substring `cv` can also match unrelated text. Presence of a resume does not establish current availability.

## Required fix

Remove generic resume/CV presence as an availability signal entirely.

Retain explicit, time-sensitive signals such as:
- `open to work`
- `#opentowork`
- `seeking work`
- `available for new opportunities`
- current candidate application/submission where the workflow itself establishes current interest

Wording must continue to say **reviewable availability signal**, not verified job-seeking truth.

Add regression tests proving:
- ordinary uploaded resume => no open-to-work signal
- historical resume => no open-to-work signal
- incidental letters `cv` inside another word => no signal
- explicit current `open to work` language => reviewable availability signal

This should be fixed no later than the first resume/artifact-truth slice and may be pulled into V36.12 if touching the same parser safely.

---

# 3. Resume skill extraction contains a self-confirming feedback loop

Current flow can:
1. parse a resume/source profile
2. create skill evidence from that text
3. concatenate source raw text **plus generated evidence detail**
4. run `splitSkills()` again over the combined text

That allows generated evidence to become new extraction input.

Even if the effect is mild today, this is the shape of a self-confirming inference loop and must be removed before resume-derived skill signals are given more authority.

## Required invariant

> Derived evidence must never become source input for the same or equivalent derivation pass.

Implement one of:
- source-only extraction input, with evidence excluded from `rawText` skill re-extraction; or
- explicit immutable extraction snapshot that subsequent resolvers consume without reparsing derived evidence.

Add a deterministic regression that proves adding generated `Skill signal` evidence cannot cause a new skill to appear unless that skill existed in an admitted source observation/artifact.

This is separate from `claimOrigin`; both fixes are needed.

---

# 4. `claimOrigin` + field × source authority remain required

These are promoted, not deprioritized.

A source/evidence observation needs a distinct claim-origin dimension such as:
- `candidate_self_reported`
- `recruiter_entered`
- `customer_ats_record`
- `provider_observed`
- `public_artifact`
- `public_professional_profile`
- `authoritative_registry`
- `derived_inference`

A resume skill must read like:
> Candidate/recruiter-provided resume states RHEL.

not:
> RHEL verified skill.

Field resolution also needs a field × source authority matrix. Source authority is not globally interchangeable across fields.

Examples:
- license/certification -> authoritative registry should dominate
- publication -> DOI/OpenAlex/PubMed evidence
- current employer/title -> recent professional/current-company observations
- historical employer -> dated resume/professional history may remain valid historical evidence
- work email -> current contact-resolution observation plus ownership/deliverability metadata
- clearance -> explicit/recruiter-verified evidence only; never inferred from employer/job language

Maintain separate clocks for:
1. source retrievability/freshness
2. semantic currentness of the claim

A dated historical statement does not become false merely because it is old; it simply should not win a current-state field.

---

# 5. OpenAlex repair comes AFTER baseline capture

The base packet's OpenAlex repair scope remains correct but sequencing changes.

After the evaluation baseline is persisted:
- add `OPENALEX_API_KEY`
- remove retired `mailto` behavior
- migrate `x_concepts` / legacy Concepts usage to modern Topics
- verify current search query syntax against official documentation before implementation
- verify current `data_version` usage/migration semantics
- retain ORCID identity treatment
- classify auth/rate/schema/zero-yield separately
- add contract tests and source-health instrumentation

Then re-run the exact canonical evaluation set and record OpenAlex's marginal lift, especially on research/science/AI/clinical roles.

---

# 6. Company Graph sequencing is promoted

The earlier conceptual seven-layer moat should not be described as seven existing layers.

Current state:
- Role Brain: real
- source/discovery orchestration: real
- evidence/candidate graph: real
- identity graph: real
- Company Graph: **not yet built**
- recruiter-feedback write-back into future search behavior: present only in a thin/partial form

Use language that distinguishes shipped capability from roadmap capability.

## Sequencing change

After V36.12 stabilizes search truth/contact/source health:

**Preferred major-product order:**
1. **V37 Company Graph + Labor Market Posting Graph**
2. V36.13/V37.x Resume & Artifact Truth expansion, unless resume work is required as a prerequisite for a specific customer workflow
3. Free/open-source expansion after evaluation can measure marginal lift

Reason: Company Intelligence creates a genuinely new recruiter capability and unlocks Talent Insights; resume truth primarily improves records already present.

Important: the small P0 resume correctness defects above (false open-to-work inference and self-confirming skill extraction) do **not** wait for the full Artifact Vault release. Correct unsafe/false inference behavior as soon as the relevant code is touched.

---

# 7. Cache-first contact resolution remains the highest-value waterfall improvement

The live test already demonstrated one correct path:
- search found a candidate
- explicit contact lookup found work email
- Candidate 360 persisted it as unverified / permission unknown

The next lookup for the same requested work-email goal should reuse a sufficiently fresh stored signal before spending another provider credit.

The contact resolver must then continue only for still-missing explicitly requested goals (e.g. mobile phone) rather than equating `any signal returned` with `all contact goals satisfied`.

Measure:
- cache hit rate
- paid attempts avoided
- credits avoided
- additional channels discovered after first successful work email
- false/ambiguous identity prevention

---

# 8. Acceptance-order contract for Claude / implementation agents

Implement in this order unless a hard dependency requires otherwise:

### Phase A — Measurement first
1. Provider Lift/search-quality data model
2. five canonical role baselines on current behavior
3. source outcome taxonomy

### Phase B — Live People Search/contact correctness
4. name + company structured transport
5. PDL direct email field mapping and contact subtypes
6. SignalHire subtype preservation
7. goal-aware/cache-first contact bundle resolution
8. Candidate 360 contact UX and actual-provider labels
9. PDL explicit no-match vs failure classification
10. LinkUp 401 auth/entitlement classification

### Phase C — Source reliability/security
11. source-health persistence/diagnostics
12. GitHub-email outreach firewall
13. dedicated observation-signing secret
14. dataOrigin / processingBasis / permittedUse / entitlementRef / retentionPolicy dimensions

### Phase D — Measured connector repair
15. OpenAlex current-contract repair
16. rerun exact five canonical roles
17. record before/after lift and source-health delta

### Phase E — correctness defects in adjacent touched areas
18. remove generic resume/CV => open-to-work inference
19. break resume skill evidence feedback loop
20. pin both with deterministic tests

Then stop for review before merge/production.

---

# 9. Required final report

When V36.12 implementation is complete, report:
- exact head SHA
- exact CI/test counts
- migrations/env vars
- Preview deployment SHA/URL
- canonical baseline metrics before changes
- canonical metrics after changes
- per-provider contribution/lift table
- contact cache hit / paid attempt behavior
- OpenAlex before/after contribution
- explicit unresolved provider entitlement/auth failures
- any trust-boundary changes (should be none without approval)
- recommended provider(s) to keep, downgrade, or drop based on measured marginal value

Do not claim `more candidates`, `healthier source`, or `better search` without the corresponding measured before/after result.