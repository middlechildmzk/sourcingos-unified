import { WorkbenchClient } from '@/components/WorkbenchClient'
import Link from 'next/link'

export const metadata = {
  title: 'Candidate Search Demo — SourcingOS',
  description:
    'Try SourcingOS Candidate Search free. Smart composer, source-aware query routing, live public-source search, and an evidence-first profile drawer. Sign in to save candidates and build your Candidate Graph.',
}

// Public demo — search and review work without sign-in.
// All write actions are gated client-side (publicMode) AND server-side (auth-protected APIs).
export default function PublicCandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS — Public demo</div>
      <h1>Candidate Search</h1>
      <p className="lead">
        Search public technical sources, review evidence-first source profiles, and open a
        candidate drawer — no sign-in required. Sign in to save candidates, build projects,
        and unlock the Candidate Graph.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Public evidence matches only · Not confirmed candidates · Contact signals unverified ·
          Clearance and open-to-work are signals, never verified claims
        </span>
      </div>

      <div className="preview-banner" style={{ marginBottom: '20px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Demo mode.</strong> Search and review are open to everyone. Saving candidates,
          adding to projects, contact enrichment, and Candidate 360 require a beta account.{' '}
          <Link href="/login" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Sign in</Link>
          {' '}or <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>request access</Link>.
        </span>
      </div>

      <WorkbenchClient publicMode={true} />
    </main>
  )
}
