import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sources · SourcingOS',
  description: 'Connected data sources, provenance, evidence, and import controls.',
}

const areas = [
  { href: '/app/acquisition', title: 'Connections & source operations', description: 'Inspect provider connections, acquisition controls, and source behavior.' },
  { href: '/app/evidence-ledger', title: 'Evidence ledger', description: 'Review claim provenance and the observations supporting candidate facts.' },
  { href: '/app/import', title: 'Import center', description: 'Bring authorized candidate data into SourcingOS.' },
  { href: '/sources', title: 'Open source toolkit', description: 'Use public sourcing utilities and research tools.' },
]

export default function SourcesPage() {
  return <div className="wrap">
    <section className="product-page-head">
      <div><span className="kicker">Sources</span><h1>Connections, provenance, and evidence.</h1><p>Infrastructure stays inspectable without becoming the recruiter workflow. Search and roles use these sources underneath; this area is where you audit and configure them.</p></div>
    </section>
    <div className="product-list">
      {areas.map(area => <Link href={area.href} key={area.href} className="product-row">
        <div className="product-row-main"><div className="product-row-title">{area.title}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{area.description}</div></div>
        <span className="status-pill">Open →</span>
      </Link>)}
    </div>
  </div>
}
