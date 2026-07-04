import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/evidence-review-checklist/' },
  title: 'Evidence Review Checklist for Sourcers | SourcingOS',
  description: 'A practical checklist for reviewing candidate evidence, public signals, assumptions, missing data, risk flags, and verify-next steps.',
}

export default function EvidenceReviewChecklistPage() {
  return <main className="wrap article">
    <span className="kicker">Training module</span>
    <h1>The evidence review checklist for modern sourcing.</h1>
    <p className="lead">Before a source profile becomes a candidate conversation, separate what is known, what is public signal, what is assumed, and what still needs verification.</p>

    <section>
      <h2>1. Public facts</h2>
      <p>Facts are things directly shown by a public source or a user-imported record you are authorized to use. Examples: a public repo URL, a publication title, a package maintainer page, a listed NPI record, or a profile headline.</p>
    </section>

    <section>
      <h2>2. Public signals</h2>
      <p>Signals are useful but not final. A clearance phrase in a public bio, an open-to-work phrase, a GitHub project, a conference talk, or a package contribution can point you toward fit. They do not verify identity, status, availability, or intent.</p>
    </section>

    <section>
      <h2>3. Assumptions</h2>
      <p>Assumptions are the quiet source of bad submissions. Label them. If two profiles have the same name, that is not a confirmed match. If a repo uses Kubernetes, that does not prove production ownership. If a person lists a company, that does not prove current employment.</p>
    </section>

    <section>
      <h2>4. Missing data</h2>
      <ul>
        <li>Current role and employer.</li>
        <li>Location and work authorization.</li>
        <li>Clearance or license status, when relevant.</li>
        <li>Depth of hands-on experience.</li>
        <li>Contact path and outreach permission norms.</li>
      </ul>
    </section>

    <section>
      <h2>5. Verify-next checklist</h2>
      <p>Every result should end with the next verification step. That may be a second public source, hiring manager clarification, recruiter review, direct candidate confirmation, or a decision to stop pursuing the lead.</p>
    </section>

    <section>
      <h2>SourcingOS workflow</h2>
      <p>Candidate Search and Candidate 360 are designed around this checklist. Confidence means source relevance, not person verification.</p>
      <p>
        <Link className="btn" href="/candidate-search">Review public evidence</Link>{' '}
        <Link className="btn secondary" href="/sample-candidate-360">See Candidate 360</Link>
      </p>
    </section>
  </main>
}
