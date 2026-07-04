import { WorkbenchClient } from '@/components/WorkbenchClient'
import { PublicComposerDefault } from '@/components/PublicComposerDefault'
import { CandidateSearchV25Builder } from '@/components/CandidateSearchV25Builder'
import { CandidateSearchTrustLayer } from '@/components/CandidateSearchTrustLayer'
import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/candidate-search/' },
  title: 'Candidate Search Demo — SourcingOS',
  description:
    'Try SourcingOS Candidate Search free. Smart composer, source-lane routing, public-source search, evidence-first result cards, and a recruiter-safe profile drawer.',
}

// Public demo — search and review work without sign-in.
// All write actions are gated client-side (publicMode) AND server-side (auth-protected APIs).
export default function PublicCandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS — Public demo</div>
      <h1>Candidate Search</h1>
      <p className="lead">
        Search public talent evidence, review source profiles, inspect why something matched,
        and keep every claim separated from recruiter confirmation.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0 8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Public evidence matches only · Not confirmed candidates · Contact signals unverified ·
          Clearance and open-to-work are signals, never verified claims · Confidence means source relevance only
        </span>
      </div>

      <div className="preview-banner" style={{ marginBottom: '20px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Demo mode.</strong> Search and review are open to everyone. Saving source profiles,
          adding to projects, confirming same-person matches, contact enrichment, dossier export,
          and Candidate 360 creation require a beta account.{' '}
          <Link href="/login" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Sign in</Link>
          {' '}or <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>request access</Link>.
        </span>
      </div>

      <CandidateSearchV25Builder />
      <PublicComposerDefault />
      <WorkbenchClient publicMode={true} />
      <CandidateSearchTrustLayer />
    </main>
  )
}
