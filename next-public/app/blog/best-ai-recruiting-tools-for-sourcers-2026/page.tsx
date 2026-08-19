import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Best AI Recruiting Tools for Sourcers in 2026: What to Automate and What to Keep Human'
const description = 'SourcingOS is evaluating AI recruiting tools with a repeatable sourcing harness. The scored cross-vendor ranking is not yet published; use this page to see the criteria, categories, and current benchmark status.'
const canonical = '/blog/best-ai-recruiting-tools-for-sourcers-2026/'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: {
    title,
    description,
    type: 'article',
    url: canonical,
    publishedTime: '2026-06-26',
    modifiedTime: '2026-08-19',
    authors: ['Dan Larson'],
  },
  twitter: { card: 'summary_large_image', title, description },
}

const criteria = [
  ['Evidence-fit discovery', 'Does the workflow surface evidence-fit leads that a sensible comparison stack did not surface?'],
  ['Unique contribution', 'Measure Unique Contribution Rate against the existing source stack rather than rewarding raw list size.'],
  ['Evidence fidelity', 'Can the recruiter trace claims back to source evidence and see what is missing or inferred?'],
  ['Query control', 'Can the recruiter inspect and change titles, skills, exclusions, source lanes, and Boolean or semantic logic?'],
  ['Human checkpoints', 'Are identity merges, outreach, rejection, verification, and other consequential decisions explicitly recruiter-controlled?'],
  ['Workflow fit', 'Does the tool reduce real recruiter effort after correction, review, deduplication, and handoff time are included?'],
  ['Auditability', 'Can a team explain what the system did, which source produced a lead, and why a recommendation exists?'],
  ['Cost and stack overlap', 'Does the product add a capability or sourcing lane that the current stack does not already cover?'],
] as const

const categories = [
  'AI sourcing copilots',
  'Licensed talent platforms and databases',
  'Open-web sourcing and X-Ray workflows',
  'Talent intelligence and matching',
  'Contact discovery and enrichment',
  'ATS rediscovery and CRM workflows',
  'Outreach assistance',
  'Recruiter workflow and evidence systems',
] as const

export default function BestAiRecruitingToolsPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: articleUrl,
    mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26',
    dateModified: '2026-08-19',
    author: { '@type': 'Person', name: 'Dan Larson', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl },
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">AI recruiting tools · 2026 evaluation</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>Dan Larson · Senior Technical Sourcer · Updated August 19, 2026</p>
        <p className="lead">{description}</p>
        <div className="article-callout">
          <h2>Editorial status: evaluation in progress</h2>
          <p><strong>No scored cross-vendor ranking or winner is published yet.</strong> SourcingOS has published the evaluation harness first so the criteria do not change after seeing vendor results. This page will become the scored buyer guide only after the same controlled tasks are run across the products being compared.</p>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">Current status</span><p>Methodology published. Directory cleanup in progress. Cross-vendor result table not yet published.</p></div>
          <div className="mini-card"><span className="kicker">Related</span><Link href="/blog/ai-sourcing-workflow-2026/">Read the 8-task evaluation harness</Link><Link href="/directory/">Browse the recruiting tool directory</Link></div>
        </aside>

        <article className="article-main">
          <section><h2>What this guide will evaluate</h2><p>A useful AI recruiting-tools comparison should test products on the same requisitions and the same recruiter jobs. It should not rank a talent database against a Boolean helper as though they solve the same problem, and it should not reward a polished demo for producing the longest list.</p><p>The completed benchmark will separate product categories, document what was tested hands-on versus from vendor documentation, publish a scoring rubric, disclose what could not be tested, and date every vendor review.</p></section>

          <section><h2>The eight evaluation criteria</h2>{criteria.map(([name,copy]) => <div key={name}><h3>{name}</h3><p>{copy}</p></div>)}</section>

          <section><h2>Tool categories that should not be collapsed into one leaderboard</h2><ul>{categories.map(category => <li key={category}>{category}</li>)}</ul><p>A future score table will make category differences visible instead of implying that every product performs the same sourcing job.</p></section>

          <section><h2>What SourcingOS will not claim before the benchmark exists</h2><ul><li>No “best overall” winner based on feature pages.</li><li>No proprietary database-size claims repeated as measured sourcing coverage.</li><li>No invented pricing when a vendor requires a quote.</li><li>No claim that public evidence verifies clearance, licensure, availability, identity, or fit.</li><li>No home-product victory by default. SourcingOS will be evaluated on the dimensions it actually performs and should score poorly where it lacks a proprietary talent index.</li></ul></section>

          <section><h2>Use the published harness now</h2><p>The <Link href="/blog/ai-sourcing-workflow-2026/">8-task AI sourcing evaluation harness</Link> is already live. It covers intake interpretation, title expansion, query construction, discovery, evidence accuracy, hallucination stress testing, recruiter control, and automation safety. Teams can apply that protocol to their own short list before SourcingOS publishes a broader vendor ranking.</p><p>Use the <Link href="/tools/source-stack-coverage/">Source Stack Coverage Worksheet</Link> to map what your existing tools actually do, then use the <Link href="/directory/">Recruiting Tool Directory</Link> as a discovery layer rather than treating it as a ranking.</p></section>

          <div className="cta"><strong>Benchmark status:</strong> methodology published; scored vendor table pending controlled evaluation. <Link href="/blog/ai-sourcing-workflow-2026/">Read the harness →</Link></div>
        </article>
      </div>
    </main>
  </>
}
