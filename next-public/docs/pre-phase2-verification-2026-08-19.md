# Pre-Phase-2 verification record — 2026-08-19

This file records the implementation-time findings for V-01 through V-07 from the SourcingOS pre-Phase-2 work order. A `PARTIAL` result means the code/repository question was answered but the requested external dataset or Google-specific validation surface was not available through the connected tools.

## V-01 — Training modules versus blog articles: COMPLETE

All five training modules were fetched from the repository and compared with their closest blog topic.

| Module | Finding | Indexing decision |
|---|---|---|
| `/training/ai-sourcing-prompts/` | Prompt-driven instructional workflow with exercises/use instructions, distinct from the blog prompt asset | Keep indexable |
| `/training/evidence-review-checklist/` | Checklist/training artifact, distinct instructional job from an evidence methodology article | Keep indexable |
| `/training/hiring-manager-calibration-workshop/` | Workshop structure and meeting prompts, distinct from the canonical 25-question intake article | Keep indexable; point to canonical intake article |
| `/training/cleared-govcon-sourcing-safety/` | Safety/guardrail module, distinct instructional intent from the cleared-sourcing map | Keep indexable; point to canonical cleared map |
| `/training/candidate-360-workshop/` | Workshop flow for constructing a dossier, distinct from the methodology/search-facing article | Keep indexable |

No blanket `noindex` action is justified. Training is an instructional layer; the blog is the documentation/search layer.

## V-02 — Tier-B scope confirmation: COMPLETE IN CODE

The shared `data/articles.ts` cohort defaults to `publishedAt` and `updatedAt` of `2026-06-26`. Any slug served through `app/blog/[slug]/page.tsx` uses the same `ArticleBody` shell: the same hero metadata grid, trust note, operating-notes block, section rendering, copy-paste strings block, FAQ block, and CTA. This confirms the structural-template concern in code rather than by sampling two pages.

Dedicated static article routes override the shared shell for:
- `linkedin-recruiter-alternatives`
- `best-contact-finders-for-recruiters-2026`
- `ai-sourcing-workflow-2026`
- `best-ai-recruiting-tools-for-sourcers-2026`
- `sourcing-kpi-dashboard`

The AI sourcing workflow is therefore **not** a Tier-B trust defect. It is a dedicated 8-task evaluation harness and remains the homepage credibility CTA.

The current shared-template cohort in `data/articles.ts`, before applying redirects, is:
- `source-pack-methodology`
- `github-xray-sourcing`
- `cybersecurity-boolean-strings`
- `cleared-devsecops-sourcing`
- `candidate-360-profile-template`
- `open-web-sourcing-stack` — Group A redirect
- `hiring-manager-calibration-questions` — Group A redirect
- `talent-mapping-donor-companies`
- `recruiter-ai-prompts-source-pack`
- `how-to-source-ai-ml-engineers`
- `healthcare-recruiting-open-web`
- `boolean-search-operators-for-recruiters`
- `contact-enrichment-compliance-for-recruiters`
- `aging-req-rescue-framework`
- `ats-rediscovery-sourcing`
- `source-profile-evidence-ledger`
- `sourcing-for-founders-and-small-teams` — Group A redirect
- `govcon-cleared-sourcing-market-map` — Group A redirect
- `sourcing-tool-stack-for-agency-recruiters` — Group A redirect
- `technical-sourcer-operating-system`
- `candidate-search-ui-smart-composer`
- `hard-to-fill-role-intake-template` — Group A redirect

After Group A, 16 shared-template URLs remain indexable. They are upgrade/reposition candidates, not automatic redirect targets.

## V-03 — Structured-data presence: PARTIAL / CODE + RENDER QA REQUIRED

Repository verification confirms dedicated Article/FAQ JSON-LD on the UCR, Search Exhaustion, AI sourcing harness, and other flagship article routes. The dynamic blog route also emits Article, BreadcrumbList, and FAQPage JSON-LD from article data.

Google Rich Results Test was not directly available through the connected implementation tools. Production HTML must therefore be checked after the final deployment to confirm the expected JSON-LD is emitted. No JobPosting schema is permitted on the client-only category shells.

## V-04 — Job listing render path: COMPLETE

`LiveJobsClient` fetches `/api/jobs/search` after hydration. Category-route initial HTML therefore cannot contain the live listing inventory. The static production `jobs` array is intentionally empty and explicitly documents that fake companies/example apply links are not to be seeded.

Action shipped:
- all eight category hubs: `noindex, follow`
- self-canonicals added
- category hubs removed from sitemap
- no JobPosting schema added
- `/jobs/guides/` verified as a short topic index and set `noindex, follow`

Restoration requires meaningful server-rendered current inventory, expiry handling, original-source links, and unique per-category content.

## V-05 — `/comparisons/` existence: COMPLETE

The route exists and has three dynamic comparison URLs. Repository inspection found the comparison bodies were generic and did not contain vendor-specific testing, dated claims, pricing verification, or evidence adequate for a search-facing buyer guide.

Action shipped:
- `/comparisons/`: `noindex, follow`
- all three comparison detail routes: `noindex, follow`
- comparison routes removed from sitemap
- pages retained as an honest internal/product-roadmap layer with links to the directory and published AI evaluation harness

## V-06 — `/jobs/guides/` state: COMPLETE

The page existed as five short topic cards, not a finished guide library. It is now explicitly labeled a topic index and is `noindex, follow`. Job-page links now describe it as career-guide topics rather than a completed library.

## V-07 — Backlink and traffic baseline: PARTIAL

Exact Search Console sessions, ranking-query counts, and referring-domain exports were not available through the connected sources during this implementation pass. This does not block the six Group-A redirects because the work order explicitly treats the baseline as a sequencing input and permanent redirects preserve URL equity.

Public search discovery on 2026-08-19 confirmed the Tier-B cohort is discoverable from the SourcingOS blog index and that the GovCon market-map URL had itself been crawled/indexed. The six source articles were archived to `docs/group-a-redirect-migrations-2026-08-19.md` before redirects were added.

## Additional implementation findings

- Root `layout.tsx` did hardcode homepage Open Graph metadata. Dedicated article routes already overrode it, so the defect was inheritance on routes without page-level Open Graph metadata rather than a universal article bug. Root inheritance was removed and major hubs received explicit page-level Open Graph identity.
- `/sample-candidate-360/` used a numeric `78/100 (declared weights)` label without showing the weights. The numeric score was removed and replaced with auditable evidence coverage (`3 of 4 must-haves`), while recruiter-confirmed identity resolution was explicitly separated from verification of candidate facts.
- `CISA KEV` and `NVD` were mislabeled as paid/variable in the directory. Their public/free access was re-verified on 2026-08-19 from the official government sources and the rendered directory now separates them into `Research Context`.
- Tool naming is normalized on the main acquisition surfaces: `BooleanOS`, `JD Strategy Tool`, `Search Lane Expander`, `X-Ray Launcher`, `Clearance Search Builder`, `Aging Req Rescue Planner`, `Source Stack Coverage Worksheet`, `UCR Calculator`, and `Search Exhaustion Evidence Calculator`.
- BooleanOS and JD Strategy remain separate products for now. The implemented boundary is stage-based: JD Strategy at intake; BooleanOS when the role is understood and the sourcer needs strings; Search Lane Expander mid-search when coverage is too narrow. A future merge remains a product decision, not an SEO requirement.
