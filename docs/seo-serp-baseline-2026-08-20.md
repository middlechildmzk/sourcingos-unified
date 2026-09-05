# SourcingOS SERP / authority baseline — 2026-08-20

Purpose: preserve a fixed public-search baseline after the Tier-A content migration so future ranking decisions use observed change rather than memory.

## Data availability

- Production site: live on `getsourcingos.com`; Tier-A routes and indexing rules are deployed through Vercel.
- Public SERP/search-engine snapshot: available through public web search.
- Google Search Console direct connector: not available in this workspace.
- Google Search Console export: **available and analyzed on 2026-08-20** from `getsourcingos.com-Performance-on-Search-2026-08-20.zip`.
- Export filter: Web search, Last 3 months. The chart contains 50 days from **2026-06-30 through 2026-08-18**.
- Important timing boundary: most Tier-A rewrites and indexing changes shipped on **2026-08-19 and 2026-08-20**, so this GSC export is primarily a **pre-migration / early baseline**, not a verdict on the new pages.

## Actual GSC baseline

Across the 50-day chart window:

- **8 clicks**
- **1,211 impressions**
- **0.66% CTR**
- impression-weighted average position: **49.94**

Recent trend:

| Window | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| Last 7 days | 3 | 236 | 1.27% | 54.32 |
| Prior 7 days | 1 | 216 | 0.46% | 54.76 |
| Last 14 days | 4 | 452 | 0.88% | 54.53 |
| Prior 14 days | 1 | 427 | 0.23% | 53.69 |
| Last 28 days | 5 | 879 | 0.57% | 54.13 |

Interpretation: Google discovery is increasing and CTR improved in the most recent sample, while aggregate position remains roughly flat. The sample is still too small to infer stable growth rates.

### Highest-signal pages in the export

| Page | Clicks | Impressions | CTR | Avg position | Interpretation |
|---|---:|---:|---:|---:|---|
| `/` | 5 | 161 | 3.11% | 36.37 | Brand/product homepage already earning most clicks. |
| `/tools/boolean-generator/` | 1 | 163 | 0.61% | 87.26 | Strong query demand but very early rankings; optimize existing tool, do not create duplicate Boolean URLs. |
| `/blog/cybersecurity-boolean-strings/` | 1 | 104 | 0.96% | 27.09 | Clear content demand; current Tier-A rewrite shipped after most of this window. |
| `/blog/best-ai-recruiting-tools-for-sourcers-2026/` | 0 | 300 | 0% | 79.14 | Highest-impression content URL; the buyer-guide rewrite shipped Aug 20, after this export ends. Monitor before rewriting again. |
| `/jobs/` | 0 | 157 | 0% | 16.90 | Jobs is already near page one/two territory and deserves product investment. |
| `/blog/best-contact-finders-for-recruiters-2026/` | 0 | 156 | 0% | 14.88 | Best current content optimization opportunity, but the major Tier-A rewrite also shipped after this GSC window. Monitor post-recrawl before changing the page again. |
| `/methods/` | 0 | 11 | 0% | 17.27 | Early positive signal for the methods router. |

### Job-category signal that changed the roadmap

Several job category URLs were already receiving impressions at strong average positions before they were temporarily noindexed during trust cleanup:

- `/jobs/remote-recruiter-jobs/` — 5 impressions, avg position **7.2**
- `/jobs/recruiting-operations-jobs/` — 12 impressions, avg position **10.58**
- `/jobs/contract-recruiter-jobs/` — 12 impressions, avg position **13.33**
- `/jobs/technical-sourcer-jobs` — 3 impressions, avg position **8.0**
- `/jobs/technical-sourcer-jobs/` — 1 impression, avg position **7.0**
- `/jobs/cleared-recruiter-jobs` — 3 impressions, avg position **9.0**
- `/jobs/cleared-recruiter-jobs/` — 1 impression, avg position **6.0**
- `/jobs/remote-talent-sourcer-jobs` — 11 impressions, avg position **16.36**

This is small-sample data, but the intent/position combination is too strong to ignore.

2026-08-20 response:

- verified the live job-source pipeline is currently returning real recruiter/sourcer roles from curated public ATS feeds and public job sources;
- restored the eight category pages to `index, follow`;
- added server-rendered current-job metadata snapshots so Google and no-JS clients can see real current inventory rather than an empty client shell;
- retained the interactive live search below the snapshot;
- kept all third-party descriptions off the server-rendered category snapshot and link to original postings;
- did **not** add `JobPosting` schema to category aggregations;
- restored the eight job category URLs to the sitemap with truthful Aug 20 modification dates.

## Query demand from GSC

Highest-impression non-brand query families include:

### AI sourcing / recruiting software

- `ai sourcing` — 211 impressions, avg position 82.18
- `sourcing software solutions` — 94, position 50.47
- `ai sourcing tools` — 37, position 72.16
- `ai sourcing tools for recruiting` — 10, position 80.8
- `best ai recruiter tools 2026` — 9, position 85.89
- `best ai sourcing tools for recruiters 2026` — 2, position 65.5

Action already shipped: convert the AI-tools page from methodology placeholder into a real buyer guide with LinkedIn Recruiter, hireEZ, SeekOut, Juicebox, a bottleneck decision matrix, eight evaluation criteria, and controlled pilot protocol while explicitly withholding a winner until testing exists.

### Boolean generator / builder intent

- `boolean search generator` — 27 impressions, position 92.52
- `boolean builder` — 19, position 89.37
- `boolean search creator` — 17, position 93.88
- `boolean search string generator` — 11, position 91
- `boolean string generator` — 10, position 94.4
- `boolean generator` — 9, position 96.67
- `free boolean generator` — 8, position 90
- `boolean creator` — 7, position 93
- `boolean search strings generator` — 6, position 93

Action shipped Aug 20: strengthen the single canonical Boolean tool around this natural synonym family (`generator`, `string builder`, `search creator`) rather than creating duplicate landing pages.

### Contact-finder intent

- the canonical contact-finder guide had **156 page impressions at avg position 14.88**;
- observed query examples include `best contact finder tools for recruiters working with tight hiring deadlines` and `lusha vs hunter`.

Action: **watch, do not immediately rewrite again**. The guide was substantively upgraded on Aug 20 with a four-tool buyer framework, 25-candidate test protocol, enrichment gate, metrics, and first-party vendor sources. The export ends Aug 18, so current content has not yet been measured.

### Cleared / sourcing niches

Observed examples:

- `where to find cleared candidates` — 12 impressions, position 59.67
- `cleared recruiter jobs` — 2 impressions, position 10.5
- `github sourcing tool` — 2 impressions, position 66.5
- `github sourcing` — 1 impression, position 53
- `ats rediscovery software` — 4 impressions, position 63.25

These support the current strategy of strengthening existing specialized pages rather than opening more overlapping URLs.

## Device / geography baseline

Devices:

- Desktop: 7 clicks / 1,063 impressions / avg position 48.51
- Mobile: 1 click / 123 impressions / avg position 57.93
- Tablet: 0 clicks / 25 impressions / avg position 71

Top countries by impressions:

- United States: 3 clicks / 555 impressions / avg position 53.71
- United Kingdom: 0 / 91 / 51.08
- India: 2 / 60 / 30.30

The site is currently desktop-heavy in both impressions and clicks. Do not infer audience preference from this yet; it may reflect query and crawl mix in a tiny early sample.

## Index/crawl observation

Public search results on 2026-08-20 still returned an older cached version of the SourcingOS homepage/blog index containing pre-migration article titles and cards. Live production is newer. Treat this as crawl/index lag, not evidence that the current production content reverted.

The GSC Pages export also contains historical impressions for URLs that have since been redirected or noindexed. Because the export spans through Aug 18 and the cleanup shipped Aug 19–20, those rows are expected and should not be used as evidence that the current routing/indexing rules are wrong without live verification.

Action: keep sitemap `lastModified` truthful, maintain internal links to canonical Tier-A pages, and compare the public index and GSC again after enough post-migration data accumulates.

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

Current canonicals:
- article: `/blog/boolean-search-operators-for-recruiters/`
- tool: `/tools/boolean-generator/`

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

Evaluate each canonical page on:

1. impressions by query cluster;
2. clicks and CTR;
3. average position, but inspect query-level distributions rather than relying only on page average;
4. pages/queries in positions 4–20 as the first optimization pool;
5. query-title mismatch: meaningful impressions for intents the page does not answer;
6. cannibalization: multiple SourcingOS URLs receiving impressions for the same intent;
7. branded vs non-branded impressions;
8. internal conversion signal where available: tool clicks, Candidate Search clicks, sample-dossier clicks, job-source clicks, or beta requests.

Because most Tier-A work shipped after the export ends, preserve this Aug 18 GSC dataset as the **before baseline**. The next meaningful content comparison should use enough post-migration data to avoid comparing two or three crawl days against 50 historical days.

## Priority order from the combined SERP + GSC evidence

1. **Protect and grow recruiter jobs.** Real positions 6–17 already appeared on category pages; server-rendered live inventory is now the highest-leverage architecture fix.
2. **Monitor Best Contact Finders closely.** Position 14.88 on 156 pre-upgrade impressions makes it the clearest existing content candidate for page-one improvement after recrawl.
3. **Monitor the Aug 20 AI-tools buyer rewrite.** It already had 300 impressions before the buyer content existed; do not rewrite again until Google has measured the new version.
4. **Grow the Boolean tool around one canonical URL.** GSC already clusters multiple generator/builder/creator phrasings around the tool.
5. **Turn SourcingOS frameworks into original data.** UCR, Boolean archetypes, source-stack overlap, AI tool evaluation, and LinkedIn renewal testing are stronger next assets than another generic article sprint.

## Next decision gate

Do not start another high-volume article sprint. At the next measurement checkpoint:

- compare post-migration GSC query/page data against this preserved baseline;
- optimize pages earning meaningful impressions in positions 4–20;
- publish controlled original research where SourcingOS can add unique information;
- consolidate any new cannibalization that appears;
- only create a new URL when existing pages cannot honestly satisfy the intent.
