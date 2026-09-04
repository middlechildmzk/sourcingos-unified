# V39.1 — SourcingOS Intelligence Fabric

## Purpose

V39.1 turns the existing Candidate Graph, provider orchestration, MCP surface, search-quality telemetry, and evidence controls into one governed intelligence substrate. Natural-language AI, MCP clients, the recruiter workbench, future Chrome surfaces, background workers, and graph retrieval must share the same contracts and trust boundaries rather than inventing parallel implementations.

## Canonical architecture

1. **Supabase is the canonical source of truth.** Candidate Graph identity, recruiter state, source provenance, evidence, contacts, source rights, and durable search documents remain canonical in Supabase.
2. **Neo4j Aura is a derived search graph.** Only rights-approved normalized canonical entities/evidence may be projected. No silent identity merge, no broad contact-value projection, and no raw provider payload projection by default.
3. **Owned graph first.** People retrieval searches the recruiter-owned SourcingOS graph before selectively spending on external discovery.
4. **Provider routing is not candidate ranking.** Provider selection may consider capability, health, entitlement, freshness, bounded fan-out, historical yield, and cost. It must never become a hiring or qualification score.
5. **MCP and embedded AI share governed tools.** The first shared surface is deliberately read-heavy: search people, known-person lookup, candidate dossier, evidence explanation, and already-known contacts. Paid enrichment and mutating actions remain outside this authority class.
6. **Provider failures are not zero results.** Configuration, entitlement, credits, runtime health, and actual zero-result searches remain separate states.
7. **External terms stay explicit.** Unknown rate limits, cost units, retention rights, and storage rights remain unknown until audited. API-key presence is not evidence of entitlement or rights.

## V39.1A — foundation in this branch

- richer Provider Capability Registry layered on the current provider registry and V38 health taxonomy;
- owned-first Smart Tool Router with bounded external fan-out and explicit contact-reveal approval;
- one tool-contract registry used by MCP and reserved for the embedded AI core;
- deterministic Reciprocal Rank Fusion across lexical, structured, graph, and vector lanes;
- rights-aware Neo4j projection packet contract and configuration status;
- Vercel AI Gateway runtime-auth status with API-key or Vercel OIDC detection and no secret exposure;
- deterministic trust-boundary tests.

### Deliberately not claimed complete in V39.1A

- **AI SDK runtime execution:** the current repository does not yet include the `ai` package. `package.json` and `package-lock.json` must be upgraded atomically before `npm ci` can safely use it. Until that dependency gate is complete, Gateway authentication can be detected but `aiSdkRuntimeIntegrated` remains `false`.
- **Neo4j network writes:** projection packets are built but no graph write is executed until Aura credentials and the durable projection worker are configured.
- **Vercel Workflows/Queues:** deferred to V39.1B so contact waterfalls, provider callbacks, graph projection, and refresh work receive explicit retry/idempotency contracts.
- **New paid provider operations:** provider expansion is V39.1C. Planned operations are catalogued but are not treated as executable.

## Vercel AI Gateway

The Vercel team may be ready for AI Gateway while the application itself is not yet wired to the AI SDK. In Vercel-hosted runtime, Gateway authentication can use `VERCEL_OIDC_TOKEN`; an explicit `AI_GATEWAY_API_KEY` may still be used for local development or key-scoped spend controls. SourcingOS must never return or log either credential.

Default model target for the upcoming AI SDK slice: `openai/gpt-5.6-sol`, overrideable with `AI_GATEWAY_MODEL`.

## Neo4j Aura configuration

When Aura is provisioned, add server-only values to the SourcingOS Vercel project rather than committing or pasting them into application code:

- `NEO4J_QUERY_API_URL`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE` (defaults to `neo4j`)

If those values are absent, the projection layer reports `configured: false` and performs no network write.

## Next slices

### V39.1B — Durable Intelligence

Vercel Workflows/Queues for contact waterfalls, callbacks, Neo4j projection, refresh subscriptions, and background research; idempotency, retries, bounded concurrency, job visibility, and cost telemetry are mandatory.

### V39.1C — Provider Capability Expansion

Audit and activate underused provider capabilities beginning with CoreSignal subscriptions, Pearch precision search, OpenWeb Ninja, richer DataVertex operations, ContactOut Count/Enrich, and Serper Scholar/Patents. Every activation must record entitlement, rate limits, cost model, storage/retention rights, runtime health, and recruiter approval boundaries.

### V39.2 — Graph Intelligence

Neo4j traversal + native vectors joined with owned lexical/structured retrieval using RRF/reranking. No Qdrant unless measured retrieval needs later justify a second vector system.

### V39.3 / V40

Thin Chrome client against the same Intelligence Fabric, then Talent Radar, lookalikes, career transitions, skill adjacency, relationship search, continuous refresh signals, and GraphRAG.

## Non-negotiable trust boundaries

Retrieval is not qualification. Provider result is not fit. Missing evidence is not rejection. Search expansion is not candidate evidence. Company evidence does not silently become person evidence. Clearance, location, credentials, and tenure are not inferred without evidence. No protected-attribute ranking. No silent identity merge. No autonomous outreach, hiring, rejection, or stage movement. Paid contact reveal requires explicit recruiter-controlled approval. Secrets never belong in browser payloads, logs, URLs, source control, or model context.
