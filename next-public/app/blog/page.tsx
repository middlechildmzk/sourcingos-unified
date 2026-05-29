import Link from 'next/link'
import { articles } from '@/data/articles'
export const metadata = { title: 'SourcingOS Guides', description: 'Senior-sourcer guides, source packs, Boolean strings, X-Ray playbooks, and tool comparisons.' }
export default function Blog(){ return <main className="wrap"><h1>SourcingOS Guides</h1><p className="lead">Tactical content for sourcers who need better search lanes, not generic recruiting thought leadership.</p><div className="grid">{articles.map(a=><Link className="card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div></main> }
