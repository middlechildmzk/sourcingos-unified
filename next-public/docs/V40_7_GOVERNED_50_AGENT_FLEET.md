# V40.7 — Governed 50-Agent Capability Fleet

Issue: #173  
Related: #171 (Resume/CV post-canary provider benchmark), #172 (recruiter list/detail workbench)

## Purpose

V40.7 syncs the latest provider, scraping, identity-resolution, talent-graph, and orchestration research into the existing SourcingOS architecture without creating a parallel search product and without weakening the V40.5 Resume/CV canary.

The principle is simple:

> SourcingOS should compete on fresh public evidence, identity precision, recruiter workflow, and orchestration — not on an unverifiable raw profile-count claim.

The current production talent-intelligence fleet remains the source of truth. V40.7 adds a governed 50-seat improvement program, a provider capability catalog, and a framework-neutral work-event contract that can later be transported by Inngest.

## Two distinct 50-agent concepts

SourcingOS already has 50 logical talent-intelligence workers in `lib/fleet/agent-registry-v40-4.ts`. Those workers perform bounded discovery, Resume/CV intelligence, enrichment, identity verification, and operations/quality tasks.

V40.7 does **not** replace or duplicate them.

V40.7 adds a separate improvement/build overlay:

| Pod | Seats | Mission |
| --- | ---: | --- |
| Search Intelligence | 10 | Search quality, provider yield, source coverage, market signals |
| Candidate Intelligence | 10 | Evidence, identity, skills, trajectory, profile completeness |
| Recruiter UX | 10 | Search brief, candidate review, Candidate 360, contacts, mobile |
| Product / Engineering | 10 | Adapters, orchestration, telemetry, caches, preview-safe implementation |
| QA / Red Team | 10 | Safety, identity, failure modes, regressions, release gates |

Each seat receives one deterministic workstream. A batch is queue-ready and attributable, but carries no production-write authority.

## Provider policy

A provider in the capability catalog is **not** proof that it executed, that a credential exists, or that SourcingOS should purchase it.

### Current/public-first

Use the official/public surfaces already in the platform where possible:

- GitHub API
- Stack Exchange APIs
- npm and crates.io
- NPPES and ORCID
- existing Exa public-web capability

These remain evidence sources, not candidate-verification shortcuts. Every claim retains provenance and freshness.

### Staged public/open signals

High-leverage additions to wire behind the existing connector contract:

- OpenAlex + arXiv
- Hugging Face + PyPI
- Greenhouse + Lever + Ashby public job-board APIs
- public patent/innovation and company signals where terms permit
- Splink as an entity-resolution proposal engine
- Upstash for optional idempotency, rate limits, and dedupe cache
- Inngest as a thin durable transport adapter

These should reuse existing `SourceResult`, evidence, identity-review, landing-zone, telemetry, and credit-budget paths.

### Preview challengers

Default OFF:

- Firecrawl
- Tavily
- Apify, **authorized/public actors only**

They may be benchmarked in Preview after an adapter is reviewed. They cannot be turned into a generic "scrape anything" lane.

### Post-canary challengers

- Serper exact/public search
- Parallel benchmark from #171

These remain subordinate to the V40.5i Resume/CV safety rollout. The 50-agent improvement fleet cannot accelerate or release the Resume/CV backlog.

### Bright Data

Bright Data remains an optional public/authorized fallback. It must never be used as an authentication, paywall, CAPTCHA, or access-control bypass.

### Contract/purchase gate

Examples:

- People Data Labs
- Coresignal
- Crustdata
- FullEnrich / Cleanlist
- Apollo / Lusha and similar paid contact providers

No purchase, plan upgrade, bulk dataset acquisition, or production activation occurs from the agent fleet. Explicit human approval and contract/compliance review are required.

## Explicitly blocked

Provider choice does not change these rules:

- LinkedIn or other account-gated scraping
- login/paywall/CAPTCHA bypass
- private bucket/Drive-ID guessing or enumeration
- unattended mass contact harvesting
- silent identity merging
- autonomous outreach
- autonomous reject/hire/ranking decisions presented as decisions

Apify/Bright Data/browser tools do not create an exception.

## Identity-resolution workflow

Research recommendations are incorporated as a proposal pipeline, not as permission to auto-merge:

1. Normalize source-native identifiers, names, organizations, URLs, and timestamps.
2. Use deterministic anchors first: explicit source IDs, ORCID, GitHub login, verified personal-domain/profile links, and other person-specific anchors.
3. Require an independent supporting anchor before any high-confidence cross-source link.
4. Use probabilistic tooling such as Splink only to score or propose ambiguous pairs.
5. Route same-source collisions and ambiguous cross-source matches to review.
6. Preserve source provenance, observed-at time, conflict history, and survivorship logic.
7. Never auto-merge on name similarity alone.

This fits the existing SourcingOS identity-review boundary instead of replacing it.

## Search / data architecture

The source order is role-specific rather than one giant waterfall.

### Candidate discovery

- exact/public search when useful
- semantic public-web search
- official technical/research registries
- job/company signals
- provider-specific people data only where contracted and allowed

### Fetch / extraction

- fetch only public/authorized URLs
- classify URLs before expensive fetch
- preserve metadata-only state when content cannot be retrieved permissibly
- dedupe by normalized URL/content fingerprint
- persist fetch/parser failure separately from no-match

### Candidate evidence

Search terms are never candidate evidence. A requirement is `Observed`, `Missing`, or `Unknown` based on actual source evidence, not query expansion.

## Orchestration

### Current production runtime

Keep the existing:

`Vercel Cron -> claim bounded Supabase work -> plain async worker/scout -> landing zone/evidence -> telemetry`

That path is already testable without a second orchestration framework.

### V40.7 event contract

`improvement-workflow-v40-7.ts` defines:

- `sourcingos/fleet.v40_7.work.requested`
- `sourcingos/fleet.v40_7.work.completed`

A future Inngest adapter may transport those events and add retries/concurrency/observability, but the core job definition remains framework-neutral.

Agents do not call each other directly. They consume a work item and return attributable findings/artifacts.

### GitHub + Vercel feedback loop

The stronger Vercel GitHub connection is useful for the improvement fleet:

1. Product/Engineering agents propose branch-scoped changes.
2. GitHub PR is the review boundary.
3. Vercel Preview builds the exact PR head.
4. QA/Red-Team agents read CI/Preview results.
5. Orchestrator consolidates failures and next actions.
6. Human approves merge/release.

Vercel Connect/webhook events are **not** allowed to directly claim or release Resume/CV production work. Build/deployment feedback is separated from talent-data execution.

## Resume/CV isolation

The V40.7 improvement fleet hard-blocks targets containing:

- `/api/cron/resume-sprint`
- `claim_resume_sprint_tasks_v40_5`
- `RESUME_SPRINT_RELEASE_MODE=scaled`
- any mass Resume/CV requeue/release operation

V40.5i remains its own release train:

`6 -> review telemetry -> 12 -> 25 -> 50 -> 100`

No 50-agent fleet action can skip those gates.

## Environment flags

Experimental provider toggles are double-gated and default OFF:

```text
AGENT_FLEET_EXPERIMENTAL_PROVIDERS=false
AGENT_FLEET_PROVIDER_FIRECRAWL=false
AGENT_FLEET_PROVIDER_PARALLEL=false
AGENT_FLEET_PROVIDER_TAVILY=false
AGENT_FLEET_PROVIDER_APIFY=false
```

These flags are governance telemetry until a reviewed adapter consumes them. Setting a flag alone never proves a provider is configured or operational.

## API

Authenticated program status:

`GET /api/fleet/program`

Returns:

- 5 pods / 50 seats
- all deterministic workstreams
- provider capability states
- effective experimental flags
- orchestration posture
- trust/safety boundaries

It does not run paid providers or mutate production queues.

## Weekend operating sequence

1. **Read-only reconnaissance** — Search, Candidate, Recruiter UX, QA pods gather findings.
2. **Consolidation** — dedupe findings into issues/acceptance criteria.
3. **Implementation** — Product/Engineering works only on approved, branch-scoped tasks.
4. **Preview validation** — GitHub CI + Vercel Preview exact head.
5. **Red-team** — safety, identity, provider-failure, mobile, regression checks.
6. **Human merge decision** — no autonomous merge/deploy.
7. **Production observation** — after approval, compare expected versus actual telemetry.

## Near-term priority order

1. Finish V40.5i atomic six-person production canary and evaluate #171.
2. Keep the 50-agent capability fleet read-only against Resume/CV production.
3. Use Search/Candidate pods to benchmark provider yield and evidence quality.
4. Use Recruiter UX/Product/QA pods to make #172 implementation-ready.
5. After the canary, wire one staged public source at a time with source-attributed telemetry.
6. Add Inngest only as a thin transport once the framework-neutral contract is proven; do not replace the existing durable domain logic.
