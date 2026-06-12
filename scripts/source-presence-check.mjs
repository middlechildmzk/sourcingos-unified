import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const files = ['src/App.tsx','src/data.ts','src/engine.ts','src/store.ts','src/styles.css','package.json','README.md','CHANGELOG.md','public/robots.txt','public/sitemap.xml','scripts/generate-seo-pages.mjs','next-public/README.md','next-public/package.json','next-public/app/page.tsx','next-public/app/layout.tsx','next-public/app/tools/boolean-generator/page.tsx','next-public/app/tools/xray-search/page.tsx','next-public/app/tools/jd-search-strategy/page.tsx','next-public/components/BooleanTool.tsx','next-public/components/XrayTool.tsx','next-public/components/JDStrategyTool.tsx','next-public/components/WaitlistForm.tsx','next-public/components/DirectoryClient.tsx','next-public/components/BetaBridge.tsx','next-public/components/AdminAnalytics.tsx','next-public/components/ArticleBody.tsx','next-public/components/Nav.tsx','next-public/data/articles.ts','next-public/data/tools.ts','next-public/app/sitemap.ts','next-public/app/robots.ts','next-public/app/api/waitlist/route.ts','next-public/app/api/analytics/route.ts','next-public/data/methods.ts','next-public/data/comparisons.ts','next-public/lib/analytics.ts','next-public/lib/source-types.ts','next-public/lib/source-connectors.ts','next-public/lib/candidate-graph.ts','next-public/components/SourceSearchClient.tsx','next-public/app/sources/page.tsx','next-public/app/api/sources/search/route.ts','next-public/app/api/sources/refresh/route.ts','next-public/app/app/candidate-graph/page.tsx','next-public/app/comparisons/[slug]/page.tsx','ROADMAP_V17.md','ROADMAP_V17_1.md','ROADMAP_V17_2.md','next-public/lib/candidate-store.ts','next-public/app/api/candidates/save/route.ts','next-public/app/api/candidates/list/route.ts','next-public/app/api/candidates/merge/route.ts','next-public/app/api/candidates/refresh/route.ts','next-public/app/api/candidates/scheduled-refresh/route.ts','next-public/sql/candidate-graph-schema.sql','next-public/sql/candidate-graph-schema-v17-3.sql','next-public/lib/supabase-adapter.ts','next-public/app/api/persistence/status/route.ts','next-public/app/api/candidates/cron-refresh/route.ts','API_CONNECTOR_ROADMAP.md','ROADMAP_V17_3.md'];
const byPath = Object.fromEntries(files.map(p => [p, read(p)]));
const all = Object.values(byPath).join('\n');
const checks = [
  ['package version is v17.3.0', byPath['package.json'].includes('17.3.0') && byPath['next-public/package.json'].includes('17.3.0')],
  ['Vite core bridge preserved', all.includes('CoreCockpit') && all.includes('Private beta preview')],
  ['Next public shell present', byPath['next-public/README.md'].includes('Next') && byPath['next-public/package.json'].includes('next')],
  ['Next tool pages present', all.includes('/tools/boolean-generator') && all.includes('BooleanTool') && all.includes('XrayTool') && all.includes('JDStrategyTool')],
  ['interactive Boolean modes present', all.includes('Cleared DevSecOps') && all.includes('Cyber / RMF') && all.includes('RN / Healthcare') && all.includes('AI / ML')],
  ['X-Ray launcher opens Google', all.includes('window.open') && all.includes('google.com/search') && all.includes('site:github.com')],
  ['JD source pack download present', all.includes('sourcingos-source-pack.md') && all.includes('download_source_pack')],
  ['waitlist preview API present', all.includes('Captured in preview') && all.includes('/api/waitlist')],
  ['analytics preview present', all.includes('sourcingos.public.analytics') && all.includes('AdminAnalytics') && all.includes('/api/analytics')],
  ['private beta bridge present', all.includes('BetaBridge') && all.includes('sourcingos-beta') && all.includes('No auto-merge')],
  ['full article content present', all.includes('Direct answer') && all.includes('Copy-paste starting strings') && all.includes('SourcingOS workflow')],
  ['five flagship articles present', ['source-pack-methodology','github-xray-sourcing','cybersecurity-boolean-strings','cleared-devsecops-sourcing','linkedin-recruiter-alternatives'].every(s=>all.includes(s))],
  ['directory contains 50+ tools', (all.match(/"name":/g)||[]).length >= 50 && all.includes('ContactOut') && all.includes('ClearanceJobs') && all.includes('OpenAlex')],
  ['directory filters present', all.includes('DirectoryClient') && all.includes('category') && all.includes('Search tools')],
  ['methods library present', all.includes('Source Pack Methodology') && all.includes('Aging Req Rescue') && all.includes('AI/ML Research Lane')],
  ['comparison routes present', all.includes('generateStaticParams') && all.includes('hireEZ vs SeekOut vs Juicebox')],
  ['sitemap and robots in Next shell present', all.includes('MetadataRoute.Sitemap') && all.includes("disallow: ['/admin/', '/app/']")],
  ['public nav excludes analytics', byPath['next-public/components/Nav.tsx'].includes('Tools') && !byPath['next-public/components/Nav.tsx'].includes('Analytics')],
  ['no auto outreach guardrail remains', all.toLowerCase().includes('no auto-send') || all.toLowerCase().includes('no automated outreach')],
  ['clearance guardrail remains', all.toLowerCase().includes('breadcrumbs') && all.toLowerCase().includes('manual verification')],
  ['source pack concept central', all.includes('source pack') && all.includes('Build a source pack')],
  ['source connectors present', all.includes('/api/sources/search') && all.includes('searchGitHub') && all.includes('searchStackOverflow') && all.includes('searchOpenAlex') && all.includes('searchNpi')],
  ['expanded V17.2 connectors present', all.includes('searchOrcid') && all.includes('searchSemanticScholar') && all.includes('searchArxiv') && all.includes('searchPubMed') && all.includes('searchHuggingFace') && all.includes('searchNpm') && all.includes('searchPyPi')],
  ['V17.3 rich source connectors present', all.includes('searchKaggle') && all.includes('searchDevTo') && all.includes('searchDockerHub') && all.includes('searchCrates') && all.includes('searchRubyGems') && all.includes('searchResumeXray')],
  ['V17.3 Supabase persistence scaffold present', all.includes('supabaseConfigured') && all.includes('SUPABASE_SERVICE_ROLE_KEY') && all.includes('/api/persistence/status')],
  ['V17.3 cron refresh route present', all.includes('/api/candidates/cron-refresh') && all.includes('CRON_SECRET')],
  ['V17.3 no auto-merge pending reviews', byPath['next-public/lib/candidate-graph.ts'].includes("decision: 'pending'") && !byPath['next-public/lib/candidate-graph.ts'].includes("decision: score >= 70 ? 'confirmed'")],
  ['candidate graph model present', all.includes('identityMatchScore') && all.includes('buildCandidateGraph') && all.includes('No auto-merge')],
  ['persistent candidate store present', all.includes('saveCandidateGraph') && all.includes('applyMergeDecision') && all.includes('refreshDueCandidates')],
  ['candidate graph API routes present', all.includes('/api/candidates/save') && all.includes('/api/candidates/merge') && all.includes('/api/candidates/scheduled-refresh')],
  ['Supabase schema present', all.includes('create table if not exists candidates') && all.includes('source_profiles') && all.includes('identity_match_reviews')],
  ['source connector UI present', all.includes('SourceSearchClient') && all.includes('Search connected sources') && all.includes('/sources')],
  ['source refresh preview present', all.includes('/api/sources/refresh') && all.includes('refreshedAt')],
  ['Next package has pinned deps', !byPath['next-public/package.json'].includes('latest')],
  ['root package has pinned deps', !byPath['package.json'].includes('latest')],
  ['static SEO export still present', byPath['package.json'].includes('seo:export') && byPath['scripts/generate-seo-pages.mjs'].includes('seo-dist')],
  ['roadmap has V16.6 V16.7 V16.8 V17', byPath['ROADMAP_V17.md'].includes('V16.6') && byPath['ROADMAP_V17.md'].includes('V16.7') && byPath['ROADMAP_V17.md'].includes('V16.8') && byPath['ROADMAP_V17.md'].includes('V17.0')],
  ['V17.2 roadmap present', byPath['ROADMAP_V17_2.md'].includes('Persistent Candidate Graph') && byPath['ROADMAP_V17_2.md'].includes('scheduled-refresh')] 
];
let pass = 0; for (const [name, ok] of checks) { if (ok) pass++; else console.error(`FAIL: ${name}`); }
console.log(`SourcingOS Unified V17.3 QA: ${pass}/${checks.length} checks passing`);
if (pass !== checks.length) process.exit(1);
