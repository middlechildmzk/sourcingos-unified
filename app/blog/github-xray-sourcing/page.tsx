import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'GitHub X-Ray Sourcing for Recruiters: Search Public Technical Evidence Without Scraping'
const description = 'A recruiter-first guide to using Google site search and GitHub native search to discover public technical evidence, build debuggable sourcing lanes, reduce tutorial noise, and keep identity and fit decisions human-reviewed.'
const canonical = '/blog/github-xray-sourcing/'

export const metadata: Metadata = {
  title: 'GitHub X-Ray Sourcing for Recruiters | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['GitHub xray sourcing','GitHub sourcing recruiters','site github.com recruiter search','technical sourcing GitHub','Google X-Ray GitHub','source engineers GitHub'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is GitHub X-Ray sourcing?', 'GitHub X-Ray sourcing uses a general web search engine, usually with a site restriction such as site:github.com, to find public GitHub pages that contain role-relevant evidence. It is different from GitHub native search, which has its own repository and code qualifiers.'],
  ['Should recruiters search GitHub by job title?', 'Sometimes, but title-only search misses engineers whose public work does not mirror their current resume title. Stronger lanes combine role context with technologies, project language, repositories, model or package evidence, and location only when location is actually needed.'],
  ['Is GitHub activity proof that someone wants a new job?', 'No. Public technical activity is evidence of public work or interests, not evidence of job intent. Recruiters should keep discovery, fit review, identity confirmation, and outreach decisions separate.'],
  ['Can a recruiter use GitHub email addresses for outreach?', 'Use only contact paths that are intentionally public and appropriate under your employer policy, applicable law, platform terms, and opt-out practices. A technical artifact is not permission to contact someone through every possible channel.'],
  ['Should Google X-Ray replace GitHub native search?', 'No. Use both when useful. Google can discover indexed public pages across the domain, while GitHub native search offers repository, code, language, path, organization, and other platform-specific qualifiers. They are different lanes and can surface different evidence.'],
] as const

const sources = [
  ['Google Search Central: site: search operator','https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site'],
  ['Google Search Central: search operators overview','https://developers.google.com/search/docs/monitor-debug/search-operators'],
  ['GitHub Docs: code search syntax','https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax'],
  ['GitHub Docs: searching for repositories','https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories'],
] as const

const lanes = [
  ['Technology + environment', 'Search for tools in the context where they matter: Kubernetes with Terraform and ArgoCD; PyTorch with serving or evals; dbt with Airflow or Snowflake.'],
  ['Artifact type', 'Search for README language, package names, deployment examples, model work, infrastructure modules, security tooling, or other public artifacts relevant to the role.'],
  ['Organization or donor context', 'Use known technical organizations, open-source ecosystems, or donor-company language when the role requires a specific environment.'],
  ['Location as a late filter', 'Add geography after the technical lane works, unless the requisition truly requires a narrow location from the beginning.'],
  ['Adjacent evidence', 'Search the work pattern rather than the current title so adjacent SRE, platform, infrastructure, research, or security profiles can enter the pool.'],
] as const

export default function GithubXraySourcingPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['GitHub sourcing','Technical recruiting','Google X-Ray search','Open-web sourcing'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Technical sourcing · open-web search</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">GitHub is most useful to sourcers when it is treated as a public evidence surface, not a resume database. Build several small search lanes, inspect the underlying work, and use public artifacts to decide what deserves recruiter review.</p>
        <div className="article-meta-grid">
          <div><span>Discovery</span><strong>Google site search</strong></div>
          <div><span>Evidence</span><strong>GitHub native search</strong></div>
          <div><span>Tool</span><Link href="/tools/xray-search/">Open X-Ray Launcher</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#two-lanes">Two search systems</a><a href="#lane-design">Lane design</a><a href="#queries">Query patterns</a><a href="#review">Evidence review</a><a href="#debug">Debugging</a><a href="#sources">Sources</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Boundary</span><p>Public code, repos, README files, and profiles can support sourcing research. They do not prove identity across accounts, current job interest, or final role fit.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Use GitHub sourcing as two separate lanes. First, use a web search engine to discover public GitHub pages with a domain restriction such as <code>site:github.com</code>. Second, use GitHub&apos;s own search to inspect repositories and code with platform-specific qualifiers. Do not assume the two systems index, rank, or expose the same material.</p><p>The goal is not “find developers on GitHub.” The goal is to find <strong>job-relevant public technical evidence</strong> that a normal title search may miss.</p></section>

          <section id="two-lanes"><h2>Google X-Ray and GitHub native search are different tools</h2><h3>Lane 1: Google site search</h3><p>Google documents the <code>site:</code> operator as a way to request results from a specific domain, URL, or URL prefix. It also warns that site queries are not an exhaustive index report. For sourcers, that means X-Ray is useful for discovery, but absence from the results is not proof that a person or page does not exist.</p><pre>{`site:github.com (Kubernetes OR Terraform) "platform engineer"
site:github.com (PyTorch OR transformers) (MLOps OR "model serving")
site:github.com (dbt OR Airflow) (Snowflake OR BigQuery)`}</pre><h3>Lane 2: GitHub native search</h3><p>GitHub code search supports Boolean operators plus qualifiers such as <code>repo:</code>, <code>org:</code>, <code>user:</code>, <code>language:</code>, and <code>path:</code>. Repository search has its own qualifiers for language, topics, update dates, organizations, and other repository properties. This is better for inspecting technical evidence once you know the ecosystem or artifact pattern you want.</p><pre>{`language:python ("vector database" OR embeddings) NOT path:tests
org:example-company language:go kubernetes
language:hcl terraform path:modules`}</pre></section>

          <section id="lane-design"><h2>Design search lanes around evidence, not titles</h2><div className="grid">{lanes.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div><p>Title terms are still useful, especially for profile pages and README files, but they should not be the only entry point. A senior platform engineer may publish Terraform modules without ever writing “Platform Engineer” in a public repository. A machine learning engineer may expose model-serving work, eval tooling, or a Hugging Face link while using a different employment title.</p></section>

          <section id="queries"><h2>Five recruiter-ready GitHub search patterns</h2><h3>1. Platform engineering evidence</h3><pre>{`site:github.com (Kubernetes OR Terraform OR ArgoCD OR Helm) ("platform" OR SRE OR infrastructure) -tutorial`}</pre><p>Use this to find public pages where the technical stack and operating context appear together. Review the actual page before inferring role depth.</p><h3>2. AI/ML production evidence</h3><pre>{`site:github.com (PyTorch OR transformers OR embeddings) ("model serving" OR inference OR evaluation OR MLOps)`}</pre><p>This separates production and evaluation language from generic “AI enthusiast” wording.</p><h3>3. Data engineering systems</h3><pre>{`site:github.com (dbt OR Airflow OR Dagster) (Snowflake OR Databricks OR BigQuery)`}</pre><p>Tool combinations often carry more signal than “Data Engineer” alone.</p><h3>4. Security engineering</h3><pre>{`site:github.com (SAST OR DAST OR Semgrep OR OPA OR "threat model") (security OR AppSec OR "product security")`}</pre><p>Use a separate lane for offensive-security tooling if the role actually requires it rather than mixing every cyber term into one pool.</p><h3>5. Location only after signal</h3><pre>{`site:github.com "Minneapolis" (Kubernetes OR Terraform OR "platform engineering")`}</pre><p>Location strings are inconsistent on public technical profiles. If the market is narrow, run a technical lane first and add geography as a second pass.</p></section>

          <section className="article-callout"><h2>Do not use tutorial noise as candidate evidence</h2><p>GitHub searches frequently surface forks, coursework, “awesome” lists, tutorials, generated files, and dependency mirrors. A useful sourcing workflow distinguishes <strong>ownership and context</strong> from simple keyword presence.</p><ul><li>Open the repository and inspect what the person appears to have contributed.</li><li>Check recency when recency matters to the role.</li><li>Look for project context in README files, docs, releases, issues, or linked sites.</li><li>Do not assume stars, followers, or commit volume equal role fit.</li><li>Use a second evidence surface when the decision would otherwise rest on one ambiguous artifact.</li></ul></section>

          <section id="review"><h2>Use a four-column evidence review</h2><p>For each promising profile or artifact, record four things:</p><ol><li><strong>Observed evidence:</strong> what is actually visible on the public source.</li><li><strong>Why it matters:</strong> the job-relevant signal the sourcer believes it supports.</li><li><strong>What is missing:</strong> seniority, ownership, recency, scale, employment context, location, or another unresolved fact.</li><li><strong>Verify next:</strong> the recruiter action needed before the evidence becomes a stronger claim.</li></ol><p>This is the same evidence discipline used in the <Link href="/sample-candidate-360/">Candidate 360 sample</Link>.</p></section>

          <section id="debug"><h2>Debug a weak GitHub search one variable at a time</h2><p>If a lane is too small, remove the current title before removing the technical evidence. If it is too noisy, add environment context before adding more titles. If tutorials dominate, add exclusions or move into GitHub native code/repository search. If every promising result is already in your main database, track that overlap instead of assuming GitHub added coverage.</p><p>The <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> framework gives you a way to measure whether the GitHub lane actually contributed evidence-fit leads your comparison stack did not surface.</p></section>

          <section><h2>Where this fits in a modern source stack</h2><p>GitHub should not be a universal sourcing recommendation. It is strongest when relevant work is likely to be public: software engineering, infrastructure, data, security, AI/ML, developer tooling, and some technical research. For roles where the work is rarely public, choose evidence surfaces that match that profession instead.</p><p>Start with the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link>, launch Google searches from the <Link href="/tools/xray-search/">X-Ray Launcher</Link>, and use <Link href="/candidate-search/">Candidate Search</Link> to keep source evidence and recruiter-confirmed records separate.</p></section>

          <section id="sources"><h2>Primary-source references</h2><p>The search-syntax claims in this guide are anchored to Google and GitHub documentation rather than recruiter folklore.</p><ul>{sources.map(([label,href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label} ↗</a></li>)}</ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build a live X-Ray lane:</strong> <Link href="/tools/xray-search/">open the SourcingOS X-Ray Launcher</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
