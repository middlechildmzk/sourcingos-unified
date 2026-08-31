# V33.4 — Unified Role Workbench

## Product goal

V33.4 turns the existing Role Brain, Search Brain, Candidate Graph, Evidence Ledger, Identity Brain, review slate, and calibration system into one recruiter-facing workspace instead of exposing them as a stack of separate modules.

The default desktop model is:

`Role + agent context | Review slate | Candidate 360`

The interaction loop is:

`Describe → approve Role Brief → approve search angles → source → resolve/investigate → create review slate → review → propose calibration → recruiter approves changes`

The loop itself is not treated as the moat. The product contract inside the loop is:

- search criteria never become candidate facts;
- every displayed candidate claim retains source provenance;
- missing evidence stays Unknown, not Failed;
- verification-gated requirements remain verification-gated;
- recruiter-defined disqualifiers are surfaced as review conflicts, never silent rejection rules;
- cross-source identities do not silently merge;
- recruiter feedback can propose search changes, but cannot rewrite source truth;
- no automatic outreach, shortlist, rejection, or hiring recommendation is introduced by this workbench.

## Role Brief artifact

A Role Brief is now a versioned recruiter artifact.

An approved version contains:

- title and geography;
- work mode;
- must-haves;
- preferred criteria;
- recruiter-defined disqualifiers;
- target companies and adjacent backgrounds;
- clearance/credential context;
- hiring-manager context;
- visible SourcingOS interpretations.

Editing an approved Role Brief creates a **draft version**. The approved intake and executable Search Plan remain unchanged until the recruiter explicitly approves the draft. Approval then regenerates search angles as **proposed**, not approved, so a brief edit never silently authorizes new source spend.

Older role workspaces without V33.4 metadata receive a read-compatible synthetic v1 view. New V33.4 roles persist the version history through the canonical role-workspace normalizer and account sync payload.

## Visible interpretations

SourcingOS states consequential interpretations before search rather than making them silently. Current deterministic interpretation notes include:

- source truth: retrieval terms are not candidate facts;
- geography: only the recruiter-provided geography is binding; no commuting radius is invented;
- work mode when present;
- clearance/credential context as verification-gated;
- disqualifiers as recruiter-defined conflicts, never auto-rejections.

## Search-angle progress

Canonical Search Plan hypotheses are rendered as live progress rather than internal lane IDs.

States:

`proposed → planned → searching → assessing → complete`

`failed` and `paused` remain visible.

Per-lane yield comes from actual SearchAttempt result keys. This is source contribution telemetry, not an activity animation or fit score.

## Dense review slate

The center pane is optimized for repeated recruiter review rather than marketing-card presentation.

Each candidate row may show:

- identity/context;
- source;
- must-have evidence coverage;
- verification count;
- Unknown count;
- contradiction count;
- recruiter-defined disqualifier review flags;
- explicit recruiter decision.

It deliberately does **not** show an opaque percentage match.

## Inline Candidate 360

The right pane keeps candidate review in context. It renders requirement-by-requirement evidence using the existing four-state model:

- Supported
- Contradicted
- Needs verification
- Unknown

Evidence is rendered inline with numbered source markers and source links. Recruiter context is visually separated from source evidence. Candidate Graph remains the canonical backing store.

## Keyboard triage

When focus is not in an editable control:

- `J` — previous candidate
- `K` — next candidate
- `Y` — recruiter marks Yes / strong fit
- `M` — recruiter marks Maybe / possible fit
- `N` — opens No reason capture
- `?` — shortcut help

A No decision requires a recruiter-entered reason. Unknown evidence is not automatically suggested as a rejection reason. A contradicted must-have or recruiter-defined disqualifier may be offered as editable context, but the recruiter must confirm the reason.

These decisions remain role-specific recruiter decisions. They do not alter source evidence.

## Quantified calibration

V33.4 exposes the existing minimum sample of three reviewed candidates as an explicit transaction:

`Review N more candidates before SourcingOS proposes a calibration revision.`

Once the sample exists, the user is routed to proposed calibration. Search changes remain approval-gated.

## Slate gap analysis

The workbench aggregates four-state requirement assessments across the slate and identifies the **most evidence-constrained must-have**.

Example shape:

> Secret clearance is currently the most evidence-constrained must-have: 3/47 candidates have supporting evidence, 12 need verification, and 32 remain unknown.

This is not candidate ranking. It is a role-level explanation of where the evidence/search constraint lies. Suggested next moves are informational and require recruiter action.

## Mid-flight controls

The agent pane separates four intents:

- Fetch more — continue approved search angles;
- Update search — create a draft Role Brief revision;
- Refresh evidence — reassess saved Candidate Graph evidence;
- Filter candidates — change only the review view.

The separation prevents a request for more candidates from silently changing evaluation criteria.

## Competitor-informed patterns deliberately refused

V33.4 does not adopt:

- opaque fit percentages;
- two-state green-check/red-X treatment where missing evidence looks like failure;
- behavioral response-likelihood or demographic sourcing filters;
- countdown pressure on approval decisions;
- search-term-to-candidate-skill contamination;
- silent cross-source identity merging.

## Progressive disclosure

The unified workbench is the default role surface. Existing advanced controls remain available below it for:

- individual-source inspection;
- advanced Search Brain details;
- military intelligence review;
- canonical guided search actions;
- calibration/pipeline controls;
- paste-back and activity.

The intent is to hide system seams without deleting expert controls or source transparency.

## Regression gates

V33.4 tests must prove:

1. clearance interpretation remains verification-gated;
2. search criteria are explicitly separated from candidate facts;
3. disqualifiers never become auto-rejection rules;
4. draft Role Brief changes do not change approved intake/search authorization;
5. approved revisions regenerate search angles as proposed;
6. Role Brief versions survive normalization;
7. lane yield derives from observed result keys;
8. calibration asks for a measured review sample;
9. Unknown and Contradicted remain separate in gap analysis;
10. the workbench exposes keyboard review and evidence coverage without reintroducing a fit score.
