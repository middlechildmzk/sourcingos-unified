import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Sourcing KPI Dashboard: Metrics That Help Senior Sourcers Improve Searches'
const description = 'A practical sourcing metrics guide for lane yield, evidence-fit lead yield, rejection patterns, response, search coverage, Unique Contribution Rate, and recruiter time.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/blog/sourcing-kpi-dashboard/' },
  openGraph: { title, description, url: '/blog/sourcing-kpi-dashboard/', type: 'article', publishedTime: '2026-06-26', modifiedTime: '2026-08-19', authors: ['SourcingOS Editorial'] },
}

const metrics = [
  ['Evidence-fit lead yield', 'How many leads survive the same job-relevant review standard per lane or source?'],
  ['Unique Contribution Rate', 'What share of a source’s evidence-fit leads did none of the other tested sources surface in the same requisition-level test?'],
  ['Duplicate pressure', 'How much of recent sourcing work is resurfacing people the team already knows?'],
  ['Rejection pattern', 'Which evidence gaps or hidden standards repeatedly cause hiring-manager rejection?'],
  ['Response by outreach angle', 'Which evidence-based outreach framing produces replies without collapsing into high-volume messaging?'],
  ['Recruiter time', 'How much time does each lane require after review, correction, deduplication, and handoff are included?'],
] as const

export default function SourcingKpiDashboardPage() {
  return <main className="wrap article article-pro">
    <div className="article-hero-card">
      <span className="kicker">Sourcing operations · interim metrics guide</span>
      <h1>{title}</h1>
      <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Updated August 19, 2026</p>
      <p className="lead">{description}</p>
    </div>
    <div className="article-main">
      <section><h2>Measure whether the search is improving, not whether the sourcer is busy.</h2><p>Profiles viewed, names added, and messages sent are activity counts. They can be useful operationally, but they do not tell you whether a sourcing strategy is expanding coverage, finding different people, or learning from rejection.</p></section>
      <section><h2>A stronger sourcing metric set</h2>{metrics.map(([name,copy]) => <div key={name}><h3>{name}</h3><p>{copy}</p></div>)}</section>
      <section className="article-callout"><h2>Keep UCR in context</h2><p><Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> measures additive discovery. It does not replace response, downstream outcomes, cost, recruiter time, or role-family context. Keep the raw counts next to the rate.</p></section>
      <section><h2>Use metrics to choose the next search action.</h2><p>If duplicate pressure is rising but an untested donor-company lane remains, open the lane. If adjacent-title yield is still producing evidence-fit leads, calibrate before declaring the market exhausted. If a source has low unique contribution and high workflow cost across repeated comparable tests, that becomes a stack decision worth reviewing.</p></section>
      <div className="cta"><strong>Use the underlying methods:</strong> <Link href="/tools/unique-contribution-rate-calculator/">calculate UCR</Link> · <Link href="/tools/search-exhaustion-calculator/">review search-exhaustion evidence</Link>.</div>
    </div>
  </main>
}
