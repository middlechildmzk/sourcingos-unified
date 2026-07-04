import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/about/' },
  title: 'About | SourcingOS',
  description: 'SourcingOS is a human-approved sourcing intelligence layer built by a working senior technical and cleared sourcer. Evidence first, recruiter in charge, no fake data.'
}

export default function AboutPage() {
  return <main className="wrap article">
    <span className="kicker">About</span>
    <h1>About SourcingOS</h1>
    <p className="lead">SourcingOS exists because most sourcing tools lie a little. Match scores with no evidence. Verified badges that verify nothing. Contact data of unknown age. Recruiters pay for that with their credibility.</p>

    <section>
      <h2>What it is</h2>
      <p>SourcingOS is a sourcing judgment layer for hard-to-fill roles. It helps you go from a messy req to role intake, source lanes, open-web searches, evidence-first source profiles, recruiter-confirmed Candidate Graph records, and HM-ready Candidate 360 dossiers. Every claim keeps its source, every merge needs your confirmation, and outreach is draft-only.</p>
    </section>

    <section>
      <h2>Who it is for</h2>
      <p>Senior sourcers and recruiters working technical, cleared and GovCon, healthcare, and AI/ML searches. People who already know how to source and want leverage, not a black box that hides the work.</p>
    </section>

    <section>
      <h2>Who builds it</h2>
      <p>SourcingOS is built by a working senior technical and cleared sourcer and is dogfooded against real reqs every week. If a feature does not hold up in the first 30 minutes of a real workday, it does not ship.</p>
    </section>

    <section>
      <h2>Where it is today</h2>
      <p>The free tools and the Candidate Search demo are open to everyone. The full workbench, including Candidate Graph and Candidate 360, is in private beta.</p>
      <p>
        <Link className="btn" href="/candidate-search">Try Candidate Search</Link>{' '}
        <Link className="btn secondary" href="/waitlist">Request beta access</Link>
      </p>
    </section>
  </main>
}
