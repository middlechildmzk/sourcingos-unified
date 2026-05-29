import { SourceSearchClient } from '@/components/SourceSearchClient'

export const metadata = {
  title: 'Candidate Graph and Public Evidence Search | SourcingOS',
  description: 'Search public candidate evidence across technical, research, healthcare, and package ecosystems. Review source profiles separately and confirm identity matches manually.'
}

export default function SourcesPage(){
  return <main className="wrap">
    <div className="eyebrow">Candidate Graph beta preview</div>
    <h1>Search public candidate evidence without silent profile merges.</h1>
    <p className="lead">Search source profiles across technical, research, healthcare, and package ecosystems. Review evidence, compare identity signals, confirm matches manually, and check saved profiles for updates.</p>
    <div className="grid two">
      <div className="card"><span className="kicker">Human-approved</span><h3>No auto-merge at any confidence level</h3><p className="muted">SourcingOS can suggest that two public profiles may belong to the same person, but the recruiter confirms or keeps them separate.</p></div>
      <div className="card"><span className="kicker">Evidence-first</span><h3>Facts, signals, and provenance stay visible</h3><p className="muted">Public source data is treated as evidence to review, not identity verification or permission to contact.</p></div>
    </div>
    <SourceSearchClient />
  </main>
}
