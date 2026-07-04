import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/methodology' },
  title: 'Methodology | SourcingOS',
  description: 'How SourcingOS works: role intake, source lanes, open-web searches, evidence review, recruiter-confirmed Candidate Graph, and Candidate 360 dossiers. A human decides at every step.'
}

export default function MethodologyPage() {
  return <main className="wrap article">
    <span className="kicker">How SourcingOS works</span>
    <h1>Methodology</h1>
    <p className="lead">SourcingOS turns a messy req into an evidence-backed shortlist without taking the judgment out of your hands. Here is the workflow, step by step.</p>

    <section>
      <h2>1. Role intake</h2>
      <p>Start from the JD or the hiring manager conversation. Pull out must-haves, likely titles, adjacent titles, target companies, disqualifiers, and the requirements that are still unclear. Unclear requirements become calibration questions for the HM, not silent assumptions.</p>
    </section>

    <section>
      <h2>2. Source lanes</h2>
      <p>Instead of one giant query, the role gets lanes: a precision lane for exact-fit language, a balanced lane, a market-map lane, plus specialty lanes like GitHub and X-Ray for engineers, research and publication sources for scientists, package ecosystems for open-source contributors, license registries for healthcare, and a GovCon lane that treats clearance terms as unverified breadcrumbs only.</p>
    </section>

    <section>
      <h2>3. Open-web search</h2>
      <p>Searches run against open public sources and as search strings you can run in your own browser. Nothing is scraped from restricted platforms and nothing runs behind a login wall on your behalf.</p>
    </section>

    <section>
      <h2>4. Evidence review</h2>
      <p>Results come back as evidence-first source profiles. Each one separates facts, public signals, assumptions, and missing data, and every claim keeps its source provenance. You see why something matched, what is unknown, and what to verify next.</p>
    </section>

    <section>
      <h2>5. Recruiter-confirmed Candidate Graph</h2>
      <p>Source profiles stay separate records until you confirm they describe the same person. SourcingOS can surface identity signals and possible matches, but the merge decision is yours. No auto-merge, at any confidence level.</p>
    </section>

    <section>
      <h2>6. Candidate 360</h2>
      <p>Confirmed records roll up into an HM-ready dossier: evidence matrix, fit summary, gaps, risk flags, a verify-next checklist, contact signal notes, and a drafted outreach angle you review and send yourself.</p>
    </section>

    <section>
      <h2>Where the human decides</h2>
      <p>Merges, Candidate 360 confirmation, outreach, and final fit calls all require a recruiter. That is not a limitation we apologize for. It is the point.</p>
      <p>
        <Link className="btn" href="/candidate-search">Try the public demo</Link>{' '}
        <Link className="btn secondary" href="/trust">Read the trust rules</Link>
      </p>
    </section>
  </main>
}
