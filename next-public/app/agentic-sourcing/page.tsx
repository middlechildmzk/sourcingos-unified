import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Agentic Sourcing for Recruiters | SourcingOS'
const description = 'Turn a role into distinct sourcing hypotheses, run supported public-source research, guide recruiter-only sources, review evidence, and improve the next search with recruiter-approved learning.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/agentic-sourcing/' },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: '/agentic-sourcing/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

export default function AgenticSourcingPublicPage() {
  return <main className="home-v31">
    <section className="home31-hero">
      <div className="home31-shell home31-hero-grid">
        <div className="home31-hero-copy">
          <div className="home31-kicker">Agentic sourcing · live in private beta</div>
          <h1>An agent that can <em>source</em> without pretending.</h1>
          <p>Give SourcingOS a role. It creates distinct search hypotheses, runs the public sources it can truthfully access, guides restricted-source searches, remembers what it already tried, and carries recruiter-approved learning into the next pass.</p>
          <div className="home31-actions">
            <Link className="home31-primary" href="/waitlist/">Request private beta access</Link>
            <Link className="home31-secondary" href="/candidate-search/">Try public Candidate Search</Link>
          </div>
          <div className="home31-proofrow"><span>Read-only public research</span><span>Visible source modes</span><span>Human hiring decisions</span></div>
        </div>
        <div className="home31-product" aria-label="Illustrative Agentic Sourcing role workspace">
          <div className="home31-product-top"><div className="home31-window-dots"><i></i><i></i><i></i></div><span>Agentic Sourcing · Strategy</span><span>Role memory active</span></div>
          <div className="home31-product-body">
            <div className="home31-product-head"><div><small>Active role</small><h3>Senior Platform Engineer</h3></div><span className="home31-status">Agent ready</span></div>
            <div className="home31-spine"><div>Brief</div><div className="active">Strategy</div><div>Slate</div><div>Review</div><div>Learned</div></div>
            <div className="home31-plan">
              <div className="home31-plan-label"><span>Research hypotheses</span><strong>4 distinct lanes</strong></div>
              <div className="home31-lane"><span className="home31-lane-no">01</span><div><strong>Exact-title market</strong><p>Establish the obvious pool first.</p></div><span className="home31-mode exec">Executable</span></div>
              <div className="home31-lane"><span className="home31-lane-no">02</span><div><strong>Adjacent infrastructure talent</strong><p>Expand beyond title matching.</p></div><span className="home31-mode guided">Guided</span></div>
              <div className="home31-lane"><span className="home31-lane-no">03</span><div><strong>Public engineering evidence</strong><p>Search for technical proof.</p></div><span className="home31-mode exec">Executable</span></div>
              <div className="home31-lane"><span className="home31-lane-no">04</span><div><strong>Licensed people-data expansion</strong><p>Connect only when useful.</p></div><span className="home31-mode optional">Optional</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div className="home31-marquee"><div className="home31-shell home31-marquee-inner">
      <div className="home31-stat"><strong>Distinct hypotheses</strong><span>Different search bets rather than one query repeated across sources.</span></div>
      <div className="home31-stat"><strong>Search memory</strong><span>Exact repeats can be blocked and novelty measured by role.</span></div>
      <div className="home31-stat"><strong>Source truth</strong><span>Executable, guided, provider-optional, or unavailable.</span></div>
      <div className="home31-stat"><strong>Recruiter approval</strong><span>The agent proposes and researches; the recruiter owns consequential actions.</span></div>
    </div></div>

    <section className="home31-section dark"><div className="home31-shell">
      <div className="home31-section-head"><div><div className="home31-kicker">What is live</div><h2>More than a Boolean generator.</h2></div><p>The private product now connects role context, source execution, evidence, recruiter review, calibration, and search memory inside one operating loop.</p></div>
      <div className="home31-loop">
        <div className="home31-loop-card"><b>01</b><h3>Brief</h3><p>Structure must-haves, constraints, adjacent backgrounds, target companies, and role context.</p></div>
        <div className="home31-loop-card active"><b>02</b><h3>Strategy</h3><p>Create distinct hypotheses with rationale, blind spots, source modes, and task-level queries.</p></div>
        <div className="home31-loop-card"><b>03</b><h3>Research</h3><p>Run supported public connectors and generate recruiter-run searches for restricted surfaces.</p></div>
        <div className="home31-loop-card"><b>04</b><h3>Review</h3><p>Inspect evidence, identity uncertainty, fit reasons, concerns, and missing information.</p></div>
        <div className="home31-loop-card"><b>05</b><h3>Learn</h3><p>Approve calibration and make the next sourcing pass visibly different.</p></div>
      </div>
    </div></section>

    <section className="home31-section"><div className="home31-shell">
      <div className="home31-section-head"><div><div className="home31-kicker">Source capability</div><h2>The agent tells you what it actually ran.</h2></div><p>SourcingOS does not call a generated LinkedIn or ClearanceJobs query “autonomous sourcing.” The source mode is part of the result.</p></div>
      <div className="home31-source-grid">
        <div className="home31-source"><div className="home31-source-top"><span className="home31-source-index">01</span><span className="home31-source-badge exec">Executable</span></div><h3>Public research inside SourcingOS</h3><p>Supported connectors run read-only discovery and return source-linked records for recruiter inspection.</p></div>
        <div className="home31-source"><div className="home31-source-top"><span className="home31-source-index">02</span><span className="home31-source-badge guided">Guided</span></div><h3>Recruiter-controlled sources</h3><p>SourcingOS creates the strategy and query while the recruiter runs sources the product cannot lawfully or technically execute.</p></div>
        <div className="home31-source"><div className="home31-source-top"><span className="home31-source-index">03</span><span className="home31-source-badge optional">Provider optional</span></div><h3>Licensed data when needed</h3><p>Commercial people data can plug into the orchestration layer without becoming the reasoning system itself.</p></div>
      </div>
    </div></section>

    <section className="home31-section alt"><div className="home31-shell">
      <div className="home31-section-head"><div><div className="home31-kicker">Role-level intelligence</div><h2>The search can remember what happened.</h2></div><p>The current foundation tracks search fingerprints, unique surfaces, identities seen, and result novelty so repeat work can be identified instead of silently rerun.</p></div>
      <div className="home31-cap-grid">
        <div className="home31-feature-large"><div><div className="home31-kicker">Search memory</div><h3>Do not spend another search on the exact same move.</h3><p>Role-level fingerprints can suppress exact repeats and make the next sourcing pass intentionally different.</p></div><div className="home31-codebox"><div><mark>Pass 01</mark> · exact title · 18 identities</div><div><mark>Pass 02</mark> · public evidence · 73% novel</div><div><mark>Pass 03</mark> · revised after recruiter calibration</div></div></div>
        <div className="home31-feature-stack"><div><div className="home31-kicker">Calibration</div><h3>Learning requires recruiter approval.</h3><p>Candidate decisions can propose useful adjustments, but the recruiter can approve, edit, reject, pause, scope, or roll back learning.</p></div><div><div className="home31-kicker">Evidence boundary</div><h3>External content is data, never instructions.</h3><p>Fetched material is treated as untrusted evidence input. It does not get authority over the agent or hiring workflow.</p></div></div>
      </div>
    </div></section>

    <section className="home31-section dark"><div className="home31-shell home31-trust">
      <div><div className="home31-kicker">Trust model</div><div className="home31-quote">Autonomous <em>research.</em><br/>Human hiring decisions.</div></div>
      <div className="home31-trust-list">
        <div className="home31-trust-row"><b>01</b><div><strong>No autonomous rejection or outreach.</strong><span>The agent can research and propose; consequential hiring actions stay human-controlled.</span></div></div>
        <div className="home31-trust-row"><b>02</b><div><strong>No silent identity merge.</strong><span>Cross-source identity uncertainty remains visible for review.</span></div></div>
        <div className="home31-trust-row"><b>03</b><div><strong>No fake verification.</strong><span>Public clearance, citizenship, employment, and similar signals are not upgraded into verified facts.</span></div></div>
        <div className="home31-trust-row"><b>04</b><div><strong>No fake source execution.</strong><span>Guided recruiter sources are labeled guided rather than claimed as searched.</span></div></div>
      </div>
    </div></section>

    <section className="home31-cta"><div className="home31-shell home31-cta-inner"><h2>Put your next hard role through the agentic sourcing loop.</h2><div><p>Request access to the private workspace, or use the public sourcing tools first.</p><div className="home31-actions"><Link className="home31-primary" href="/waitlist/">Request private beta access</Link><Link className="home31-secondary" href="/tools/">Explore free tools</Link></div></div></div></section>
  </main>
}
