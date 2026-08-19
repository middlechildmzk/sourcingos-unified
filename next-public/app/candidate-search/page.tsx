import { WorkbenchClient } from '@/components/WorkbenchClient'
import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/candidate-search/' },
  title: 'Candidate Search Demo | SourcingOS',
  description:
    'Search public talent evidence, review candidate people separately from artifacts, and inspect why each profile surfaced.',
  openGraph: {
    title: 'Candidate Search Demo | SourcingOS',
    description: 'Search public talent evidence, inspect why profiles surfaced, and keep recruiter confirmation separate from public signals.',
    url: '/candidate-search/',
    type: 'website',
  },
}

// Public demo: one search entry point. Search and evidence review are open;
// all durable write actions remain gated by authenticated server routes.
export default function PublicCandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS public demo</div>
      <h1>Find people. See the evidence.</h1>
      <p className="lead">
        Describe the person you need. SourcingOS searches public sources, separates people from
        packages and discovery lanes, and shows why each profile surfaced.
      </p>

      <div className="recruiter-trust-note" style={{ margin: '16px 0' }}>
        <strong>Public evidence, not verified candidate facts.</strong>
        <span>Recruiters confirm identity, current role, location, clearance, contact accuracy, and permission before acting.</span>
      </div>

      <div className="cta" style={{ marginBottom: '20px' }}>
        <strong>Want to see the output before you search?</strong>{' '}
        <Link href="/sample-candidate-360/" style={{ textDecoration: 'underline' }}>Open the synthetic Candidate 360 dossier</Link>{' '}
        to see how evidence, unknowns, recruiter-confirmed identity resolution, and verify-next steps stay separate.
      </div>

      <WorkbenchClient publicMode initialTab="composer" />

      <div className="cta" style={{ marginTop: '24px' }}>
        <strong>Need the full workflow?</strong>{' '}
        <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in</Link>{' '}
        to save person profiles and open Candidate 360, or review the{' '}
        <Link href="/methodology" style={{ textDecoration: 'underline' }}>evidence methodology</Link>.
      </div>
    </main>
  )
}
