import Link from 'next/link'

export const metadata = {
  title: 'Free Sourcing Tools | SourcingOS',
  description:
    'BooleanOS, Search Lane Expander, Search Exhaustion Calculator, X-Ray Launcher, and JD Strategy Tool — free sourcing utilities for technical, cleared, healthcare, and AI recruiting roles.',
}

export default function Tools() {
  return (
    <main className="wrap">
      <div className="eyebrow">Free tools</div>
      <h1>Free sourcing tools. No account required.</h1>
      <p className="lead">
        Build search lanes, measure coverage, pressure-test a tired req, and turn sourcing ideas into evidence before you request beta access.
      </p>
      <div className="grid">
        <Link className="card featured" href="/tools/search-exhaustion-calculator">
          <span className="kicker">New evidence tool</span>
          <h3>Search Exhaustion Evidence Calculator</h3>
          <p className="muted">Calculate lane coverage, duplicate rate, unique-query yield, donor-map coverage, adjacent-title yield, and recent new-lead rate before declaring a market exhausted.</p>
        </Link>
        <Link className="card featured" href="/tools/search-lane-expander">
          <span className="kicker">Volume tool</span>
          <h3>Search Lane Expander</h3>
          <p className="muted">Turn a rough role target into Precision, Balanced, Broad, and Market Map lanes with live sources, manual-safe X-Ray links, and low-result rescue actions.</p>
        </Link>
        <Link className="card" href="/tools/boolean-generator">
          <span className="kicker">Hero tool</span>
          <h3>JD-to-Boolean Search Builder</h3>
          <p className="muted">Paste a JD → three search lanes with LinkedIn, Google/Bing X-Ray, and GitHub strings. Strips JD noise automatically.</p>
        </Link>
        <Link className="card" href="/tools/xray-search">
          <span className="kicker">Open-web search</span>
          <h3>X-Ray Launcher</h3>
          <p className="muted">Google X-Ray search builder for GitHub, LinkedIn, public resumes, Stack Overflow, Hugging Face, and open sources.</p>
        </Link>
        <Link className="card" href="/tools/clearance-search">
          <span className="kicker">Cleared / GovCon</span>
          <h3>Clearance Search Builder</h3>
          <p className="muted">Compliant Boolean and X-Ray for TS/SCI, poly, and cert lanes — public clearance language remains an unverified breadcrumb.</p>
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
        <Link className="card" href="/candidate-search">
          <span className="kicker">Public demo</span>
          <h3>Candidate Search</h3>
          <p className="muted">Public-source search, source coverage, market-map summary, evidence review, and beta-gated Candidate 360 workflow.</p>
        </Link>
      </div>
      <div className="cta" style={{ marginTop: '32px' }}>
        <strong>Search strategy → coverage → workbench:</strong> build the lane, measure what is still open, then take the best search into Candidate Search.
      </div>
    </main>
  )
}
