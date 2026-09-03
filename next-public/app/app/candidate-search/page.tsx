import { RoleScopedCandidateSearch } from '@/components/RoleScopedCandidateSearch'
import Link from 'next/link'
import './universal-people-search.css'

export const metadata = {
  title: 'People & Candidate Search — SourcingOS Workbench',
  description:
    'Universal people search, role-scoped sourcing, provider discovery, public-web evidence, contact resolution, and Candidate 360 in one recruiter-controlled workbench.',
  robots: { index: false, follow: false },
}

export default async function CandidateSearchPage({ searchParams }: { searchParams?: Promise<{ roleId?: string; laneId?: string }> }) {
  // Next.js 15+: searchParams is a Promise. Reading it synchronously silently
  // yields undefined, which would drop the active role scope on this page.
  const sp = (await searchParams) ?? {}
  const roleId = typeof sp.roleId === 'string' ? sp.roleId : undefined
  const laneId = typeof sp.laneId === 'string' ? sp.laneId : undefined

  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Workbench — Private beta</div>
      <h1>People & Candidate Search</h1>
      <p className="lead">
        Search the external Talent Universe or work inside your saved Candidate Database without confusing the two. External discovery uses only configured professional-data providers; imported LinkedIn connections and previously saved candidates remain in My Database / Workbench. When a person is saved, SourcingOS can resolve the observations into one recruiter-controlled Candidate 360.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 24px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Provider retrieval ≠ qualification ·
          Source provenance stays visible ·
          No auto-merge at any confidence level ·
          Contact ownership ≠ outreach permission ·
          Open-to-work is a signal, not a verified claim ·
          Public clearance mentions remain unverified breadcrumbs
        </span>
      </div>

      <RoleScopedCandidateSearch roleId={roleId} laneId={laneId} />

      <div className="card" style={{ marginTop: '32px' }}>
        <span className="kicker">Connected workflow</span>
        <div className="grid two" style={{ marginTop: '12px' }}>
          <Link href="/app/agentic-sourcing" style={{ color: 'inherit' }}>
            <strong>Agentic Sourcing</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Start from a role and let Role Brain build distinct research hypotheses, source tasks, search memory, and recruiter-controlled continuation.
            </p>
          </Link>
          <Link href="/app/roles" style={{ color: 'inherit' }}>
            <strong>Role Workspaces</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Return to the calibrated role, review queue, pipeline, activity, and storage controls.
            </p>
          </Link>
          <Link href="/app/candidate-database" style={{ color: 'inherit' }}>
            <strong>Candidate Database</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Search existing imports and saved candidates, import resumes/CSV, review identity matches, confirm merges, and add records to a role.
            </p>
          </Link>
          <Link href="/app/candidate-graph" style={{ color: 'inherit' }}>
            <strong>Candidate Graph</strong>
            <p className="muted" style={{ fontSize: '14px', margin: '4px 0 0' }}>
              Inspect canonical people, source observations, evidence, contact signals, and unresolved cross-source identity proposals.
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}
