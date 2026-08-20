# SourcingOS SERP / authority baseline — 2026-08-20

Purpose: preserve a fixed public-search baseline after the Tier-A content migration so future ranking decisions use observed change rather than memory.

## Data availability

- Production site: live on `getsourcingos.com`; latest Tier-A routes and indexing rules are deployed through Vercel.
- Public SERP/search-engine snapshot: available through public web search.
- Google Search Console: not directly connected in this workspace.
- Prior GSC export: searched in connected Google Drive on 2026-08-20 and not discoverable.
- Therefore: do **not** state exact Google impressions, clicks, CTR, or average position until a Search Console export or direct connection is available.

## Index/crawl observation

Public search results on 2026-08-20 still returned an older cached version of the SourcingOS homepage/blog index containing pre-migration article titles and cards. Live production is newer. Treat this as crawl/index lag, not evidence that the current production content reverted.

Action: keep sitemap `lastModified` truthful, maintain internal links to the canonical Tier-A pages, and compare the public index again at the next checkpoint.

## Query cluster baseline

### 1. AI recruiting tools / AI sourcing tools

Observed SERP pattern:
- Many competitors use explicit `tested`, `ranked`, `top X`, pricing, and vendor comparison formats.
- Strong pages often separate AI recruiting into categories rather than pretending every tool solves the same job.
- Commercial intent is high and generic methodology-only content is unlikely to satisfy the entire query.

SourcingOS right to win:
- sourcing-specific buyer criteria rather than broad HR-software rankings;
- requisition-level controlled evaluation harness;
- evidence-fit discovery and Unique Contribution Rate;
- explicit human checkpoints and unsafe-action exposure;
- no manufactured winner before controlled testing.

2026-08-20 action shipped:
- upgraded `/blog/best-ai-recruiting-tools-for-sourcers-2026/` from a benchmark-placeholder page into a buyer guide with a current four-platform shortlist: LinkedIn Recruiter, hireEZ, SeekOut Recruit, and Juicebox;
- added vendor-owned source links, category decision matrix, eight scoring criteria, and 30-minute pilot protocol;
- kept the result table/winner explicitly unpublished until controlled testing exists.

Next original-data asset:
- multi-requisition controlled comparison using the published 8-task harness.

### 2. Boolean search for recruiters

Observed SERP pattern:
- dominant content is operator education, syntax tables, copy-paste strings, Google X-Ray examples, and Boolean-vs-AI discussion;
- several pages are strong on examples but weaker on measuring whether different queries actually expand the reviewed talent pool.

SourcingOS right to win:
- five query archetypes;
- one-variable-at-a-time debugging;
- evidence-led and donor-led lanes, not just title synonyms;
- query-to-query coverage comparison;
- UCR and Search Exhaustion integration.

Current canonical:
- `/blog/boolean-search-operators-for-recruiters/`

Next original-data asset:
- run the five archetypes against the same role/review cap and publish overlap + UCR, not an arbitrary “best string.”

### 3. LinkedIn Recruiter alternatives

Observed SERP pattern:
- highly commercial and vendor-heavy;
- competitors commonly present 7–12 alternatives, estimated/reported pricing, and use-case tables;
- several vendor-authored pages naturally rank their own product first.

SourcingOS right to win:
- unbundle Recruiter into nine jobs before comparing vendors;
- preserve licensed-index vs open-web vs contact vs project-memory distinctions;
- renewal test on real requisitions;
- price recruiter stitching/correction time together with licenses;
- disclose that SourcingOS is not a LinkedIn-scale licensed professional index.

Current canonical:
- `/blog/linkedin-recruiter-alternatives/`

Next original-data asset:
- a three-requisition renewal benchmark comparing discovery, evidence, contact/reply, project-state labor, and total workflow cost.

### 4. Candidate 360

Observed SERP pattern:
- `Candidate 360` is semantically ambiguous;
- existing products often use it to mean a unified ATS/candidate profile, dashboard, or record containing resume, notes, interviews, communications, and source history;
- it can also collide with `360 recruitment`, meaning full-cycle recruiting.

SourcingOS right to win:
- consistently qualify the concept as an **evidence-backed Candidate 360 dossier**;
- emphasize evidence ledger, unknowns, recruiter-confirmed identity resolution, must-have coverage, source provenance, and verify-next work;
- use `candidate dossier template`, `candidate evidence template`, and `recruiter candidate summary` as supporting intent rather than relying only on the ambiguous head term.

Current canonical:
- `/blog/candidate-360-profile-template/`

Next original-data asset:
- publish anonymized/synthetic dossier examples for multiple role families using the exact same field structure.

### 5. Unique Contribution Rate (UCR)

Observed public-search pattern:
- no established recruiting-specific `Unique Contribution Rate` definition surfaced in the returned search set on 2026-08-20;
- this is evidence of low visible competition in the sampled results, **not** proof that SourcingOS invented the phrase first.

SourcingOS right to win:
- one canonical definition across article, calculator, tooltips, metadata, and future research;
- fixed evidence-fit denominator;
- source-order controls;
- raw counts beside percentages;
- explicit limitations and pre-registered hypotheses.

Current canonical:
- `/blog/unique-contribution-rate/`

Next original-data asset:
- first controlled multi-requisition UCR dataset with source overlap matrix, collection window, source order, review caps, and contradictions/null results.

### 6. Source Pack Methodology

Observed pattern:
- no dominant recruiting SERP convention emerged from the sampled public results for `source pack methodology`;
- treat this as an ownable SourcingOS framework, not a generic traffic term that needs keyword-stuffed expansion.

Current canonical:
- `/blog/source-pack-methodology/`

Right to win:
- connect role intake -> evidence standard -> title/donor map -> independent lanes -> query bank -> false positives -> calibration -> stop conditions;
- show worked role-family examples and make the artifact reusable inside the product.

## Measurement rules for the next checkpoint

When Search Console data becomes available, evaluate each canonical page on:

1. impressions by query cluster;
2. clicks and CTR;
3. average position, but inspect query-level distributions rather than relying only on page average;
4. pages/queries in positions 4–20 as the first optimization pool;
5. query-title mismatch: meaningful impressions for intents the page does not answer;
6. cannibalization: multiple SourcingOS URLs receiving impressions for the same intent;
7. branded vs non-branded impressions;
8. internal conversion signal where available: tool clicks, Candidate Search clicks, sample-dossier clicks, or beta requests.

Do not manufacture conclusions from a tiny early sample. Preserve a 28-day window once enough post-migration data exists, while also checking the most recent 7-day trend for crawl/index movement.

## Next decision gate

Do not start another high-volume article sprint. At the next measurement checkpoint:

- upgrade pages already earning impressions in positions 4–20;
- publish controlled original research where SourcingOS can add unique information;
- consolidate any new cannibalization that appears;
- only create a new URL when existing pages cannot honestly satisfy the intent.
