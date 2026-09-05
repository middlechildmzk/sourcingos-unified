import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/ai-sourcing-prompts/' },
  title: 'AI Sourcing Prompts Training | SourcingOS',
  description: 'A recruiter-safe AI prompt workflow for building source packs, Boolean strings, X-Ray searches, and evidence checklists without inventing candidates.',
}

export default function AISourcingPromptsTrainingPage() {
  return <main className="wrap article">
    <span className="kicker">Training module</span>
    <h1>AI sourcing prompts that build strategy, not fake candidates.</h1>
    <p className="lead">Use AI to structure the search, expose assumptions, and build better lanes. Do not use it to invent people, fabricate contact data, or verify things it cannot verify.</p>

    <section>
      <h2>The safe prompt pattern</h2>
      <p>Give the model the role context, ask it to separate must-haves from flexible signals, then require output in lanes. Every lane should include evidence terms, false-positive filters, and a question for the hiring manager.</p>
      <pre>{`You are a senior technical sourcer.
Turn this JD into a source pack.
Return:
1. Must-have evidence
2. Flexible evidence
3. Adjacent titles
4. Donor companies
5. Search lanes
6. Boolean strings
7. X-Ray searches
8. False-positive filters
9. HM calibration questions
Rules: do not invent candidates, links, contact data, clearance, or verification. Label assumptions.`}</pre>
    </section>

    <section>
      <h2>What good output looks like</h2>
      <p>A useful AI output gives you a search plan you can inspect. It should not hide uncertainty. It should make the gaps obvious before you start sourcing.</p>
      <ul>
        <li>Strict lane: exact role, core tools, required domain.</li>
        <li>Adjacent lane: title variants and transferable environments.</li>
        <li>Evidence lane: GitHub, publications, packages, registries, or open-web proof.</li>
        <li>Calibration lane: questions that force tradeoff decisions.</li>
      </ul>
    </section>

    <section>
      <h2>Guardrail prompt to append</h2>
      <pre>{`Do not invent people, companies, jobs, links, profiles, contact data, or verification.
Treat public clearance text as an unverified breadcrumb only.
Treat open-to-work language as a public signal only.
Do not merge identities.
Do not draft outreach unless there is specific evidence to reference.`}</pre>
    </section>

    <section>
      <h2>SourcingOS workflow</h2>
      <p>Use this prompt before Candidate Search. Then run the resulting lanes through BooleanOS, X-Ray Launcher, or Candidate Search so the evidence stays visible and reviewable.</p>
      <p>
        <Link className="btn" href="/tools/jd-search-strategy">Build a source pack</Link>{' '}
        <Link className="btn secondary" href="/candidate-search">Try Candidate Search</Link>
      </p>
    </section>
  </main>
}
