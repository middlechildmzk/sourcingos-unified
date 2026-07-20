import { CandidateDbClient } from '@/components/CandidateDbClient'

export const metadata = {
  title: 'Candidates — SourcingOS',
  description: 'Search the owner-scoped Candidate Graph, review identity evidence, inspect Candidate 360, and route candidates into active roles.',
  robots: { index: false, follow: false },
}

export default function CandidateDatabasePage() {
  return <main className="wrap">
    <div className="product-page-head"><div><span className="kicker">Candidate intelligence</span><h1>Candidates</h1><p>One canonical graph with source-level provenance, evidence, identity review, and recruiter-controlled role handoff.</p></div></div>
    <CandidateDbClient />
  </main>
}
