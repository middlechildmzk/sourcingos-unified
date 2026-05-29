# SourcingOS Unified V17.2

SourcingOS V17.2 combines:

- Next public SEO shell
- interactive free sourcing tools
- source connector layer
- persistent Candidate Graph architecture
- private beta bridge
- Vite Core cockpit preserved as the local/private app layer

## V17.2 highlights

The source connector layer now normalizes public evidence from:

- GitHub
- Stack Overflow / Stack Exchange
- OpenAlex
- NPI Registry
- ORCID
- Semantic Scholar
- arXiv
- PubMed
- Hugging Face
- npm
- PyPI

The Candidate Graph now supports:

- saving candidate graph previews
- source profile persistence model
- explicit recruiter merge decisions
- manual refresh
- scheduled refresh route scaffold
- Supabase/Postgres production schema

## Run the Vite bridge

```bash
npm install
npm run qa
npm run build
npm run dev
```

## Run the Next public shell

```bash
cd next-public
npm install
npm run build
npm run dev
```

Open:

```text
http://localhost:3000/
```

## Candidate Graph API routes

```text
POST /api/sources/search
POST /api/sources/refresh
POST /api/candidates/save
GET  /api/candidates/list
POST /api/candidates/merge
POST /api/candidates/refresh
POST /api/candidates/scheduled-refresh
```

Preview persistence uses an in-memory adapter. Production persistence should use:

```text
next-public/sql/candidate-graph-schema.sql
```

## Guardrails

- No auto-merge at any confidence level.
- Recruiter confirms or rejects linked source profiles.
- Contact signals are unverified until manually checked.
- NPI is a provider/specialty signal, not outreach permission.
- Research/publication sources identify evidence, not availability.
- No automated outreach.
