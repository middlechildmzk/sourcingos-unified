import Link from 'next/link'

export const metadata = {
  title: 'Candidate Graph — Internal Architecture | SourcingOS',
  description:
    'How SourcingOS uses the Candidate Graph data layer to link source profiles into recruiter-confirmed candidate records without silent auto-merge.',
  robots: { index: false, follow: false },
}

export default function CandidateGraphPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">Internal architecture</div>
      <h1>Candidate Graph</h1>
      <p className="lead">
        The Candidate Graph is the internal data and intelligence layer behind Candidate Search.
        It keeps source profiles, evidence items, contact signals, and identity match reviews
        organized — but never merges them automatically.
      </p>
      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Note:</strong> The user-facing product is called <strong>Candidate Search</strong>.
          Candidate Graph is the internal term for the data architecture. Public nav and marketing copy
          uses &ldquo;Candidate Search.&rdquo; This page describes the internal model.
        </span>
      </div>
      <div className="grid" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>1. Source profiles</h3>
          <p className="muted">
            Each source result — GitHub, Stack Overflow, OpenAlex, ORCID, npm, PyPI, and others —
            keeps its own profile ID, source URL, raw evidence items, contact signals, and refresh timestamp.
            Source profiles stay separate.
          </p>
        </div>
        <div className="card">
          <h3>2. Identity match review</h3>
          <p className="muted">
            Name, location, website, public email, organization, source URL, and skill overlap
            produce a review score. The score surfaces likely matches for recruiter review.
            It does not merge profiles automatically — at any confidence level.
          </p>
        </div>
        <div className="card">
          <h3>3. Recruiter-confirmed merge</h3>
          <p className="muted">
            A recruiter confirms or rejects linked profiles before they roll up into a Candidate 360.
            Human approval is the only merge path. Every merge creates an audit record.
          </p>
        </div>
        <div className="card">
          <h3>4. Evidence and inference separation</h3>
          <p className="muted">
            Facts, signals, inferences, and verify-next steps are always separated in the data model.
            No AI output claims verified contact, verified clearance, or verified job-seeking status.
          </p>
        </div>
      </div>
      <div className="cta" style={{ marginTop: '28px' }}>
        <h2>Use Candidate Search</h2>
        <p>
          The user-facing product. Search public sources, collect source profiles, review identity
          signals, save to the Candidate Graph, and build Candidate 360 dossiers.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Link className="btn" href="/app/candidate-search">Open Candidate Search workbench</Link>
          <Link className="btn secondary" href="/sources">Open source connector search</Link>
        </div>
      </div>
    </main>
  )
}
