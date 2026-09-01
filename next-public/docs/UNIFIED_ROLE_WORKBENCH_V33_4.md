# V33.4 — Unified Role Workbench

## Product thesis

SourcingOS should feel like one sourcing agent, not a collection of internal systems. The recruiter describes who they need, confirms what SourcingOS understood, and the agent starts. Role Brain, Search Brain, Candidate Graph, Evidence Ledger, identity resolution, calibration, and source telemetry remain underneath that experience.

## Default recruiter loop

**Describe → Confirm → Source → Review → Learn → Search again**

### 1. Describe
The Roles page opens directly on one natural-language prompt: **Who are you looking for?** One or two sentences are enough; a full JD is supported.

### 2. Confirm
SourcingOS parses the request server-side with the configured AI provider and a deterministic fallback. The default confirmation is compact: role, must-haves, preferred criteria, location/work mode, verification-gated constraints, disqualifiers, and the planned search-angle count. Structured fields remain under **Edit details** rather than blocking setup.

Follow-up questions are reserved for ambiguities that would materially change who gets searched. Missing optional information is not a blocker; the agent can use the first talent pool for calibration.

### 3. Start sourcing
The recruiter's **Start sourcing** click is the explicit authorization for the initial search pass and creation of an unreviewed review slate. It approves the generated initial search angles for that pass, launches the existing canonical sourcing agent, and reuses the existing Candidate Graph persistence boundary.

That authorization does **not** shortlist, reject, merge cross-source identities, verify clearance, or contact anyone.

### 4. Unified workbench
The role opens as a dense three-pane workspace:

- **Left:** what SourcingOS understood, interpretations, search progress/yield, calibration state.
- **Center:** review slate with evidence coverage, gap analysis, and fast triage.
- **Right:** Candidate 360 with requirement-by-requirement evidence and provenance.

Detailed source execution, Search Brain internals, military intelligence controls, pipeline administration, paste-back, and activity remain available through progressive disclosure.

### 5. Evidence-first review
SourcingOS refuses opaque fit percentages. The review surface uses four evidence states:

- Supported
- Contradicted
- Needs verification
- Unknown

Missing evidence is not treated as a red X. Search criteria retrieve candidates but never become candidate facts.

### 6. Recruiter decisions
Keyboard review supports J/K navigation and Y/M/N decisions. A No decision requires a recruiter reason. Recruiter decisions may inform proposed calibration, but they do not rewrite evidence.

### 7. Learning and gap analysis
After enough recruiter decisions, SourcingOS may propose a search-plan revision. The recruiter approves changes. Slate Gap Analysis identifies evidence-constrained must-haves and recommends possible next moves without changing role criteria or candidate decisions automatically.

## Role Brief artifact

The underlying Role Brief remains versioned and recruiter-controlled even though the default UI keeps it quiet.

- Initial confirmation creates approved Role Brief v1.
- Editing an approved brief creates a draft without changing the approved intake/search.
- Approving a staged revision applies it and regenerates search hypotheses as `proposed`.
- Later revisions do not silently authorize new search spend.

## Trust boundaries

- Autonomous research. Human hiring decisions.
- Search criteria never become candidate evidence.
- Unknown remains unknown.
- Clearance/citizenship/credentials remain verification-gated.
- Cross-source identity never silently merges.
- No auto-reject, auto-shortlist, or auto-outreach.
- Provenance survives Candidate 360 consolidation.
- Contradictions remain visible.

## Screenshot-informed UX principles

The V33.4 interaction model synthesizes the strongest observed patterns from Foundire, hireEZ, Metaview, Wrangle, and Juicebox:

- Foundire: dramatically simple natural-language entry.
- hireEZ: machine-parsed criteria, but without forcing recruiters to operate every field.
- Metaview: agent + live candidate pack, inline candidate context, fast feedback.
- Wrangle: dense three-pane review workspace.
- Juicebox: visible agent progress and persistent learning/context.

SourcingOS differentiates inside that converging interaction model through provenance depth, honest unknowns, source-truth boundaries, canonical identity resolution, four-state requirement evidence, and slate-level gap analysis.

## Regression gates

V33.4 tests must prove:

1. the default Roles page opens directly on the natural-language prompt;
2. AI parsing is authenticated and has a deterministic fallback;
3. the default confirmation is compact and structured fields are optional;
4. Start sourcing is the one explicit authorization for the initial search/review-slate pass;
5. clearance interpretation remains verification-gated;
6. search criteria are explicitly separated from candidate facts;
7. disqualifiers never become auto-rejection rules;
8. draft Role Brief changes do not change approved intake/search authorization;
9. approved later revisions regenerate search angles as proposed;
10. Role Brief versions survive normalization;
11. lane yield derives from observed result keys;
12. Unknown and Contradicted remain separate in gap analysis;
13. the workbench exposes keyboard review and evidence coverage without reintroducing a fit score.
