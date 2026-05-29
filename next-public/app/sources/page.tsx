import { SourceSearchClient } from '@/components/SourceSearchClient'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Search — Connected Source Search | SourcingOS',
  description:
    'Search public candidate evidence across technical, research, healthcare, and package ecosystems. Review source profiles separately, confirm identity matches manually, and build Candidate 360 dossiers.',
}

export default function SourcesPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">Candidate Search — Connected sources</div>
      <h1>Search public talent sources without silent profile merges.</h1>
      <p className="lead">
        Search source profiles across technical, research, healthcare, and package ecosystems.
        Review evidence, compare identity signals, confirm matches manually, and save to the
        Candidate Graph. No auto-merge at any confidence level.
      </p>

      <div className="grid two" style={{ marginBottom: '28px' }}>
        <div className="card">
          <span className="kicker">Human-approved</span>
          <h3>No auto-merge. Ever.</h3>
          <p className="muted">
            SourcingOS can suggest two public profiles may belong to the same person, but the
            recruiter confirms or keeps them separate. Candidate Graph is the internal intelligence
            layer — Candidate Search is what you work in.
          </p>
        </div>
        <div className="card">
          <span className="kicker">Evidence-first</span>
          <h3>Facts, signals, and provenance stay visible</h3>
          <p className="muted">
            Public source data is treated as evidence to review, not identity verification or
            permission to contact. Open-to-work is a signal, not a claim.
          </p>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '13px', marginBottom: '24px' }}>
        Powered by Candidate Graph — SourcingOS keeps source profiles, evidence, contact signals, and
        identity matches in one recruiter-confirmed record. Want the full workbench experience?{' '}
        <Link href="/app/candidate-search" style={{ color: 'var(--accent)' }}>Open Candidate Search workbench →</Link>
      </p>

      <SourceSearchClient />
    </main>
  )
}
