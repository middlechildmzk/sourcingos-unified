import Link from 'next/link'
import { Candidate360Client } from '@/components/Candidate360Client'
import { CandidateRoleHandoff } from '@/components/CandidateRoleHandoff'

export const metadata = {
  title: 'Candidate 360 Dossier | SourcingOS',
  description:
    'Recruiter-confirmed Candidate 360 with source profiles, evidence matrix, contact signals, open-to-work signals, freshness, verify-next checklist, and role pipeline handoff. No auto-merge.',
  robots: { index: false, follow: false },
}

export default function Candidate360Page({ params }: { params: { id: string } }) {
  return (
    <main className="wrap">
      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Preview mode:</strong> Contact signals are unverified by default. Open-to-work is a signal,
          not a verified claim. Public clearance mentions are unverified breadcrumbs. No protected-trait
          inference.
        </span>
      </div>

      <div className="eyebrow">Candidate 360 — Recruiter dossier</div>
      <h1>Candidate dossier</h1>
      <p className="lead">
        Source profiles, evidence matrix, contact signals, open-to-work signals, verify-next steps, and a recruiter-controlled handoff into role-specific pipelines.
        Recruiter-confirmed only — no auto-merge at any confidence level.
      </p>

      <div style={{ margin: '0 0 24px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn secondary" href="/app/candidate-database" style={{ fontSize: '13px', padding: '8px 14px' }}>
          ← All candidates
        </Link>
        <Link className="btn ghost" href="/app/roles" style={{ fontSize: '13px', padding: '8px 14px' }}>
          Role workspaces →
        </Link>
      </div>

      <CandidateRoleHandoff candidateId={params.id} />
      <Candidate360Client candidateId={params.id} />
    </main>
  )
}
