import Link from 'next/link'
import { articles } from '@/data/articles'

export const metadata = {
  alternates: { canonical: '/blog/' },
  title: 'SourcingOS Guides — Advanced Sourcing, AI Recruiting, Boolean Search, and Contact Data',
  description: 'Senior-sourcer guides, original sourcing frameworks, source-stack strategy, role intake templates, Boolean benchmarks, source contribution metrics, GovCon sourcing, and hiring-manager calibration.',
  openGraph: {
    title: 'SourcingOS Guides — Advanced Sourcing and Recruiting Research',
    description: 'Original sourcing frameworks, benchmark protocols, open-web strategy, GovCon sourcing, and recruiter operating systems.',
    url: '/blog/',
    type: 'website',
  },
}

const flagship = [
  {
    href: '/blog/linkedin-recruiter-alternatives/',
    kicker: 'Tool strategy + free worksheet',
    title: 'LinkedIn Recruiter Alternatives: Build a Source Stack Instead',
    description: 'Unbundle Recruiter into eight sourcing jobs, identify weekly dependencies, and test the uncovered gaps before renewal, downgrade, or cancellation.',
  },
  {
    href: '/blog/where-to-find-cleared-candidates/',
    kicker: 'Cleared & GovCon sourcing',
    title: 'Where to Find Cleared Candidates: The 2026 Sourcing Map',
    description: 'Eleven distinct sourcing lanes plus the rule every cleared recruiter should preserve: public clearance language is a breadcrumb, not verification.',
  },
  {
    href: '/blog/unique-contribution-rate/',
    kicker: 'Source analytics + free calculator',
    title: 'Unique Contribution Rate: Measure What Each Sourcing Channel Actually Adds',
    description: 'A reproducible metric for additive discovery: what share of a source’s evidence-fit leads did none of the other tested sources surface?',
  },
  {
    href: '/blog/senior-sourcer-role-intake/',
    kicker: 'Role intake template',
    title: '25 Hiring Manager Intake Questions That Actually Change the Search',
    description: 'Questions organized by the search parameter they change: evidence, titles, skills, donor companies, geography, compensation, verification, and rejection patterns.',
  },
  {
    href: '/blog/search-exhaustion-framework/',
    kicker: 'Coverage framework + free calculator',
    title: 'Recruiter Search Exhaustion: How to Know When You Have Actually Searched the Market',
    description: 'Seven observable signals replace “we looked everywhere” with lane coverage, duplicate pressure, unique-query yield, donor-map coverage, and expansion evidence.',
  },
  {
    href: '/blog/boolean-search-benchmark/',
    kicker: 'Boolean benchmark protocol',
    title: 'Five Query Archetypes, One Role, Different Talent Pools',
    description: 'Title, skill, evidence, adjacency, and donor-company queries select different signals. Use the five-archetype protocol to measure coverage instead of polishing one string forever.',
  },
  {
    href: '/blog/search-path-scarcity/',
    kicker: 'Flagship methodology',
    title: 'Why Your Candidate Search Returns the Same People Everyone Else Finds',
    description: 'Search-path scarcity makes a healthy market look exhausted. Diagnose the seven collapse points and open independent sourcing lanes before declaring the talent pool empty.',
  },
  {
    href: '/blog/federal-contract-data-sourcing-lane/',
    kicker: 'GovCon sourcing methodology',
    title: 'Federal Contract Data Is a Sourcing Lane',
    description: 'Use USAspending and SAM.gov to build evidence-backed donor-company maps from public federal award data instead of recruiter memory.',
  },
]

const flagshipSlugs = new Set(flagship.map(item => item.href.split('/').filter(Boolean).pop()))
const latest = [...articles].filter(article => !flagshipSlugs.has(article.slug)).reverse()
const featured = latest.slice(0, 4)
const rest = latest.slice(4)

export default function Blog(){
 return <main className="wrap blog-index">
  <div className="eyebrow">SourcingOS Authority Hub</div>
  <h1>Advanced sourcing guides for people who find hard talent.</h1>
  <p className="lead">Tactical content for senior sourcers who need better source stacks, intakes, search lanes, evidence review, Boolean coverage, source contribution metrics, GovCon market maps, and hiring-manager calibration.</p>
  <div className="cta"><strong>Start here:</strong> read the newest original sourcing frameworks and benchmark protocols, then use the free tools to put them into practice.</div>
  <div className="grid two">
   {flagship.map(a=><Link className="card featured authority-card" href={a.href} key={a.href}><span className="kicker">{a.kicker}</span><h2>{a.title}</h2><p className="muted">{a.description}</p></Link>)}
  </div>
  <div className="grid two">
   {featured.map(a=><Link className="card authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h2>{a.title}</h2><p className="muted">{a.description}</p></Link>)}
  </div>
  <section style={{ marginTop: 34 }}>
   <h2>All guides</h2>
   <div className="grid">{rest.map(a=><Link className="card authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div>
  </section>
 </main>
}
