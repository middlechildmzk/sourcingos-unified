import Link from 'next/link'
import { EvidenceLedgerClient } from '@/components/EvidenceLedgerClient'

export const metadata = {
  title: 'Evidence Ledger — SourcingOS Candidate Intelligence',
  description: 'Review candidate facts, inferences, weak signals, stale evidence, conflicts, freshness, provenance, and permitted use before ranking or outreach.',
  robots: { index: false, follow: false },
}

export default function EvidenceLedgerPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS V19 — Candidate Intelligence Spine</div>
      <h1>Evidence Ledger</h1>
      <p className="lead">
        A field-level trust workspace for candidate research. Every claim keeps its source, evidence class,
        freshness, review state, permitted use, and conflicts instead of becoming an unexplained profile score.
      </p>

      <div className="button-row" style={{ marginBottom: '24px' }}>
        <Link href="/app/candidate-database" className="btn secondary">Candidate Database</Link>
        <Link href="/app/candidate-search" className="btn secondary">Candidate Search</Link>
      </div>

      <EvidenceLedgerClient />
    </main>
  )
}
