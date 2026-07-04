import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/trust/' },
  title: 'Trust Rules | SourcingOS',
  description: 'The non-negotiable rules SourcingOS is built on: no fake candidates, public evidence only, no auto-outreach, no silent merges, and human verification required.'
}

export default function TrustPage() {
  return <main className="wrap article">
    <span className="kicker">SourcingOS trust</span>
    <h1>Trust rules</h1>
    <p className="lead">Recruiters get burned by tools that overclaim. These are the rules SourcingOS will not break, in the product and in the code.</p>

    <section>
      <h2>No fake candidates</h2>
      <p>SourcingOS never invents people, companies, jobs, links, or contact data. If a search finds nothing, you see an honest empty state with suggestions for the next search, not filler results.</p>
    </section>

    <section>
      <h2>Public evidence only</h2>
      <p>Every record traces back to a public URL or to data you imported yourself. Source provenance stays attached to each evidence artifact so you can always answer the question: where did this come from?</p>
    </section>

    <section>
      <h2>Signals are not verification</h2>
      <p>Clearance language in a public bio is an unverified clearance breadcrumb. Open-to-work phrasing is a public signal. A matching name across two profiles is a possible match. None of these are treated as verified. Human verification is required before any of them count.</p>
    </section>

    <section>
      <h2>No silent merges</h2>
      <p>Source profiles stay separate until a recruiter reviews the identity signals and confirms they belong to the same person. There is no auto-merge at any confidence level.</p>
    </section>

    <section>
      <h2>No auto-outreach</h2>
      <p>SourcingOS drafts outreach angles grounded in the evidence you selected. It never sends anything. You review, edit, and send from your own tools.</p>
    </section>

    <section>
      <h2>No restricted-platform scraping</h2>
      <p>SourcingOS does not scrape LinkedIn, Indeed, ClearanceJobs, or paid resume databases, and it does not automate anything behind a login wall. X-Ray search strings are provided for you to run in your own browser and review yourself.</p>
    </section>

    <section>
      <h2>Fail closed</h2>
      <p>Private routes and write APIs require authentication. If the auth backend is unavailable, they refuse the request instead of quietly letting it through.</p>
    </section>

    <section>
      <h2>See it in practice</h2>
      <p>The methodology page walks through how these rules shape the actual workflow, and the data sources page lists exactly which public sources power search.</p>
      <p>
        <Link className="btn secondary" href="/methodology">Read the methodology</Link>{' '}
        <Link className="btn secondary" href="/data-sources">See data sources</Link>
      </p>
    </section>
  </main>
}
