import Link from 'next/link'

export const metadata = {
  title: 'Free Sourcing Tools | SourcingOS',
  description:
    'BooleanOS, X-Ray Launcher, and JD Strategy Tool — free sourcing utilities for technical, cleared, healthcare, and AI recruiting roles.',
}

export default function Tools() {
  return (
    <main className="wrap">
      <div className="eyebrow">Free tools</div>
      <h1>Free sourcing tools. No account required.</h1>
      <p className="lead">
        Start with utility. Build the source pack. Then request access to the private Candidate Search beta.
      </p>
      <div className="grid">
        <Link className="card" href="/tools/boolean-generator">
          <span className="kicker">Hero tool</span>
          <h3>BooleanOS</h3>
          <p className="muted">Role-specific Boolean search strings for technical, cleared, cyber, healthcare, AI/ML, and GovCon roles.</p>
        </Link>
        <Link className="card" href="/tools/xray-search">
          <span className="kicker">Open-web search</span>
          <h3>X-Ray Launcher</h3>
          <p className="muted">Google X-Ray search builder for GitHub, LinkedIn, public resumes, Stack Overflow, Hugging Face, and open sources.</p>
        </Link>
        <Link className="card" href="/tools/jd-search-strategy">
          <span className="kicker">Search strategy</span>
          <h3>JD Strategy Tool</h3>
          <p className="muted">Turn a messy JD into source lanes, Boolean strings, target titles, and HM calibration questions.</p>
        </Link>
        <Link className="card featured" href="/app/candidate-search">
          <span className="kicker">Private beta</span>
          <h3>Candidate Search</h3>
          <p className="muted">
            The full workbench: role intake → search strategy → multi-source discovery → Candidate 360.
            Powered by Candidate Graph under the hood.
          </p>
        </Link>
      </div>
      <div className="cta" style={{ marginTop: '32px' }}>
        <strong>Free tools → Candidate Search beta:</strong> BooleanOS and X-Ray Launcher wire
        directly into the Candidate Search workflow. Generate a Boolean string or X-Ray query here,
        then take it into the workbench.
      </div>
    </main>
  )
}
