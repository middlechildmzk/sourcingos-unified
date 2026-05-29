import { CandidateDbClient } from '@/components/CandidateDbClient'

export const metadata = {
  title: 'Candidate Database V18 Preview | SourcingOS',
  description: 'Preview the SourcingOS Candidate Graph database with resume import, CSV import, AI-safe normalization, contact signals, open-to-work signals, and recruiter-confirmed merge review.'
}

export default function CandidateDatabasePage() {
  return <main className="wrap">
    <div className="eyebrow">SourcingOS V18</div>
    <h1>Candidate Database + Merge Review</h1>
    <p className="lead">Build recruiter-owned candidate records from resumes, CSV imports, and source profiles. Keep source profiles separate, extract evidence and contact signals, and confirm merges manually.</p>
    <div className="grid two">
      <div className="card"><span className="kicker">V18.0</span><h3>Candidate Graph database</h3><p className="muted">Candidate, source profile, evidence, contact, open-to-work, import batch, and match review models.</p></div>
      <div className="card"><span className="kicker">V18.1–V18.3</span><h3>Import, normalize, review</h3><p className="muted">Resume text import, CSV import, AI-safe normalization scaffold, and recruiter-confirmed merge queue.</p></div>
    </div>
    <CandidateDbClient />
  </main>
}
