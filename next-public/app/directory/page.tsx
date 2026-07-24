import Link from 'next/link'
import { DirectoryClient } from '@/components/DirectoryClient'

export const metadata = {
  alternates: { canonical: '/directory/' },
  title: 'Recruiting Tool Directory | SourcingOS',
  description: 'Compare sourcing tools, contact finders, OSINT sources, AI recruiting tools, ATS/CRM systems, job boards, and open-web research methods for recruiters.'
}

export default function Page() {
  return <main className="wrap">
    <div className="eyebrow">Sourcing tools and methods</div>
    <h1>Recruiting Tool Directory</h1>
    <p className="lead">A workflow-first map of sourcing tools, contact finders, OSINT methods, AI recruiting platforms, ATS/CRM systems, job boards, healthcare sources, research databases, and technical evidence surfaces.</p>

    <div className="cta">
      <strong>Goal:</strong> build the leading practical library for all things sourcing. Every listing should eventually have a tool page, safe-use notes, alternatives, affiliate status, and a SourcingOS workflow fit.
    </div>

    <div className="hero-actions">
      <Link className="btn" href="/tools/search-lane-expander">Open Search Lane Expander</Link>
      <Link className="btn secondary" href="/candidate-search">Try Candidate Search</Link>
      <Link className="btn ghost" href="/methodology">Read methodology</Link>
    </div>

    <DirectoryClient />
  </main>
}
