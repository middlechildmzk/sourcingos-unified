import { CandidateAcquisitionHubClient } from '@/components/CandidateAcquisitionHubClient'

export const metadata = {
  title: 'Candidate Acquisition Hub — SourcingOS',
  description: 'Grow and improve the private SourcingOS Candidate Graph through authorized imports, official APIs, and reviewable public evidence.',
  robots: { index: false, follow: false },
}

export default function CandidateAcquisitionPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Candidate Intelligence Graph</div>
      <h1>Candidate Acquisition Hub</h1>
      <p className="lead">Track the real size and quality of your Candidate Graph, run high-throughput owned-data imports, manage source connections, and build an evidence-backed path toward 100,000 rich candidate profiles.</p>
      <CandidateAcquisitionHubClient />
    </main>
  )
}
