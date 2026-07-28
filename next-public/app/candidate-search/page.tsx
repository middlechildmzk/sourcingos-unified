import { WorkbenchClient } from '@/components/WorkbenchClient'
import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/candidate-search/' },
  title: 'Candidate Search Demo — SourcingOS',
  description: 'Search public talent evidence, review person profiles first, and inspect supporting provenance without fabricated candidates or contact data.',
}

export default function PublicCandidateSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS — Live public demo</div>
      <h1>Search for people. Inspect the evidence.</h1>
      <p className="lead">
        Describe the talent you need in plain language. SourcingOS separates people from packages,
        organizations, publications, and manual discovery lanes before anything can become a candidate.
      </p>

      <div className="recruiter-trust-note" style={{ margin: '16px 0 20px' }}>
        <strong>Public evidence, not verified candidate facts.</strong>
        <span>Identity, employment, location, clearance, contact accuracy, and permission require recruiter confirmation.</span>
      </div>

      <WorkbenchClient publicMode initialTab="composer" />

      <div className="cta" style={{ marginTop: '24px' }}>
        <strong>Turn a search into a recruiter workflow.</strong>{' '}
        <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in</Link>{' '}
        or <Link href="/waitlist" style={{ textDecoration: 'underline' }}>request private beta access</Link>{' '}
        to save people, add them to roles, and open Candidate 360.
      </div>

      <p className="muted" style={{ marginTop: '16px', fontSize: '12px' }}>
        Need the sourcing methodology? Review the <Link href="/methodology" style={{ textDecoration: 'underline' }}>evidence and trust methodology</Link>.
      </p>
    </main>
  )
}
