import Link from 'next/link'
import { LinkedInImportClient } from '@/components/LinkedInImportClient'

export const metadata = {
  title: 'Network Import — SourcingOS',
  description: 'Import LinkedIn connections as private network context for SourcingOS Candidate Graph.',
  robots: { index: false, follow: false },
}

export default function NetworkImportPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS private network</div>
      <h1>Import LinkedIn connections</h1>
      <p className="lead">
        Seed your private SourcingOS database with your own LinkedIn connection export.
        Imported people stay pending until you review them. Contact signals are unverified by default.
      </p>

      <div className="preview-banner" style={{ marginBottom: '20px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Important:</strong> A LinkedIn connection is relationship context only. It does not mean the person is looking,
          qualified, cleared, contactable, or approved for outreach. Use this to organize your network, then review before action.
        </span>
      </div>

      <div className="grid two" style={{ marginBottom: '20px' }}>
        <div className="card">
          <span className="kicker">How to export</span>
          <h3>LinkedIn connections CSV</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            LinkedIn account settings usually include a “Get a copy of your data” export. Choose Connections,
            download the CSV, then upload or paste it below.
          </p>
        </div>
        <div className="card">
          <span className="kicker">What gets created</span>
          <h3>Pending private records</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            SourcingOS creates source profiles, candidate records, evidence items, and unverified contact signals where available.
            Nothing is auto-contacted or auto-verified.
          </p>
        </div>
      </div>

      <LinkedInImportClient />

      <div className="card" style={{ marginTop: '24px' }}>
        <span className="kicker">Next</span>
        <h3>Turn your network into a sourcing map</h3>
        <p className="muted" style={{ fontSize: '14px' }}>
          After import, use Candidate Search to find technical evidence, attach source profiles, and build project pipelines.
        </p>
        <div className="button-row">
          <Link className="btn secondary" href="/app/candidate-database">Open Candidate Database →</Link>
          <Link className="btn ghost" href="/app/candidate-search">Open Candidate Search →</Link>
        </div>
      </div>
    </main>
  )
}
