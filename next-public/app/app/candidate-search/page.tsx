import { WorkbenchClient } from '@/components/WorkbenchClient'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Search — SourcingOS Workbench',
  description:
    'Role intake, search strategy, open-web discovery, and Candidate 360 in one workbench. Powered by Candidate Graph — recruiter-confirmed identity matching, no silent merges.',
  robots: { index: false, follow: false },
}

export default function CandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Workbench — Private beta</div>
      <h1>Candidate Search</h1>
      <p className="lead">
        Role intake → search strategy → open-web discovery → Candidate 360. One
        recruiter-controlled workflow. Powered by Candidate Graph under the hood.
      </p>

      {/* Compliance guardrails — factual, not a preview warning */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 24px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          No auto-merge at any confidence level ·
          Contact signals are unverified by default ·
          Open-to-work is a signal, not a verified claim ·
          Public clearance mentions are unverified breadcrumbs
        </span>
      </div>

      <WorkbenchClient />

      <div className="card" style={{ marginTop: '32px' }}>
        <span className="kicker">Also in the beta workflow</span>
        <div className="grid two" style={{ marginTop: '12px' }}>
          <Link href="/app/candidate-database" style={{ color: 'inherit' }}>
            <strong>Candidate Database</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Import resumes and CSV, normalize candidates, review identity matches, confirm merges.
            </p>
          </Link>
          <Link href="/sources" style={{ color: 'inherit' }}>
            <strong>Source Connector Search</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Full multi-source search with identity match scoring and candidate graph save.
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}
