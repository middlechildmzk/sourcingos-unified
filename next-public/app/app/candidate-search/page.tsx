import { WorkbenchClient } from '@/components/WorkbenchClient'
import { ActiveRoleSearchContext } from '@/components/ActiveRoleSearchContext'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Search — SourcingOS Workbench',
  description:
    'Role intake, active role context, search strategy, open-web discovery, and Candidate 360 in one recruiter-controlled workbench.',
  robots: { index: false, follow: false },
}

export default function CandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Workbench — Private beta</div>
      <h1>Candidate Search</h1>
      <p className="lead">
        Role intake → search strategy → open-web discovery → Candidate 360 → role review queue. One recruiter-controlled workflow. Powered by Candidate Graph under the hood.
      </p>

      <ActiveRoleSearchContext />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 24px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          No auto-merge at any confidence level ·
          Contact signals are unverified by default ·
          Open-to-work is a signal, not a verified claim ·
          Public clearance mentions are unverified breadcrumbs
        </span>
      </div>

      <WorkbenchClient publicMode={false} />

      <div className="card" style={{ marginTop: '32px' }}>
        <span className="kicker">Also in the connected workflow</span>
        <div className="grid two" style={{ marginTop: '12px' }}>
          <Link href="/app/roles" style={{ color: 'inherit' }}>
            <strong>Role Workspaces</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Return to the calibrated role, review queue, pipeline, activity, and storage controls.
            </p>
          </Link>
          <Link href="/app/candidate-database" style={{ color: 'inherit' }}>
            <strong>Candidate Database</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Import resumes and CSV, normalize candidates, review identity matches, confirm merges, and add records to a role.
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
