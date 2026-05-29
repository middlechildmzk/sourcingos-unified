import Link from 'next/link'
import { Candidate360Client } from '@/components/Candidate360Client'

export const metadata = {
  title: 'Candidate 360 | SourcingOS',
  description: 'Candidate 360 dossier with source profiles, evidence matrix, contact signals, open-to-work signals, freshness, and verify-next checklist.'
}

export default function Candidate360Page({ params }: { params: { id: string } }) {
  return <main className="wrap">
    <div className="eyebrow">Candidate 360</div>
    <h1>Candidate dossier</h1>
    <p className="lead">A recruiter-controlled candidate record with source profiles, evidence, contact signals, open-to-work signals, freshness, and merge review context.</p>
    <div className="hero-actions"><Link className="btn secondary" href="/app/candidate-database">Back to candidate database</Link></div>
    <Candidate360Client candidateId={params.id} />
  </main>
}
