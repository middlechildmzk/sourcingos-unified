import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/' },
  title: 'Recruiter Training Hub | SourcingOS',
  description: 'Practical SourcingOS training for AI sourcing, source packs, evidence review, hiring manager calibration, cleared sourcing, and Candidate 360 dossiers.',
}

const modules = [
  {
    href: '/training/ai-sourcing-prompts',
    kicker: 'AI sourcing',
    title: 'Build source packs with AI without inventing candidates',
    desc: 'A recruiter-safe prompt workflow for turning messy JDs into search lanes, Boolean strings, X-Ray searches, false-positive filters, and HM questions.',
  },
  {
    href: '/training/evidence-review-checklist',
    kicker: 'Evidence review',
    title: 'Separate facts, signals, assumptions, and missing data',
    desc: 'The review checklist behind Candidate Search and Candidate 360. Know what is public evidence, what is only a breadcrumb, and what still needs verification.',
  },
  {
    href: '/training/hiring-manager-calibration-workshop',
    kicker: 'Calibration',
    title: 'Run a better hiring manager intake',
    desc: 'Questions and meeting structure for turning vague must-haves into market-aware tradeoffs before you burn hours sourcing the wrong lane.',
  },
  {
    href: '/training/cleared-govcon-sourcing-safety',
    kicker: 'GovCon safety',
    title: 'Use clearance breadcrumbs without overclaiming',
    desc: 'A practical guardrail for cleared and federal searches. Search public language, but never treat public clearance text as verified clearance.',
  },
  {
    href: '/training/candidate-360-workshop',
    kicker: 'Candidate 360',
    title: 'Turn evidence into an HM-ready dossier',
    desc: 'A step-by-step framework for building Candidate 360 profiles that show fit, gaps, risks, source provenance, and verify-next actions.',
  },
]

export default function TrainingHubPage() {
  return <main className="wrap article">
    <span className="kicker">SourcingOS Training</span>
    <h1>Recruiter training for evidence-first sourcing.</h1>
    <p className="lead">Practical modules for senior sourcers who want to use AI, open-web search, and Candidate 360 without losing trust, provenance, or human judgment.</p>

    <section>
      <h2>Start here</h2>
      <p>These modules are built around the SourcingOS operating model: role intake, source lanes, public evidence, recruiter-confirmed merges, and human-approved outreach. Use them as internal training, a snack-and-learn outline, or a self-paced sourcer playbook.</p>
      <div className="grid two">
        {modules.map(module => <Link className="card authority-card" href={module.href} key={module.href}>
          <span className="kicker">{module.kicker}</span>
          <h3>{module.title}</h3>
          <p className="muted">{module.desc}</p>
        </Link>)}
      </div>
    </section>

    <section>
      <h2>The rule underneath every module</h2>
      <p>SourcingOS can help structure a search, surface public evidence, and draft next steps. It does not verify identity, clearance, employment, contact accuracy, or final fit. Those decisions stay with the recruiter and the hiring process.</p>
      <p>
        <Link className="btn" href="/candidate-search">Try Candidate Search</Link>{' '}
        <Link className="btn secondary" href="/methodology">Read the methodology</Link>{' '}
        <Link className="btn ghost" href="/trust">Trust rules</Link>
      </p>
    </section>
  </main>
}
