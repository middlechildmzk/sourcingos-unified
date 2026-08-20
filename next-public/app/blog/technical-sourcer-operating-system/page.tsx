import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Technical Sourcer Operating System: The Weekly Workflow for Hard-to-Fill Searches'
const description = 'A practical weekly operating system for senior sourcers: req triage, source packs, search experiments, hiring-manager calibration, evidence review, ATS rediscovery, pipeline learning, and Friday search retrospectives.'
const canonical = '/blog/technical-sourcer-operating-system/'

export const metadata: Metadata = {
  title: 'Technical Sourcer Operating System | Weekly Sourcing Workflow',
  description,
  alternates: { canonical },
  keywords: ['technical sourcer workflow','sourcing operating system','senior sourcer workflow','weekly sourcing process','technical recruiting workflow','sourcing strategy process'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['Dan Larson'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is a technical sourcer operating system?', 'It is a repeatable way to run hard searches across a week: prioritize requisitions, define evidence and search lanes, run controlled experiments, capture hiring-manager feedback, preserve market learning, and decide what changes next.'],
  ['How many active requisitions should a sourcer work at once?', 'There is no universal number because difficulty, hiring volume, geography, tooling, stakeholder load, and stage all matter. The useful practice is to classify req risk and assign explicit search experiments rather than treating every open role as equal every day.'],
  ['How often should sourcers recalibrate with hiring managers?', 'Recalibrate when evidence changes the search, not only on a calendar. For active difficult roles, a short weekly evidence review is often more useful than waiting for a large batch of profiles.'],
  ['What should a sourcing weekly review include?', 'Review lane yield, duplicate pressure, evidence-fit saves, rejection reasons, response outcomes, aging risk, unresolved tradeoffs, and the next experiment for each priority requisition.'],
  ['How should AI fit into the workflow?', 'Use AI for intake structure, title expansion, query generation, lane ideas, evidence summarization, and retrospective synthesis. Keep identity, fit, contact use, merges, outreach, and consequential decisions under recruiter review.'],
] as const

const days = [
  ['Monday: portfolio triage', 'Classify reqs by business priority, age, market risk, stakeholder uncertainty, and search evidence. Pick the one or two highest-leverage experiments for each priority role.'],
  ['Tuesday: build and run lanes', 'Create or refresh source packs, launch strict and adjacent search lanes, and record what each lane is designed to test.'],
  ['Wednesday: evidence + HM calibration', 'Review what the market produced. Bring patterns, not anecdotes, to the hiring manager: repeated false positives, missing evidence, donor-company results, and tradeoffs.'],
  ['Thursday: expansion + rediscovery', 'Open independent lanes that the primary search did not cover: GitHub, research, registries, donor companies, ATS history, referrals, or another role-specific source.'],
  ['Friday: search retrospective', 'Measure what changed, preserve useful queries and donor maps, record rejection patterns, update stop conditions, and decide the next experiment before the week resets.'],
] as const

export default function TechnicalSourcerOperatingSystemPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'Dan Larson', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Technical sourcing','Sourcing operations','Recruiting workflow','Talent sourcing'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Sourcer operations · weekly system</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>Dan Larson · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Hard searches get worse when every day becomes reactive sourcing. Use a weekly operating rhythm that turns requisitions into explicit experiments, makes hiring-manager feedback actionable, and preserves what the market taught you.</p>
        <div className="article-meta-grid">
          <div><span>Cadence</span><strong>5-day feedback loop</strong></div>
          <div><span>Unit of work</span><strong>Search experiment</strong></div>
          <div><span>Workspace</span><Link href="/candidate-search/">Candidate Search</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#portfolio">Portfolio triage</a><a href="#week">Weekly rhythm</a><a href="#experiment">Search experiments</a><a href="#hm">HM loop</a><a href="#metrics">Metrics</a><a href="#memory">Project memory</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Rule</span><p>Every priority requisition should end the week with one documented learning and one explicit next experiment.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>A technical sourcer operating system is the repeatable structure around the search. It tells you which requisitions deserve attention, what hypothesis each search lane is testing, how quickly hiring-manager evidence is incorporated, when to open adjacent markets, and how the lessons survive beyond one recruiter&apos;s browser tabs.</p><p>The goal is not more activity. The goal is faster learning per requisition.</p></section>

          <section id="portfolio"><h2>Start with portfolio triage, not inbox order</h2><p>Classify active requisitions with a small risk model:</p><ul><li><strong>Business urgency:</strong> how costly is delay?</li><li><strong>Market difficulty:</strong> how narrow are the skills, location, compensation, or other constraints?</li><li><strong>Calibration uncertainty:</strong> how stable is the hiring-manager definition of success?</li><li><strong>Search maturity:</strong> blank-page search, early signal, mature lane set, or near exhaustion?</li><li><strong>Pipeline condition:</strong> no leads, weak evidence, low response, repeated HM rejection, or late-stage drop-off?</li></ul><p>Two requisitions can both be 30 days old and require completely different sourcing actions. Age alone is not a diagnosis.</p></section>

          <section id="week"><h2>The five-day sourcing rhythm</h2><div className="grid">{days.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="experiment"><h2>Treat each search as an experiment</h2><p>A useful sourcing experiment has four fields:</p><ol><li><strong>Hypothesis:</strong> where should transferable talent exist?</li><li><strong>Lane:</strong> title, evidence, artifact, donor company, adjacent title, ATS rediscovery, referral, or another independent path.</li><li><strong>Success signal:</strong> what outcome would make the lane worth more effort?</li><li><strong>Stop/change rule:</strong> what evidence tells you to expand, narrow, or abandon the lane?</li></ol><p>Example: “Platform engineers at federal systems integrators with Kubernetes + Terraform evidence will add people the exact-title DevSecOps lane missed.” That is testable. “Search more DevSecOps” is not.</p><p>Use the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> to store those experiments.</p></section>

          <section className="article-callout" id="hm"><h2>Make the hiring-manager loop evidence-driven</h2><p>Do not bring five random profiles and ask whether the manager likes them. Bring patterns:</p><ul><li>“The exact-title lane produced 18 reviewed leads but almost all lacked the required platform evidence.”</li><li>“The adjacent SRE lane produced fewer leads but three had the work pattern you accepted.”</li><li>“Northern Virginia is producing depth; remote-only is not. Which constraint can move?”</li><li>“The donor group you suggested is returning compliance profiles rather than hands-on infrastructure. Here are two better donors.”</li></ul><p>That conversation changes the search model instead of merely passing judgment on individuals.</p></section>

          <section id="metrics"><h2>Use a small operating scorecard</h2><p>Track metrics that help the search improve:</p><ul><li><strong>Evidence-fit saves by lane</strong></li><li><strong>Unique contribution by source or lane</strong></li><li><strong>Duplicate pressure</strong></li><li><strong>Time to first evidence-fit lead</strong></li><li><strong>HM pass-through and rejection reason</strong></li><li><strong>Response outcome by outreach angle</strong></li><li><strong>Recent new-lead rate</strong></li><li><strong>Unresolved calibration blockers</strong></li></ul><p>Use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> for additive discovery and the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link> when you need to prove whether another lane is still likely to add coverage.</p></section>

          <section id="memory"><h2>Friday is where project memory gets created</h2><p>Before closing the week, preserve:</p><ul><li>queries that produced signal</li><li>false-positive patterns</li><li>accepted adjacent titles</li><li>donor companies that worked or failed</li><li>market and compensation constraints</li><li>hiring-manager tradeoffs</li><li>source overlap</li><li>why a lane was stopped</li></ul><p>The next similar requisition should begin with this evidence. Otherwise the organization keeps paying for the same search learning.</p></section>

          <section><h2>Where AI belongs in the operating system</h2><p>AI can help turn intake notes into source-pack drafts, propose title families, generate Boolean variants, summarize lane outcomes, and detect recurring rejection patterns. Keep the evidence boundary visible and keep identity, role relevance, contact-channel decisions, merges, outreach, and consequential decisions under recruiter review.</p><p>The <Link href="/blog/ai-sourcing-workflow-2026/">8-task AI sourcing evaluation harness</Link> is the product-testing version of this principle.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Start the workflow:</strong> <Link href="/tools/jd-search-strategy/">build a source pack</Link> or <Link href="/candidate-search/">open Candidate Search</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
