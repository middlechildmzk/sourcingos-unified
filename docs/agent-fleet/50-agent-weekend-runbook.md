# SourcingOS 50-Agent Weekend Fleet — Control Plane

Status: **preview/research only**. This fleet must not touch the V40.5i production Resume/CV queue until the six-candidate canary has been merged, deployed, executed, and evaluated through the V40.5i scale gate.

## Purpose

Run one coordinated research fleet of exactly 50 bounded agents while preserving recruiter control and evidence truth. The fleet is split into five pods of ten agents:

1. **Search Intelligence (10)** — query strategy, provider yield, duplicates, weak-result patterns, provider benchmark.
2. **Candidate Intelligence (10)** — public professional evidence, Resume/CV identity precision, match explanations, requirement coverage, evidence gaps.
3. **Recruiter UX (10)** — current SourcingOS screens plus the competitive review/walkthrough into V40.6 list/detail recommendations.
4. **Product & Engineering (10)** — component reuse, technical debt, responsive/accessibility checks, implementation mapping.
5. **QA & Red Team (10)** — break interpretation, identity, evidence, contacts, mobile behavior, provider failures, and release gates.

The coordinator is the control plane, not a 51st model worker.

## Connected web / workflow resources

The fleet recognizes the following server-side environment variables without exposing their values:

- `EXA_API_KEY` — existing SourcingOS Exa baseline.
- `VERCEL_EXA_EXA_API_KEY` — separate Vercel Marketplace Exa challenger.
- `FIRECRAWL_API_KEY` — Firecrawl Search challenger.
- `PARALLEL_API_KEY` — Parallel Search challenger.
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — connected Inngest environment.

Provider presence means **configured**, not proven. A provider becomes operational only after a real controlled request succeeds and telemetry confirms the response.

## Hard release gates

Defaults:

```text
AGENT_FLEET_ENABLED=false
AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED=false
AGENT_FLEET_ALLOW_PRODUCTION_RESUME_QUEUE=false
```

The control plane additionally hard-blocks `production_resume_queue` even if someone sets the last variable true. This is deliberate until V40.5i's first production canary is evaluated.

The V40.5i canary path remains unchanged:

```text
Serper exact -> Exa semantic/public web -> Bright Data optional fallback
```

Firecrawl and Parallel do not participate in that baseline canary.

## Inngest transport

`POST /api/agent-fleet/dispatch` is admin-only and emits exactly 50 idempotent `sourcingos/agent-fleet.task.requested` events when `AGENT_FLEET_ENABLED=true`.

Each event contains the pod, task id, bounded prompt, and explicit `readOnly/publicEvidenceOnly/productionResumeQueueAllowed=false` flags. Branch deployments send the current Vercel Git branch through `x-inngest-env` so preview traffic does not silently target the main environment.

This slice is the **fleet control plane and event transport**. It intentionally does not introduce the Inngest SDK or a long-running production executor into the V40.5i release branch. Register durable consumers as a separate activation change after the V40.5i canary so the existing locked npm dependency graph and production queue semantics are not changed underneath the canary.

## Provider tournament

The provider adapter supports a deliberately gated tournament across:

```text
existing Exa
Vercel-managed Exa
Firecrawl Search
Parallel Search
```

Enable only for a small named research cohort:

```text
AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED=true
```

The initial adapter caps each request at 10 results, runs providers sequentially for spend attribution, strips duplicate URLs, rejects non-HTTPS/private/local URLs, and rejects LinkedIn URLs entirely. It records request count, latency, status, and returned public URLs. Do not infer candidate truth from a search result alone.

Recommended benchmark metrics: legitimate Resume/CV yield, unique useful URLs/request, wrong-person or identity-ambiguity rate, duplicates, fetch success, latency, and cost estimate.

## Source of truth for weekend work

Agents should ground findings in the current repo and, where applicable:

- `docs/competitive-intelligence/2026-09-04-recruiting-platform-ux-review.md`
- GitHub issue #171 — V40.5i post-canary scale gate and provider benchmark
- GitHub issue #172 — V40.6 recruiter list/detail candidate workbench

## Expected consolidated deliverable

`V40.5 verified search intelligence + V40.6 implementation-ready UX spec + prioritized defects + agent consensus + exact build sequence`

No pod may send outreach, enrich contacts merely by opening a profile, make hiring/rejection decisions, silently merge identities, bypass restricted sites, or promote discovery terms into candidate evidence.
