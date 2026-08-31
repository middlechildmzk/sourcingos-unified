# V33 — Military Talent Intelligence

Occupation-level intelligence for sourcing military and veteran talent. Built on `main` at `48a32c4`, branch `v33-military-talent-intelligence`.

## The boundary this feature exists to hold

> A military occupation code tells you where to look and why. It never tells you what a specific person can do.

Occupation associations expand a search, seed a lane, and give a recruiter context. They may never produce or upgrade a candidate-level `RequirementAssessment`. That remains the exclusive job of span-backed `EvidenceClaim`s in the V32 path. `militaryContextFromSpan` returns `requirementSupport: never[]`, typed empty, so the compiler enforces it.

## Capability map

| Capability | Status | Decision |
|---|---|---|
| O*NET occupation intelligence | EXISTS — `lib/onet-role-intelligence.ts`, `app/api/role-intelligence/onet/route.ts` fetching `onetcenter.org/dl_files/database/db_31_0_json` with a 7-day cache | SHOULD REUSE the fetch-and-cache pattern, and the attribution string form |
| Military crosswalk | MISSING | Implemented here |
| Domain packs | EXISTS — `lib/domain-packs-v31.ts`, confidence-based composition | SHOULD EXTEND later; V33 does not modify it |
| Bounded term matching | EXISTS — `containsBoundedTerm` in `lib/evidence-span.ts` | REUSED. No second matcher was written |
| Search lanes | EXISTS — `lib/agentic-search-v30.ts`, `SearchExecutionMode` | V33 emits lane *drafts* in the same vocabulary; it does not construct plans |
| Requirement assessment | EXISTS — V32 | SHOULD NOT DUPLICATE. Untouched |
| Query construction | EXISTS — `lib/search-query-builder.ts` | Lane drafts carry bounded query strings; wiring into the planner is next iteration |

Nothing in V32, the domain packs, the evidence ledger, or any component was modified.

## Data source research

| Source | What it gives | Access | Licence | Verdict |
|---|---|---|---|---|
| **O*NET Military Crosswalk (MOC)** | Military code → O*NET-SOC links, by branch, active and obsolete codes | Downloadable ZIP (MS Access, XLSX, CSV) from the Crosswalk Files page, updated August 2024 | CC BY 4.0 | **Primary source.** Combines the DMDC MOC crosswalk, the VOW to Hire Heroes Act §222 enhanced analysis, and RAND Army KSA research |
| O*NET Web Services military crosswalk | Same data over an API, with branch filter and an `active` parameter | `services.onetcenter.org` / `api-v2.onetcenter.org`, requires registration | CC BY 4.0 | Not used. The repo already made the deliberate decision to avoid API-key transport for O*NET |
| DMDC military-civilian crosswalk | Military → SOC and O*NET, quarterly | workforceinfodb.org | Public | Upstream of the O*NET file. Use only if quarterly freshness proves necessary |
| My Next Move for Veterans | The consumer-facing transition search | Web UI | — | Reference for expected behaviour, not a data source. Do not scrape |
| CareerOneStop | Veteran-facing tooling and APIs | API registration | Terms vary | Evaluate next iteration |
| BLS OEWS | Wage context joined on SOC | Public download | Public domain | Next iteration, for market intelligence |
| ESCO crosswalk | International skill translation | O*NET Crosswalk Files | CC BY 4.0 | Only if non-US roles become real |

**Not done and honestly flagged:** the official MOC file was not downloaded. The build sandbox's network allowlist does not include `onetcenter.org`, so the import pipeline is implemented and unit-tested against representative rows, but has not been run against the real file.

## What ships

**`lib/military-talent-intelligence-v33.ts`** — model and engine. `MilitaryOccupation`, `CivilianOccupation`, `MilitaryCivilianCrosswalk`, `TaxonomyProvenance`, six branches with their code systems, and service category including warrant officer. Bidirectional: `translateMilitaryToCivilian` and `buildMilitarySourcingHypothesis`. Also `militaryLaneDrafts` and `militaryContextFromSpan`.

**`lib/military-crosswalk-import-v33.ts`** — normalizes official MOC rows into the model. Groups multi-row occupations, derives canonical titles by stripping the `(Army - Enlisted)` suffix while keeping the raw title as an alternate, infers service category from the title when the column is absent, skips unmappable rows rather than guessing, and stamps verified provenance. `mergeWithSeed` lets official records win field by field while preserving seed enrichment.

**`data/military-occupations-seed-v33.ts`** — 13 provisional occupations across all six branches, 11 civilian occupations. **Every record is `verified: false` on purpose.** They were written from general public knowledge and have not been reconciled against the official file. `provisionalDataInUse` propagates into every hypothesis so the UI can say so.

**`tests/v33-military-talent-intelligence.test.ts`** — 51 tests.

## Design decisions worth knowing

**A job title alone cannot open a military lane.** The role's own requirements must carry the threshold; the title is additive context. Without this, "Analyst" plus "research" opened an intelligence lane, which is noise dressed as insight. The test that caught it is still in the suite.

**The candidate context object carries the matched code only, never the surrounding span.** Source text around an occupation code routinely contains rank, discharge characterization, service dates and age. None are qualification signals and several are protected-adjacent. Minimize at the boundary rather than at render time. A test asserts that `honorable discharge`, `E-5` and `age 29` never appear in the serialized context.

**Codes are joined across punctuation only, never whitespace.** `17-C` normalizes to `17C`; prose spans are left intact. An earlier version collapsed all separators and destroyed candidate span parsing.

**Branch ambiguity is surfaced, not resolved.** When a code exists in more than one branch, `branch` and `occupationTitle` are left undefined and a note tells the recruiter to confirm.

**Lane drafts are never pre-approved.** `approved: false` is a literal type. A recruiter approves an occupational hypothesis before it can enter a search plan.

## Commands run and results

```
npx vitest run tests/v33-military-talent-intelligence.test.ts   51 passed
npx vitest run                                                 478 passed, 70 files, 0 failed
npx tsc --noEmit                                               clean
npx next build                                                 succeeded
```

The privacy firewall test `tests/public-repo-privacy-firewall.test.ts` failed once during development because a source comment used a forbidden identifier. The comment was rewritten. The firewall behaved exactly as intended and no test was weakened to accommodate it.

## Limitations

1. The official MOC file has not been imported. The seed is provisional and its codes and linkages are unverified.
2. No UI ships. The engine returns structured output; the recruiter-facing panel is next.
3. Domain packs are not modified. Deciding which packs enable the military lane is next.
4. No planner wiring. Lane drafts are produced but nothing consumes them yet.
5. No market intelligence, no BLS wage join, no geographic context.
6. Precision and recall thresholds in the eval are modest by design, because the seed taxonomy is 13 records. They catch regressions; they do not demonstrate quality.

## Next iteration

1. Import the real file. Add a build step or dataset route mirroring the O*NET route, run `importMocRows`, then `mergeWithSeed`, and delete the provisional records it supersedes.
2. Wire lane drafts into the search planner behind recruiter approval.
3. Extend two domain packs (federal/cleared, cybersecurity) with a `militaryAdjacent` flag rather than running this on every role.
4. Add the recruiter panel: occupations, why, transferable concepts, search terms, verification questions, do-not-assume, and an approve control.
5. Add the O*NET MOC ↔ SOC ↔ BLS OEWS join for wage context.
