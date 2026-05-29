import { CandidateDbClient } from '@/components/CandidateDbClient'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Database — V18 Preview | SourcingOS',
  description:
    'Preview the SourcingOS Candidate Database with resume import, CSV import, AI-safe normalization, contact signals, open-to-work signals, and recruiter-confirmed merge review.',
  robots: { index: false, follow: false },
}

export default function CandidateDatabasePage() {
  return (
    <main className="wrap">
      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Preview mode:</strong> The Candidate Database is running in preview. Candidate records,
          imports, and merge reviews are not persisted between sessions until Supabase persistence and
          auth are enabled.{' '}
          <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>
            Request full beta access →
          </Link>
        </span>
      </div>

      <div className="eyebrow">SourcingOS V18 — Preview</div>
      <h1>Candidate Database + Merge Review</h1>
      <p className="lead">
        Build recruiter-owned candidate records from resumes, CSV imports, and source profiles. Keep
        source profiles separate, extract evidence and contact signals, and confirm merges manually.
        No auto-merge at any confidence level.
      </p>

      <div className="grid two">
        <div className="card">
          <span className="kicker">V18.0</span>
          <h3>Candidate Graph database</h3>
          <p className="muted">Candidate, source profile, evidence, contact, open-to-work, import batch, and match review models.</p>
        </div>
        <div className="card">
          <span className="kicker">V18.1–V18.3</span>
          <h3>Import, normalize, review</h3>
          <p className="muted">Resume text import, CSV import, AI-safe normalization scaffold, and recruiter-confirmed merge queue.</p>
        </div>
      </div>

      <CandidateDbClient />
    </main>
  )
}
