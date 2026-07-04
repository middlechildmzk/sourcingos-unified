import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/hiring-manager-calibration-workshop/' },
  title: 'Hiring Manager Calibration Workshop | SourcingOS',
  description: 'A sourcer training module for running better hiring manager intake meetings and turning vague requirements into source lanes.',
}

export default function HiringManagerCalibrationWorkshopPage() {
  return <main className="wrap article">
    <span className="kicker">Training module</span>
    <h1>Run the calibration meeting before you run the search.</h1>
    <p className="lead">The best sourcers do not start with Boolean. They start by forcing clarity around evidence, tradeoffs, false positives, and market reality.</p>

    <section>
      <h2>The meeting structure</h2>
      <ol>
        <li>Restate the business problem in plain language.</li>
        <li>Define what evidence proves someone can do the job.</li>
        <li>Separate strict must-haves from preferences.</li>
        <li>Ask what profiles have already failed and why.</li>
        <li>Agree on the first tradeoff if the market is too small.</li>
      </ol>
    </section>

    <section>
      <h2>Questions that change the search</h2>
      <ul>
        <li>What would make you say yes in 30 seconds?</li>
        <li>Which requirement can flex first: title, domain, location, compensation, tool stack, or seniority?</li>
        <li>What candidate looked close but failed later?</li>
        <li>Which donor companies produce the right environment?</li>
        <li>What evidence would prove depth, not just keyword familiarity?</li>
      </ul>
    </section>

    <section>
      <h2>How to report market friction</h2>
      <p>Do not say the market is bad. Show the lane. Show the count. Show the false positives. Show which requirement collapsed the pool. Then recommend the next experiment.</p>
    </section>

    <section>
      <h2>SourcingOS workflow</h2>
      <p>The JD Strategy Tool turns intake notes into search lanes and calibration questions. Candidate Search turns those lanes into public evidence you can review with the hiring manager.</p>
      <p>
        <Link className="btn" href="/tools/jd-search-strategy">Generate HM questions</Link>{' '}
        <Link className="btn secondary" href="/blog/hiring-manager-calibration-questions">Read the full guide</Link>
      </p>
    </section>
  </main>
}
