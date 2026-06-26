import Link from 'next/link'
import { articles } from '@/data/articles'

export const metadata = {
  title: 'SourcingOS Guides — Advanced Sourcing, AI Recruiting, Boolean Search, and Contact Data',
  description: 'Senior-sourcer guides, source packs, Boolean strings, X-Ray playbooks, contact finder comparisons, AI sourcing workflows, and recruiting tool strategy.',
}

const latest = [...articles].reverse()
const featured = latest.slice(0, 4)
const rest = latest.slice(4)

export default function Blog(){
 return <main className="wrap blog-index">
  <div className="eyebrow">SourcingOS Authority Hub</div>
  <h1>Advanced sourcing guides for people who find hard talent.</h1>
  <p className="lead">Tactical content for senior sourcers who need better source packs, search lanes, evidence review, AI workflows, contact data decisions, and hiring-manager calibration.</p>
  <div className="cta"><strong>Start here:</strong> read the latest guides, then use the free tools to turn the ideas into searches.</div>
  <div className="grid two">
   {featured.map(a=><Link className="card featured authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h2>{a.title}</h2><p className="muted">{a.description}</p></Link>)}
  </div>
  <section style={{ marginTop: 34 }}>
   <h2>All guides</h2>
   <div className="grid">{rest.map(a=><Link className="card authority-card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div>
  </section>
 </main>
}
