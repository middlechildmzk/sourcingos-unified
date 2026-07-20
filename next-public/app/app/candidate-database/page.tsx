import { CandidateDbClient } from '@/components/CandidateDbClient'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Database — V19 Candidate Intelligence | SourcingOS',
  description:
    'Build recruiter-owned candidate records from resumes, imports, and public source profiles, then review field-level evidence, freshness, conflicts, contact permissions, and identity matches.',
  robots: { index: false, follow: false },
}

export default function CandidateDatabasePage() {
  return (
    <main className="wrap">
      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Environment-aware storage:</strong> Preview sessions use temporary in-memory records. Durable
          candidate data requires authenticated Supabase persistence and owner-scoped access.{' '}
          <Link href="/app/evidence-ledger" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>
            Open the Evidence Ledger →
          </Link>
        </span>
      </div>

      <div className="eyebrow">SourcingOS V19 — Candidate Intelligence Spine</div>
      <h1>Candidate Database + Identity Review</h1>
      <p className="lead">
        Build recruiter-owned candidate records from resumes, CSV imports, and source profiles. Keep source
        profiles separate, preserve provenance, and confirm identity decisions manually. No auto-merge at any confidence level.
      </p>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Candidate records</span>
          <h3>Import, normalize, and keep sources separate</h3>
          <p className="muted">Resume text, CSV, relationship context, evidence, contact signals, availability signals, import batches, and merge reviews remain traceable.</p>
        </div>
        <div className="card">
          <span className="kicker">New in V19</span>
          <h3>Field-level Evidence Ledger</h3>
          <p className="muted">Review facts, supported inferences, weak signals, stale records, conflicts, freshness windows, PII flags, and permitted use before ranking or outreach.</p>
          <Link href="/app/evidence-ledger" className="btn secondary">Review evidence</Link>
        </div>
      </div>

      <CandidateDbClient />
    </main>
  )
}
