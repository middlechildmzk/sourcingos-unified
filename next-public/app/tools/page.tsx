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
          <h3>JD-to-Boolean Search Builder</h3>
          <p className="muted">Paste a JD → three search lanes (Precision, Balanced, Market Map) with LinkedIn, Google/Bing X-Ray, and GitHub strings. Strips JD noise automatically.</p>
        </Link>
        <Link className="card" href="/tools/xray-search">
          <span className="kicker">Open-web search</span>
          <h3>X-Ray Launcher</h3>
          <p className="muted">Google X-Ray search builder for GitHub, LinkedIn, public resumes, Stack Overflow, Hugging Face, and open sources.</p>
        </Link>
        <Link className="card" href="/tools/clearance-search">
          <span className="kicker">Cleared / GovCon</span>
          <h3>Clearance Search Builder</h3>
          <p className="muted">Compliant Boolean and X-Ray for TS/SCI, poly, and cert lanes — clearance terms kept out of public X-Ray on purpose.</p>
        </Link>
        <Link className="card" href="/tools/aging-req-rescue">
          <span className="kicker">Req triage</span>
          <h3>Aging Req Rescue Planner</h3>
          <p className="muted">Diagnose why a req is stuck — ghost req, lane exhaustion, calibration drift, comp, or outreach — and get a rescue plan plus an HM note.</p>
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
