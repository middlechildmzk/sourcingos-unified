import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/candidate-360-workshop/' },
  title: 'Candidate 360 Workshop | SourcingOS',
  description: 'A recruiter training module for building Candidate 360 dossiers that separate evidence, gaps, risk flags, and recruiter-confirmed decisions.',
}

export default function Candidate360WorkshopPage() {
  return <main className="wrap article">
    <span className="kicker">Training module</span>
    <h1>Build Candidate 360 dossiers that hiring managers can trust.</h1>
    <p className="lead">A Candidate 360 profile is not a scraped resume. It is an evidence dossier that shows why the lead is worth reviewing, what is still unknown, and what the recruiter has confirmed.</p>

    <section>
      <h2>The core sections</h2>
      <ul>
        <li>Role fit summary.</li>
        <li>Public evidence matrix.</li>
        <li>Source profiles and URLs.</li>
        <li>Missing data and risk flags.</li>
        <li>Contact signals, when authorized.</li>
        <li>Verify-next checklist.</li>
        <li>Safe outreach angle.</li>
      </ul>
    </section>

    <section>
      <h2>What to keep out</h2>
      <p>Do not include unverified identity merges, invented profile details, guessed current employment, inferred protected characteristics, or clearance claims that came only from public text.</p>
    </section>

    <section>
      <h2>What makes it HM-ready</h2>
      <p>The dossier should help the hiring manager make a fast review decision without hiding uncertainty. The best Candidate 360 shows the evidence, the gap, the recruiter judgment, and the next question.</p>
    </section>

    <section>
      <h2>SourcingOS workflow</h2>
      <p>Use Candidate Search to gather source profiles. Confirm same-person matches manually. Then create a Candidate 360 only after the recruiter decides the evidence belongs together.</p>
      <p>
        <Link className="btn" href="/sample-candidate-360">See sample Candidate 360</Link>{' '}
        <Link className="btn secondary" href="/candidate-search">Try Candidate Search</Link>
      </p>
    </section>
  </main>
}
