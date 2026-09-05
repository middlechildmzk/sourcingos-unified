import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Boolean Search for Recruiters in 2026: Operators, Query Archetypes, and Debugging'
const description = 'An advanced recruiter guide to Boolean search in 2026: AND, OR, NOT, quotes, parentheses, platform differences, five query archetypes, debugging rules, and evidence-first search design.'
const canonical = '/blog/boolean-search-operators-for-recruiters/'

export const metadata: Metadata = {
  title: 'Boolean Search for Recruiters in 2026 | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['Boolean search recruiters','recruiter Boolean search','Boolean search operators recruiting','Boolean strings recruiters','advanced Boolean recruiting','technical recruiter Boolean search'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['Does Boolean search still matter in 2026?', 'Yes, but its role has changed. Natural-language and AI-assisted search can help generate or interpret queries, while Boolean remains useful for making logic explicit, testing market assumptions, creating reproducible lanes, and debugging why a search is too narrow or too noisy.'],
  ['What are the core Boolean operators recruiters should know?', 'AND, OR, NOT, quotation marks, and parentheses are the conceptual core, but exact syntax varies by search system. Always confirm what the platform actually supports rather than assuming a string that works in one product will behave the same elsewhere.'],
  ['Why should recruiters use multiple Boolean strings?', 'Different query archetypes select different evidence. A title-led string, skill-led string, evidence-led string, adjacency string, and donor-company string can surface different pools. One giant string hides which assumption is producing or suppressing results.'],
  ['What should I remove first when a Boolean search is too narrow?', 'Usually remove brittle title constraints before removing the evidence that proves the work. Then test location, years, industry, and nice-to-have tools one change at a time so you can see which constraint caused the pool to collapse.'],
  ['Should AI write Boolean strings for recruiters?', 'AI can draft synonyms, exclusions, and query variants, but the recruiter should inspect the logic and test the output. Generated syntax is useful only if it matches the target platform and the search intent.'],
] as const

const sources = [
  ['GitHub Docs: code search Boolean operations and qualifiers','https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax'],
  ['Google Search Central: search operators overview','https://developers.google.com/search/docs/monitor-debug/search-operators'],
  ['Google Search Central: site: operator','https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site'],
] as const

const archetypes = [
  ['1. Title-led', 'Starts with recognizable title families. Good for stable professions, but vulnerable to title inconsistency and company-specific naming.'],
  ['2. Skill-led', 'Starts with technologies, methods, certifications, systems, or domain terms. Useful when titles vary but the work has recognizable ingredients.'],
  ['3. Evidence-led', 'Searches for artifacts or context that imply the work itself: repositories, RMF/ATO language, model-serving terms, EMR modules, research topics, or other profession-specific evidence.'],
  ['4. Adjacency-led', 'Intentionally opens neighboring titles, industries, locations, or backgrounds after the strict lane is understood. This tests where the market can flex.'],
  ['5. Donor-led', 'Starts with companies, institutions, programs, or environments likely to contain the talent pattern. Donor membership narrows where to investigate; it does not prove fit.'],
] as const

export default function BooleanRecruitingGuidePage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Boolean search','Talent sourcing','Recruiting search strategy','Technical sourcing'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Boolean search · advanced recruiter guide</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Boolean is not a contest to write the longest string. It is a way to make a search hypothesis explicit, run controlled variants, and see exactly which constraint changes the market.</p>
        <div className="article-meta-grid">
          <div><span>Core logic</span><strong>AND · OR · NOT</strong></div>
          <div><span>Method</span><strong>5 query archetypes</strong></div>
          <div><span>Tool</span><Link href="/tools/boolean-generator/">Open BooleanOS</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#operators">Core operators</a><a href="#platforms">Platform differences</a><a href="#archetypes">5 archetypes</a><a href="#debugging">Debugging</a><a href="#examples">Examples</a><a href="#ai">AI + Boolean</a><a href="#references">References</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Rule</span><p>Change one major search constraint at a time. If five things change between queries, you cannot tell what caused the pool to expand or collapse.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Boolean search still matters because recruiting search is still a logic problem even when the interface accepts natural language. Sourcers need to know whether they are requiring a term, allowing alternatives, excluding noise, matching an exact phrase, or grouping logic. Boolean makes those decisions visible.</p><p>The bigger upgrade for 2026 is to stop treating Boolean as one perfect string. Build multiple <strong>query archetypes</strong> that test different evidence paths, then compare the pools.</p></section>

          <section id="operators"><h2>The core operators</h2><h3>AND: require both concepts</h3><pre>{`Kubernetes AND Terraform`}</pre><p>Use AND when both concepts materially define the lane. Too many AND conditions create brittle searches, especially when profiles use inconsistent terminology.</p><h3>OR: allow equivalent or adjacent language</h3><pre>{`("Platform Engineer" OR SRE OR "Site Reliability Engineer")`}</pre><p>Use OR for title families, synonyms, equivalent technologies, and controlled adjacency. Do not dump every remotely related term into one OR block.</p><h3>NOT: remove a known noise pattern</h3><pre>{`(Kubernetes OR Terraform) NOT intern`}</pre><p>Exclusions are useful after you observe a recurring false-positive class. Premature exclusions can hide useful adjacent profiles.</p><h3>Quotes: preserve a phrase when the platform supports phrase matching</h3><pre>{`"machine learning engineer"`}</pre><p>Quotes can increase precision but may miss equivalent wording. Use them deliberately for titles, product names, or phrases where word order matters.</p><h3>Parentheses: control grouping</h3><pre>{`("Platform Engineer" OR SRE) AND (Kubernetes OR Terraform)`}</pre><p>Parentheses make OR groups readable and prevent ambiguous logic. If you cannot explain the group structure to another sourcer, simplify the string.</p></section>

          <section id="platforms"><h2>Boolean syntax is platform-specific</h2><p>Do not assume every search engine interprets the same syntax. GitHub code search explicitly documents Boolean expressions using AND, OR, NOT, parentheses, exact-string quotes, regular expressions, and qualifiers such as <code>language:</code>, <code>org:</code>, <code>repo:</code>, and <code>path:</code>. Google Search Central documents a smaller set of search operators for web search, including <code>site:</code> and <code>filetype:</code>, and warns that operators are limited by indexing and retrieval behavior.</p><p>Recruiting platforms may implement their own Boolean rules, field filters, semantic search, or AI-assisted query layers. Build the logic first, then adapt it to the actual source.</p></section>

          <section id="archetypes"><h2>The five query archetypes</h2><div className="grid">{archetypes.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div><p>This framework is the practical version of the <Link href="/blog/boolean-search-benchmark/">SourcingOS Boolean Search Benchmark</Link>. The point is not that every role needs exactly five strings. The point is that different search structures select different evidence, so coverage should be tested rather than assumed.</p></section>

          <section id="debugging"><h2>Boolean debugging: what to change when the pool is wrong</h2><h3>If the search is too small</h3><ol><li>Remove exact title requirements before removing core work evidence.</li><li>Open adjacent titles as a separate lane.</li><li>Test location flexibility if the business can actually flex it.</li><li>Remove nice-to-have tools that are acting like hidden must-haves.</li><li>Replace industry labels with the operating environment or problem the person must understand.</li></ol><h3>If the search is too noisy</h3><ol><li>Add a second job-relevant evidence signal.</li><li>Separate broad title synonyms from the strict lane.</li><li>Identify the recurring false-positive class and exclude it intentionally.</li><li>Use source-specific fields or qualifiers instead of adding more generic keywords.</li><li>Inspect whether one overloaded term means something different in another domain.</li></ol><h3>If the search returns the same people every time</h3><p>Stop rewriting synonyms inside the same search path. Open a genuinely independent lane: GitHub, research data, registries, donor companies, referrals, ATS rediscovery, or another evidence surface appropriate to the role. This is the core problem described in <Link href="/blog/search-path-scarcity/">Search-Path Scarcity</Link>.</p></section>

          <section className="article-callout" id="examples"><h2>Three-role query bank</h2><h3>Platform engineering</h3><pre>{`TITLE
("Platform Engineer" OR SRE OR "Site Reliability Engineer") AND (Kubernetes OR Terraform)

EVIDENCE
(Kubernetes AND Terraform) AND (ArgoCD OR Helm OR "GitHub Actions" OR GitOps)

ADJACENCY
("Cloud Engineer" OR "Infrastructure Engineer" OR DevOps) AND (Kubernetes OR Terraform)`}</pre><h3>AI/ML engineering</h3><pre>{`TITLE
("Machine Learning Engineer" OR "ML Engineer" OR "AI Engineer") AND (PyTorch OR JAX)

EVIDENCE
(PyTorch OR transformers) AND (evaluation OR inference OR "model serving" OR vLLM)

PLATFORM
(MLOps OR "ML Platform") AND (Kubernetes OR Ray OR Airflow OR inference)`}</pre><h3>Cleared DevSecOps</h3><pre>{`TITLE
("DevSecOps Engineer" OR "Platform Engineer" OR SRE) AND (Kubernetes OR Terraform)

FEDERAL ENVIRONMENT
(Kubernetes OR Terraform) AND (RMF OR ATO OR FedRAMP OR GovCloud)

DONOR
(Kubernetes OR Terraform) AND (Leidos OR GDIT OR CACI OR SAIC OR Peraton)`}</pre><p>Clearance terms in public profiles remain sourcing breadcrumbs only. Current status requires the appropriate authorized process.</p></section>

          <section id="ai"><h2>Where AI helps, and where it does not</h2><p>AI is useful for generating title variants, synonym candidates, exclusions to test, source-specific rewrites, and multiple query archetypes. It is especially useful as a first-pass critic: “What hidden assumption is making this string too narrow?”</p><p>AI should not turn a generated query into an unreviewed sourcing decision. Inspect the logic, run the search, look at the false positives, and change the query based on evidence. The <Link href="/blog/ai-sourcing-workflow-2026/">8-task AI sourcing evaluation harness</Link> includes Boolean construction as one of the tasks products should be tested on.</p></section>

          <section><h2>Measure Boolean by coverage, not cleverness</h2><p>A beautiful string that returns the same evidence-fit leads as your existing lane may add little discovery value. Compare query archetypes, deduplicate the reviewed pool, and measure what each lane uniquely contributes. Use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> for source contribution and the <Link href="/tools/search-exhaustion-calculator/">Search Exhaustion Evidence Calculator</Link> when new-lead yield begins to flatten.</p></section>

          <section id="references"><h2>Primary-source references</h2><ul>{sources.map(([label,href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label} ↗</a></li>)}</ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Generate and compare variants:</strong> <Link href="/tools/boolean-generator/">open BooleanOS</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
