import Link from 'next/link'

export const metadata = {
  title: 'Recruiter Career Guide Topics | SourcingOS Jobs',
  description: 'A practical index of career topics for sourcers, recruiters, recruiting ops, healthcare recruiters, GovCon recruiters, and AI recruiting roles.',
  alternates: { canonical: '/jobs/guides/' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Recruiter Career Guide Topics | SourcingOS Jobs',
    description: 'Explore the recruiter career topics SourcingOS is developing alongside its sourcing tools and job search.',
    url: '/jobs/guides/',
    type: 'website',
  },
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
        <div className="eyebrow">Recruiter career topics</div>
        <h1>Career topics for sourcers and recruiters.</h1>
        <p className="lead">This is a topic index, not a finished guide library yet. Use it to see the career areas SourcingOS is developing alongside the live job search and sourcing toolkit.</p>
      </section>
      <section className="wrap grid">
        {guides.map(([title, description]) => (
          <div className="card" key={title}>
            <span className="kicker">Topic</span>
            <h3>{title}</h3>
            <p className="muted">{description}</p>
            <Link className="btn secondary" href="/jobs">Browse related jobs</Link>
          </div>
        ))}
      </section>
    </main>
  )
}
