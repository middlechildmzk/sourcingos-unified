# V28.1 Product Truth Implementation

## Purpose

V28.1 corrects the central SourcingOS workflow so that recruiters see candidate people first, non-person source subjects remain explicitly separated, and persistence fails closed when identity or data writes are uncertain.

This work is code-only. It does not apply a production migration, mutate production data, merge a branch, or promote a deployment.

## Starting point

- Repository: `middlechildmzk/sourcingos-unified`
- Base branch: `v28-feedback-search-results-ux`
- Base SHA: `7f768eb70434e198869565942270a8f15f7e79f0`
- Reconstruction branch: `v28-1-product-truth-reconstruction`

## Implemented corrections

### Explicit source subject classification

SourcingOS now recognizes these subject types:

- `person`
- `organization`
- `artifact`
- `publication`
- `search_lane`
- `unknown`

The public search API classifies every source result before it enters the recruiter UI. Candidate actions are available only for `person` records.

Connector policy:

| Source | Default subject treatment |
| --- | --- |
| GitHub | API `User` is person; API `Organization` is organization; otherwise unknown |
| Stack Overflow | person |
| OpenAlex | person |
| ORCID | person |
| Semantic Scholar | person |
| arXiv | person supported by publication evidence |
| PubMed | person supported by publication evidence |
| NPI Registry | NPI-1 is person; NPI-2 is organization |
| DEV Community | unknown unless a future trusted rule establishes personhood |
| npm | artifact |
| PyPI | artifact |
| Docker Hub | artifact |
| crates.io | artifact |
| RubyGems | artifact |
| Hugging Face models | artifact |
| Kaggle search | search lane |
| Resume X-Ray | search lane, except authorized legacy LinkedIn connection imports |

### Legacy LinkedIn import compatibility

Production inventory established that 27,294 source-profile rows labeled `resume_xray` are authorized LinkedIn connection imports with:

- `raw.importType = 'linkedin_connections'`
- `raw.importSource = 'linkedin_export'`

The application now resolves those rows as people at read time. No production records were rewritten.

### Candidate-first search hierarchy

The Results surface now renders in this order:

1. Compact search progress
2. Candidate people
3. Supporting source subjects
4. Source coverage and retry controls
5. Market-map and advanced diagnostics

Source diagnostics remain collapsed while search results stream.

### One public search entry point

The public Candidate Search page now contains one Workbench search experience. The separate V2.5 builder, DOM-driven composer handoff, duplicate public composer banner, and large trust-layer block were removed from the page.

### Search-run isolation

Each search owns:

- a unique run identifier
- an AbortController
- current-run checks before state writes

Starting a new search cancels the previous run. A delayed response from an older search cannot append results, update lane states, replace diagnostics, or end the newer loading state.

### Person-only, idempotent save

The source-profile save route now:

- rejects non-person subjects with HTTP 422
- looks up source profiles by owner, source, and source-profile ID
- reuses an existing canonical candidate
- creates a candidate only when no candidate link exists
- uses a guarded candidate link update
- reconciles concurrent saves
- checks every required database error
- avoids repeated evidence and contact rows
- fails closed on role-association failure

Candidate identity remains pending recruiter review. No automatic merge or verification is introduced.

### One Today

`/app/agent-os` permanently redirects to `/app/today/`. Agent OS was removed from navigation. Today is the single recruiter decision inbox.

### Accessibility

Candidate rows use semantic links and buttons instead of simulated row buttons with nested interactive controls.

The Candidate Drawer now provides:

- modal semantics
- labelled dialog title
- initial focus
- focus containment
- Escape-to-close
- focus restoration
- body-scroll lock
- no active closed-drawer content

## Guardrails preserved

- No fabricated candidates or contacts
- No protected-class inference
- No silent identity merge
- No autonomous outreach
- No verified-clearance implication
- No verified-availability implication
- Public contact signals remain unverified
- Provenance remains inspectable
- Recruiter confirmation remains required
- Production database remains unchanged
