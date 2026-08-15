import Link from 'next/link'
import { articles } from '@/data/articles'

export const metadata = {
  alternates: { canonical: '/blog/' },
  title: 'SourcingOS Guides — Advanced Sourcing, AI Recruiting, Boolean Search, and Contact Data',
  description: 'Senior-sourcer guides, original sourcing frameworks, source packs, Boolean strings, X-Ray playbooks, AI workflows, and hiring-manager calibration.',
}

const latest = [...articles].reverse()
const featured = latest.slice(0, 4)
const rest = latest.slice(4)

const flagship = [
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

export default function Blog(){
 return <main className="wrap blog-index">
  <div className="eyebrow">SourcingOS Authority Hub</div>
  <h1>Advanced sourcing guides for people who find hard talent.</h1>
  <p className="lead">Tactical content for senior sourcers who need better source packs, search lanes, evidence review, AI workflows, contact data decisions, and hiring-manager calibration.</p>
  <div className="cta"><strong>Start here:</strong> read the newest original sourcing frameworks, then use the free tools to put them into practice.</div>
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
