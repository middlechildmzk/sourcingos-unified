# V29.2.1 Identity Trust Boundary

Base SHA: `52b1df6c48ca258acec9c947a40db4d7ce41044f`
Branch: `v29-2-1-identity-trust-boundary`
Migrations in this release: none.

## Why this release exists

Three code paths linked source profiles into a single canonical person without recruiter approval. All three were reachable from heuristic resemblance alone.

**1. `buildCandidateGraph` grouped at score >= 55.**
`lib/candidate-graph.ts` appended an incoming source profile into an existing candidate group when `identityMatchScore` reached 55. That threshold was reachable with no identity anchor at all:

| Component | Points |
|---|---|
| Exact display-name match | 25 |
| Same stated location | 18 |
| Same stated organization | 10 |
| One shared skill | 3 |
| **Total** | **56** |

Name plus city plus employer plus one shared skill is the standard common-name collision in cleared and federal sourcing. Two people named David Chen at the same prime in the same metro were merged into one record. The `matchReviews.push()` call ran *after* the grouping, so the pending review documented a merge that had already happened.

**2. `mergeRefreshedProfiles` attached strangers on refresh.**
`refreshCandidate` in `lib/candidate-store.ts` re-searches by canonical name alone, then passed every returned result into `mergeRefreshedProfiles`, which keyed all of them in. Any same-name stranger surfaced by that name search was written into the existing candidate.

**3. `/api/candidates/save` accepted `z.array(z.any())`.**
The route persisted a client-authored candidate graph verbatim: client-chosen grouping, client-chosen `entityKind`, client-supplied skills, client-supplied contact signals. The V29.2 source-truth boundary protected the `candidate-db` routes and never covered this one.

The search route also published the guardrail "No auto-merge. Recruiter confirms linked profiles." while performing exactly that merge.

## What changed

### A. Proposal-only resolution

`lib/candidate-graph.ts` no longer groups. Every person anchor becomes exactly one candidate record holding exactly one source profile. Resemblance is emitted as a separate `IdentityMatchProposal` with `linked: false` and `decision: 'pending'`.

New surface:

- `compareSourceProfiles(a, b)` returns component reasons, typed conflicts, deterministic rule results, and a score used only for review ranking
- `buildIdentityResolutionDraft(results)` returns `{ candidates, proposals, excluded, duplicatesCollapsed, resolverVersion }`
- `buildCandidateGraph(results)` keeps its signature and returns the unmerged candidates
- `RESOLVER_VERSION = 'v29.2.1-proposal-only'`

Deterministic rules evaluated and reported, none of which auto-attach in this release: `same_source_stable_id`, `same_observed_public_email`, `same_personal_website_domain`, `explicit_cross_profile_link`.

Conflicts by severity:

| Conflict | Severity |
|---|---|
| `different_public_email` | material |
| `non_person_subject` | blocking |
| `different_personal_website` | material |
| `different_display_name` | material |
| `location_mismatch` | informational |
| `organization_mismatch` | informational |

A blocking conflict such as a non-person subject downgrades the proposal to `do_not_link` and sets `reviewRequired: false`. Different observed emails remain material negative evidence because one person may legitimately use multiple addresses.

Exact same-source identity is handled separately from resemblance. It is collapsed by the stable key `source:sourceProfileId`, reported as `duplicatesCollapsed`, and recorded as an `exact_source_reuse` proposal that requires no review. This is idempotent reuse, not a merge decision.

`mergeRefreshedProfiles` now only replaces source profiles the candidate already owns. Candidate preview IDs are derived from the stable source identity rather than result order, so repeated saves remain idempotent across requests.

**Fixed alongside:** emails were being normalized through `norm`, which strips `@` and `.`, so `alex@example.com` collided with `alexexample.com`. Emails and domains now have dedicated normalizers.

### B. Untrusted save contract

`lib/source-result-contract.ts` defines a real Zod schema for source results. `contactSignals[].verified` is `z.literal(false)`, so a client cannot assert verification.

`/api/candidates/save` now:

1. Validates shape
2. Flattens and discards any client-submitted grouping, reporting `discardedClientGroupings`
3. Rejects generated demo results
4. Re-derives subject kind through `resolveStoredEntityKind`, which explicitly ignores client `entityKind`
5. Re-derives skill and contact hygiene through `classifySourceResult`, stripping query-derived skills and profile-URL contact signals
6. Rejects everything that is not a person anchor, returning 422 with per-result reasons when nothing survives
7. Builds the candidate draft server-side

Persistence is still the preview-only in-memory adapter and is labelled as such in the response.

### C. Merge-action boundary

The legacy merge endpoint now requires at least two source profiles and a matching persisted pending review. A one-source preview record cannot be marked `linked`, even through a manipulated request. The client only renders Confirm/Keep separate controls when such a review exists.

### D. Client

`components/SourceSearchClient.tsx` submits flat `sourceResults` instead of its own graph. Copy claiming SourcingOS "groups evidence into candidate research records" was corrected, and the per-card `matchScore` badge was replaced, because both described merging that no longer happens.

## Verification

| Gate | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | Pending GitHub CI after independent review additions |
| `npm run build` | exit 0, 116/116 static pages |

Claude's submitted patch increased the suite from 294 to 317 tests. Independent review added regression coverage for stable cross-request IDs and merge-action gating; final counts are recorded by GitHub CI.

Build emits one pre-existing warning unrelated to this change: Next.js skips minifying the remote Google Fonts stylesheet. No files in this release touch CSS.

## Remaining risks and known limitations

1. **Not verified in a browser.** No push credential on this build surface, so there is no Vercel preview, no HTTP smoke check, no runtime log sweep, and no authenticated visual QA. Everything above is local.
2. **Proposals are not persisted.** They are returned in API responses and held in memory. Durable storage is `identity_match_proposals` in V29.3A. A recruiter cannot yet act on a proposal and have that decision survive a restart.
3. **No review UI.** Proposals are in the payload with no surface to approve or reject them. V29.3A.
4. **Production data is untouched and still reflects the old behavior.** 27,310 candidates, of which all 27,306 with a source profile have exactly one, and `identity_match_reviews` is empty. Any candidate merged by the old score >= 55 path in a preview session was never persisted to Supabase, since the unsafe save wrote only to the in-memory adapter. No backfill or audit of production records is performed or needed here.
5. **`scoreIdentityMatch` in `lib/candidate-db-v18.ts` is untouched.** It still records conflicts without letting them reduce or block a score. It feeds `/api/candidate-db/match-review`, which creates proposals rather than links, so it is not a silent-merge path. Consolidating the two scorers belongs in V29.3A.
6. **Legacy `resume_xray` records classify as `search_lane`.** They cannot become new candidates through the save route. The 27,295 existing records are untouched, per the no-backfill boundary.
7. **Thresholds are uncalibrated.** Component weights were carried over unchanged specifically so this release does not tune scoring while also changing linkage authority. They rank review order only and need calibration against real recruiter decisions.

## Release boundary confirmation

No migration written or applied. No production backfill. No historical record rewrite. No environment variable change. No merge. No deployment.
