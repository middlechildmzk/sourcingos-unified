import Link from 'next/link'
import { CandidateDbClient } from '@/components/CandidateDbClient'

export const metadata = {
  title: 'Candidates — SourcingOS',
  description: 'Search the owner-scoped Candidate Graph, review identity evidence, inspect Candidate 360, and route candidates into active roles.',
  robots: { index: false, follow: false },
}

export default function CandidateDatabasePage() {
  return <main className="wrap">
    <div className="product-page-head">
      <div><span className="kicker">Candidate intelligence · V36.10</span><h1>Candidates</h1><p>One canonical person record with source-level provenance, evidence-aware field resolution, recruiter-controlled identity review, and role handoff.</p></div>
      <div className="product-page-actions">
        <Link className="btn" href="/app/identity-review">Identity Review</Link>
        <Link className="btn secondary" href="/app/candidate-search">Find people</Link>
      </div>
    </div>
    <CandidateDbClient />
  </main>
}
