import Link from 'next/link'

export const metadata = {
  title: 'Free Sourcing Tools | SourcingOS',
  description:
    'Source Stack Coverage, BooleanOS, Search Lane Expander, Search Exhaustion, Unique Contribution Rate, X-Ray, and JD Strategy tools for technical and hard-to-fill recruiting.',
  alternates: { canonical: '/tools/' },
  openGraph: {
    title: 'Free Sourcing Tools | SourcingOS',
    description: 'Free tools for role intake, Boolean search, source-lane expansion, source-stack coverage, search exhaustion, UCR, and open-web sourcing.',
    url: '/tools/',
    type: 'website',
  },
}

export default function Tools() {
  return (
    <main className="wrap">
      <div className="eyebrow">Free tools</div>
      <h1>Free sourcing tools. No account required.</h1>
      <p className="lead">
        Build search lanes, measure source overlap and coverage, pressure-test your sourcing stack, and turn recruiting assumptions into evidence before you buy another tool or abandon a market.
      </p>

      <section className="article-callout" style={{ marginBottom: '24px' }}>
        <h2>Which role-to-search tool should I use?</h2>
        <div className="grid">
          <div className="card"><span className="kicker">At intake</span><h3>JD Strategy Tool</h3><p className="muted">Input: a messy job description. Output: a source pack with evidence requirements, target titles, lanes, Boolean strings, and HM calibration questions.</p></div>
          <div className="card"><span className="kicker">You know the role</span><h3>BooleanOS</h3><p className="muted">Input: a role you already understand. Output: ready-to-paste Boolean search strings by role mode.</p></div>
          <div className="card"><span className="kicker">Mid-search</span><h3>Search Lane Expander</h3><p className="muted">Input: a search returning too few results. Output: Precision, Balanced, Broad, and Market Map lanes plus expansion actions.</p></div>
        </div>
      </section>

      <div className="grid">
        <Link className="card featured" href="/tools/source-stack-coverage">
          <span className="kicker">New stack strategy tool</span>
          <h3>Source Stack Coverage Worksheet</h3>
          <p className="muted">Unbundle LinkedIn Recruiter into eight sourcing jobs, mark the weekly dependencies your team actually uses, and expose coverage gaps before renewal or cancellation.</p>
        </Link>
        <Link className="card featured" href="/tools/unique-contribution-rate-calculator">
          <span className="kicker">Source analytics tool</span>
          <h3>UCR Calculator</h3>
          <p className="muted">Measure the share of a source&apos;s evidence-fit leads that no other tested source surfaced, plus optional cost per unique lead.</p>
        </Link>
        <Link className="card featured" href="/tools/search-exhaustion-calculator">
          <span className="kicker">Coverage evidence tool</span>
          <h3>Search Exhaustion Evidence Calculator</h3>
          <p className="muted">Calculate lane coverage, duplicate rate, unique-query yield, donor-map coverage, adjacent-title yield, and recent new-lead rate before declaring a market exhausted.</p>
        </Link>
        <Link className="card featured" href="/tools/search-lane-expander">
          <span className="kicker">Mid-search expansion</span>
          <h3>Search Lane Expander</h3>
          <p className="muted">Turn a rough role target into Precision, Balanced, Broad, and Market Map lanes with live sources, manual-safe X-Ray links, and low-result rescue actions.</p>
        </Link>
        <Link className="card" href="/tools/boolean-generator">
          <span className="kicker">Role-mode string builder</span>
          <h3>BooleanOS</h3>
          <p className="muted">Build ready-to-paste Boolean strings by role mode when you already understand the role and need search syntax now.</p>
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
          <span className="kicker">Intake and source pack</span>
          <h3>JD Strategy Tool</h3>
          <p className="muted">Turn a messy JD into evidence requirements, source lanes, Boolean strings, target titles, and HM calibration questions.</p>
        </Link>
        <Link className="card" href="/candidate-search">
          <span className="kicker">Public demo</span>
          <h3>Candidate Search</h3>
          <p className="muted">Public-source search, source coverage, market-map summary, evidence review, and beta-gated Candidate 360 workflow.</p>
        </Link>
      </div>
      <div className="cta" style={{ marginTop: '32px' }}>
        <strong>Stack → intake → strings → expansion → evidence:</strong> identify what your tools cover, use JD Strategy at intake, BooleanOS when the role is clear, Search Lane Expander when coverage is narrow, then review evidence in Candidate Search.
      </div>
      <div className="cta" style={{ marginTop: '16px' }}>
        <strong>See what the workflow produces:</strong>{' '}
        <Link href="/sample-candidate-360/">open the synthetic Candidate 360 dossier</Link> to inspect evidence, unknowns, recruiter-confirmed identity resolution, and verify-next steps before joining the beta.
      </div>
    </main>
  )
}
