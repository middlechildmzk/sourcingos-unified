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

export default function Blog(){
 return <main className="wrap blog-index">
  <div className="eyebrow">SourcingOS Authority Hub</div>
  <h1>Advanced sourcing guides for people who find hard talent.</h1>
  <p className="lead">Tactical content for senior sourcers who need better source packs, search lanes, evidence review, AI workflows, contact data decisions, and hiring-manager calibration.</p>
  <div className="cta"><strong>Start here:</strong> read the newest original sourcing framework, then use the free tools to put it into practice.</div>
  <Link className="card featured authority-card" href="/blog/search-path-scarcity/" style={{ display:'block', marginTop:28 }}>
    <span className="kicker">New flagship methodology</span>
    <h2>Why Your Candidate Search Returns the Same People Everyone Else Finds</h2>
    <p className="muted">Search-path scarcity makes a healthy market look exhausted. Diagnose the seven collapse points and open independent sourcing lanes before declaring the talent pool empty.</p>
  </Link>
  <div className="grid two">
   {featured.map(a=><Link className="card featured authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h2>{a.title}</h2><p className="muted">{a.description}</p></Link>)}
  </div>
  <section style={{ marginTop: 34 }}>
   <h2>All guides</h2>
   <div className="grid">{rest.map(a=><Link className="card authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div>
  </section>
 </main>
}
