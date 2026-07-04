import Link from 'next/link'

const sourceLanes = [
  {
    title: 'GitHub / code evidence',
    desc: 'Repos, languages, project context, contribution patterns, and public profile links for technical roles.',
    trust: 'GitHub evidence shows public work signals. It does not verify employment, identity, availability, or fit.',
  },
  {
    title: 'Open web / X-Ray',
    desc: 'Search strings for public profiles, portfolios, conference pages, resumes, and other open-web surfaces.',
    trust: 'X-Ray links are recruiter-run searches. SourcingOS does not scrape restricted platforms or automate behind logins.',
  },
  {
    title: 'Research / publications',
    desc: 'OpenAlex, PubMed, ORCID-style evidence for researchers, clinicians, AI scientists, and domain specialists.',
    trust: 'Publication evidence can support expertise review. It does not confirm current role, availability, or employment.',
  },
  {
    title: 'Package ecosystem',
    desc: 'npm, PyPI, crates.io, RubyGems, and maintainer pages for open-source contribution and tool ownership signals.',
    trust: 'Package ownership is a public technical signal. It is not a complete candidate profile.',
  },
  {
    title: 'Healthcare / license / registry',
    desc: 'Public registries and healthcare evidence surfaces for clinical, provider, and healthcare IT searches.',
    trust: 'Registry data must be verified through the appropriate credentialing or hiring workflow before use.',
  },
  {
    title: 'GovCon / clearance breadcrumb',
    desc: 'Search language for TS/SCI, Secret, RMF, ATO, FedRAMP, GovCloud, SCIF, and mission-tech environments.',
    trust: 'Clearance language from public text is an unverified breadcrumb, not a verified clearance.',
  },
  {
    title: 'AI / ML ecosystem',
    desc: 'GitHub, Hugging Face, OpenAlex, PyPI, model, dataset, paper, and production ML infrastructure signals.',
    trust: 'AI/ML evidence should be reviewed for ownership, recency, and production depth before candidate claims are made.',
  },
]

const gatedActions = [
  'Save source profile',
  'Add to project',
  'Confirm same person',
  'Create Candidate 360',
  'Contact enrichment',
  'Export dossier',
]

export function CandidateSearchTrustLayer() {
  return <>
    <section className="section" style={{ padding: '22px 0' }}>
      <div className="section-eyebrow"><span className="section-tag">Source lane routing</span></div>
      <h2 className="section-title">Search the right evidence surface for the role.</h2>
      <p className="section-body">Candidate Search routes sourcer intent into lanes. Each lane explains what it can show, what it cannot prove, and what a recruiter must verify next.</p>
      <div className="grid two">
        {sourceLanes.map(lane => <div className="card authority-card" key={lane.title}>
          <span className="kicker">Public source lane</span>
          <h3>{lane.title}</h3>
          <p className="muted">{lane.desc}</p>
          <div className="preview-banner" style={{ marginTop: '12px', fontSize: '12px' }}>
            <span className="pb-icon">◈</span>
            <span><strong>Trust note:</strong> {lane.trust}</span>
          </div>
        </div>)}
      </div>
    </section>

    <section className="section" style={{ padding: '22px 0' }}>
      <div className="section-eyebrow"><span className="section-tag">Public demo boundaries</span></div>
      <h2 className="section-title">Search and review are open. Durable workflow is gated.</h2>
      <p className="section-body">The public demo lets sourcers test the search workflow and inspect evidence. Anything that changes a record, creates durable memory, enriches contact data, or produces a dossier requires beta access.</p>
      <div className="grid two">
        <div className="card featured">
          <span className="kicker">Open now</span>
          <h3>Public search and evidence review</h3>
          <p className="muted">Run searches, inspect public source profiles, open the evidence drawer, review missing data, and learn the source-pack workflow without signing in.</p>
        </div>
        <div className="card">
          <span className="kicker">Private beta</span>
          <h3>Gated actions</h3>
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: 'var(--muted)', lineHeight: 1.7 }}>
            {gatedActions.map(action => <li key={action}>{action}</li>)}
          </ul>
          <div className="preview-banner" style={{ marginTop: '12px', fontSize: '12px' }}>
            <span className="pb-icon">◈</span>
            <span>This is available in the private beta. Request access to save evidence, build projects, and create Candidate 360 dossiers.</span>
          </div>
        </div>
      </div>
    </section>

    <section className="section" style={{ padding: '22px 0' }}>
      <div className="section-eyebrow"><span className="section-tag">Next steps</span></div>
      <h2 className="section-title">Turn the demo into a workflow.</h2>
      <div className="home-cta-row">
        <Link className="btn" href="/candidate-search">Try another search</Link>
        <Link className="btn secondary" href="/waitlist">Request beta access</Link>
        <Link className="btn ghost" href="/methodology">Read methodology</Link>
        <Link className="btn ghost" href="/data-sources">See data sources</Link>
        <Link className="btn ghost" href="/sample-candidate-360">See sample Candidate 360</Link>
      </div>
    </section>
  </>
}
