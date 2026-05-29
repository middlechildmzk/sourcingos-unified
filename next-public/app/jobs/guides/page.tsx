import Link from 'next/link'

export const metadata = {
  title: 'Recruiter Career Guides | SourcingOS Jobs',
  description: 'Career resources for sourcers, recruiters, recruiting ops, healthcare recruiters, GovCon recruiters, and AI recruiting roles.'
}

const guides = [
  ['How to stand out as a technical sourcer', 'Build a sourcing portfolio with source packs, search strings, X-Ray examples, and hiring manager calibration notes.'],
  ['Remote recruiter job search strategy', 'How to target remote recruiter roles, show sourcing impact, and avoid generic application funnels.'],
  ['Recruiting operations career path', 'ATS systems, reporting, funnel analytics, enablement, and workflow automation skills for TA ops roles.'],
  ['GovCon recruiting career path', 'How cleared and federal recruiting differs from commercial TA, and how to position sourcing experience.'],
  ['AI recruiter career path', 'How to build fluency in LLM, MLOps, AI infrastructure, research profiles, and technical evidence.']
]

export default function JobGuidesPage() {
  return (
    <main>
      <section className="wrap hero">
        <div className="eyebrow">Recruiter career hub</div>
        <h1>Career guides for sourcers and recruiters.</h1>
        <p className="lead">SourcingOS Jobs is more than a job board. It is a career intelligence layer for people who find people.</p>
      </section>
      <section className="wrap grid">
        {guides.map(([title, description]) => (
          <div className="card" key={title}>
            <span className="kicker">Guide</span>
            <h3>{title}</h3>
            <p className="muted">{description}</p>
            <Link className="btn secondary" href="/jobs">Browse related jobs</Link>
          </div>
        ))}
      </section>
    </main>
  )
}
