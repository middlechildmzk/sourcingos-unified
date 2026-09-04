# SourcingOS MCP — V38.5

SourcingOS exposes a stateless, authenticated Model Context Protocol endpoint at `/api/mcp` so approved AI clients can reason over the same canonical Candidate Graph used by the recruiter workbench.

## Initial tool surface

- `search_people` — search recruiter-owned canonical candidates.
- `lookup_person` — resolve an existing person by name, professional URL, observed email, or observed phone.
- `get_candidate` — load the evidence-backed canonical dossier.
- `explain_candidate` — inspect evidence/provenance behind a candidate.
- `get_known_contacts` — read already-observed contact signals without triggering paid enrichment.

The first MCP surface is intentionally read-heavy. It does **not** expose identity merge, paid enrichment, outreach, rejection, hiring decisions, or autonomous ATS writes.

## Authentication

The endpoint accepts either:

1. the normal signed SourcingOS browser session; or
2. a Supabase access token in `Authorization: Bearer <token>`.

Bearer tokens are validated server-side with Supabase Auth. The caller never supplies an `owner_id`; every Candidate Graph query is scoped to the authenticated user.

## Transport

V38.5 uses stateless JSON-RPC over HTTP POST. It implements the core MCP lifecycle used by remote clients: `initialize`, `ping`, `tools/list`, and `tools/call`. GET/SSE is intentionally not enabled in this first release.

The server negotiates the supported protocol version requested by the client where possible and includes current and recent protocol eras for compatibility. A later tranche can replace the lightweight adapter with the official TypeScript SDK once the repository's TypeScript/Zod dependency floor is intentionally upgraded rather than forcing that dependency migration into this security-sensitive release.

## Trust boundaries

- Retrieval is not qualification.
- Missing evidence is not rejection evidence.
- Provider/source scores are not hiring scores.
- Known contact data is not permission to contact someone.
- The MCP endpoint never silently merges identities.
- Ambiguous identities stay separate until the existing recruiter-reviewed identity workflow resolves them.
- MCP search reads the owned Candidate Graph; it does not fan out to paid providers implicitly.

## Next MCP tranche

After V38.5 is production-proven, add explicit approval-aware operations for live federated search, contact enrichment, and save-to-role. Those operations should carry cost/action metadata and preserve the same human approval boundaries as the web product.
