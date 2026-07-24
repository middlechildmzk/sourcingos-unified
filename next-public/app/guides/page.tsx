import Link from 'next/link'
import { authorityPages } from '@/data/authority-pages'

export const metadata = {
  alternates: { canonical: '/guides/' },
  title: 'Sourcing Guides | SourcingOS',
  description: 'Answer-first sourcing guides on source packs, Boolean search, manual-safe X-Ray, public evidence, source profiles, and Candidate 360 methodology.',
}

export default function GuidesPage() {
  return <main className="wrap">
    <div className="eyebrow">SourcingOS authority library</div>
    <h1>Sourcing guides for the evidence-first sourcer.</h1>
    <p className="lead">Competitor research shows recruiting content wins when it is practical, structured, and answer-first. This library turns that pattern into SourcingOS-owned topics: source packs, source lanes, public evidence, manual-safe X-Ray, and Candidate 360.</p>

    <div className="cta">
      <strong>Editorial rule:</strong> these pages do not copy competitor posts. They use proven content formats while owning the gaps competitors miss: evidence boundaries, no scraping, no fake profiles, and recruiter-reviewed workflow.
    </div>

    <div className="grid">
      {authorityPages.map(page => <Link className="card" href={`/guides/${page.slug}`} key={page.slug}>
        <span className="kicker">{page.format} · {page.intent}</span>
        <h3>{page.title}</h3>
        <p className="muted">{page.description}</p>
        <span className="btn secondary" style={{ marginTop: '8px' }}>Open guide →</span>
      </Link>)}
    </div>
  </main>
}
