# SourcingOS V33.4 — Multi-Model Product Review Synthesis

Date: 2026-08-31

## Purpose

This document converts the August 2026 independent AI product reviews into one product decision record. The reviews are useful inputs, not ground truth. Several reviewers only saw the public site or strategy brief and therefore described already-built private-beta capabilities as missing or hypothetical. Recommendations are accepted only when they survive comparison with the current repository, V33.4 behavior, and SourcingOS trust rules.

## Source reliability

### High confidence for current SourcingOS state
- Reviews that inspected getsourcingos.com plus the public repository, architecture docs, Candidate Graph, connectors, Candidate 360 examples, and trust model.
- Current repository and release tests remain authoritative.

### Useful for market/UX patterns, low confidence for SourcingOS implementation state
- Reviews that explicitly lacked private-beta or repository access.
- Competitor workflow observations are useful as hypotheses; claims about SourcingOS being missing, UI-only, or prompt-chain-only are not accepted without repo verification.

## Consensus that survives verification

### 1. One agent experience, not exposed subsystems
The recruiter should describe the hiring need naturally, confirm the interpretation, and start sourcing. Role Brain, Search Brain, Candidate Graph, Evidence Ledger, identity resolution, domain intelligence, and calibration should coordinate behind the interface.

V33.4 already implements the main correction:
- prompt-first Roles landing;
- compact confirmation;
- optional structured fields;
- one Start sourcing authorization for the initial research pass and unreviewed slate;
- detailed execution behind progressive disclosure;
- one three-pane role workbench.

### 2. Evidence is the primary candidate artifact
Candidate review should be structured, source-linked, and auditable. Generic LLM prose and unexplained ranking should not be the product.

SourcingOS keeps four evidence states:
- Supported
- Contradicted
- Needs verification
- Unknown

Unknown is not a negative finding. Search criteria are not candidate evidence. Candidate 360 should remain proof-first rather than score-first.

### 3. The moat is the intelligence loop, not database size
Build and own:
- natural-language role understanding;
- versioned Role Brief;
- multi-hypothesis Search Brain;
- evidence chain / Candidate 360;
- Candidate Graph identity and provenance;
- recruiter/HM calibration;
- role-family / institutional recruiting memory;
- domain intelligence for difficult technical, federal, cleared, military/veteran, research, and other evidence-rich niches;
- source-agnostic orchestration and source-truth boundaries.

Do not try to win on the size of a proprietary people index.

### 4. Feedback must visibly change recommendations without silently changing truth
Recruiter decisions should create explainable proposed learning. A repeated reason such as "too hands-on" should eventually produce a visible proposal such as:

> Your recent No decisions consistently describe implementation-heavy backgrounds. Proposed next-search change: emphasize architecture ownership signals and review implementation-heavy lanes.

The recruiter approves or rejects the learning. Search-lane changes remain separately approval-gated. Candidate evidence is never rewritten by calibration.

### 5. SourcingOS should answer sourcing questions, not merely return names
High-value intelligence includes:
- which requirement is constraining the observed slate;
- which search angle is yielding unique identities;
- adjacent titles, backgrounds, employers, communities, or military pathways worth testing;
- what changed since the last pass;
- which candidates need review or evidence resolution;
- what the system learned from recruiter/HM decisions;
- where evidence is weak or a source is degraded.

Market-size, compensation, supply/demand, and intent claims require appropriate data. Until then, use observed search/yield evidence and clearly label limitations.

### 6. Coordinate multiple agent capabilities behind one surface
Useful agent responsibilities can exist internally—sourcing, research, candidate intelligence, calibration, data quality, market intelligence, pipeline refresh—but the UI should not become a multi-bot control room.

## Accepted now — V33.4 quality integration

### Sourcing Desk
Roles home should answer:
1. What needs attention?
2. What changed?
3. What recruiter-approved learning is now available?

The surface must derive only from persisted role state: draft briefs, pending calibration, evidence conflicts, waiting candidates, proposed search angles, recent activity, and approved learning. No fabricated market numbers or AI qualification ranking.

### Visible calibration proposal
When candidate decisions generate a proposed calibration insight, surface it in the main role flow. Show:
- pattern statement;
- confidence category;
- supporting and contradicting decision counts;
- counter-signal if present;
- the search-lane recommendation that would become available if approved;
- explicit approval/rejection controls.

Approval of learning does not itself change a search lane.

## Next after V33.4 acceptance

### V33.4.x — Faster structured review
- Add quick recruiter reason chips for No/Maybe decisions: Too hands-on, Too junior, Too senior, Wrong domain, Wrong geography/work mode, Explicit requirement conflict, Other.
- Preserve free-text reason.
- Reasons are recruiter decisions, never candidate facts.
- Add one compact source-linked evidence signal to each slate row so the recruiter can understand why a candidate was surfaced without opening the full 360.

### V33.4 / V34 — Recruiting Memory + Standing Search
Create durable server-side search memory:
- SearchRun / source attempt history;
- canonical already-seen identities;
- new-since-last-pass detection;
- changed-evidence detection;
- approved standing-search definitions;
- bounded scheduled reruns on eligible sources;
- no duplicate candidate resurfacing unless materially changed;
- recruiter/HM feedback reasons → proposed calibration deltas;
- role-family memory only after explicit scope approval.

### V33.5 — Adjacent Talent Intelligence
Start narrow and evidence-backed rather than building a universal ontology:
- technical/federal title families;
- company adjacency from observed career transitions and authorized ATS history;
- skill co-occurrence from public technical artifacts;
- architecture-vs-implementation signals;
- military occupational pathways integrated into normal role search;
- explainable adjacent-search hypotheses with failure modes.

### V33.5+ — Cross-role Candidate Intelligence
Use Candidate Graph to answer:
- Which other active roles might this canonical candidate be worth reviewing for?
- Which prior candidates should be rediscovered when a similar role opens?
- Which reusable talent community should this candidate belong to?

Any cross-role recommendation remains a recruiter review suggestion, not an automatic disposition.

## Build vs integrate vs partner

### BUILD — core differentiation
- Role/Search intelligence loop
- Candidate evidence and provenance
- Recruiter/HM calibration and institutional memory
- Candidate Graph / identity proposal logic
- domain intelligence and military translation
- source quality / health / yield telemetry
- standing-search orchestration
- audit trail and human-approval semantics

### INTEGRATE
- ATS/CRM systems such as Avature, Greenhouse, Lever, Ashby, Workday
- email/sequencing transport if/when outreach ships
- scheduling if needed later
- enterprise identity/SSO infrastructure

### PARTNER / API
- licensed people/profile data
- contact enrichment
- labor-market / compensation datasets
- specialized vertical datasets where public evidence is insufficient

### IGNORE / DEFER
- building a 1B-profile database from scratch
- unauthorized LinkedIn or restricted-source scraping
- full ATS replacement
- interview intelligence platform
- payroll/HRIS
- multi-bot UI
- heavy analytics before the core loop is measured
- autonomous outreach/send

## Explicitly rejected recommendations

Some reviews proposed patterns that conflict with SourcingOS product rules. Do not implement:

- opaque 0–100 fit or match percentages presented as qualification truth;
- public-evidence "verified clearance" or clearance inference as fact;
- automatic rejection/shortlisting from a model score;
- automatic search mutation directly from thumbs-up/down without recruiter approval;
- search criteria becoming candidate facts;
- taxonomy hints silently becoming recruiter requirements;
- silent cross-source identity merge;
- protected-attribute inference;
- autonomous outreach;
- brittle/unauthorized scraping to imitate incumbent data scale.

## Product wedge

The durable positioning is not "another AI sourcing database."

> SourcingOS understands a difficult role, plans multiple ways to find the talent, investigates evidence across the sources you are allowed to use, shows exactly what is known and unknown, learns from recruiter and hiring-manager decisions, and improves the next search without taking hiring decisions away from people.

For hard technical/federal/cleared searches, the aspirational proof point is:

> Other tools can find profiles that mention a technology. SourcingOS should help a recruiter distinguish implementation from architecture depth, uncover adjacent and military pathways, explain the evidence, and learn why the hiring team said yes or no.

That claim must remain evidence-backed and measurable.

## Product metrics

Measure the loop, not feature count:
- time from natural-language brief → first reviewable slate;
- time → first useful Candidate 360;
- evidence coverage per must-have;
- unknown/verification distribution;
- unique canonical identities per search angle;
- duplicate/already-seen rate;
- recruiter review throughput;
- percentage of calibration proposals approved/edited/rejected;
- measurable relevance change after approved calibration;
- new useful candidates per standing-search rerun;
- HM forward/interview rate for recruiter-approved candidates;
- source request cost and failure/degraded-source rate.

## Release sequencing

1. Finish and visually validate V33.4 prompt-first + unified workbench + Sourcing Desk + visible learning.
2. Merge only after recruiter acceptance testing.
3. Harden direct orchestration so Start sourcing calls a shared execution boundary rather than relying on UI-button discovery.
4. Finish credential/source-health work and activate stronger technical connectors behind benchmarks.
5. Build durable Recruiting Memory + Standing Search.
6. Add adjacent/cross-role intelligence from evidence and authorized history.
7. Add ATS/provider integrations before investing in commodity enrichment or outreach infrastructure.
8. Add approval-gated evidence-grounded outreach drafts only after discovery/review quality is trustworthy.
