import Link from 'next/link'
import { comparisons } from '@/data/comparisons'
export const metadata = { alternates: { canonical: '/comparisons/' }, title: 'Recruiting Tool Comparisons', description: 'Workflow-first comparisons for sourcers evaluating tools and alternative stacks.' }
export default function Page(){return <main className="wrap"><h1>Recruiting Tool Comparisons</h1><p className="lead">Comparison pages for people buying workflows, not just feature lists.</p><div className="grid">{comparisons.map(c=><Link className="card" href={`/comparisons/${c.slug}`} key={c.slug}><h3>{c.title}</h3><p className="muted">{c.description}</p></Link>)}</div></main>}
