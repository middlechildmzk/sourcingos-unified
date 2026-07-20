import Link from 'next/link'
import { AutoSourceCommandCenterClient } from '@/components/AutoSourceCommandCenterClient'

export const metadata = {
  title: 'AutoSource Command Center — SourcingOS',
  description: 'Run recruiter-controlled candidate discovery, enrichment, identity review, and prioritized AutoSource campaigns.',
  robots: { index: false, follow: false },
}

export default function AutoSourcePage() {
  return <main className="wrap">
    <div className="eyebrow">SourcingOS V22</div>
    <h1>AutoSource Command Center</h1>
    <p className="lead">Create multi-source talent discovery campaigns, run approved public connectors, automatically promote high-confidence identities into the Candidate Graph, enrich known candidates, and review the rest before action.</p>
    <div className="button-row" style={{ margin: '16px 0 22px' }}><Link className="btn ghost" href="/app/acquisition">Acquisition metrics →</Link><Link className="btn ghost" href="/app/roles">Role workspaces →</Link><Link className="btn ghost" href="/app/candidate-database">Candidate database →</Link></div>
    <AutoSourceCommandCenterClient />
  </main>
}
