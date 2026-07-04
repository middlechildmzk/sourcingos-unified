import Link from 'next/link'
import { articles } from '@/data/articles'
export const metadata = { alternates: { canonical: '/playbooks' }, title: 'Sourcing Playbooks', description: 'Role-specific sourcing playbooks for hard-to-fill searches.' }
export default function Page(){return <main className="wrap"><h1>Sourcing Playbooks</h1><p className="lead">Role-specific workflows built from the SourcingOS source-pack method.</p><div className="grid">{articles.map(a=><Link className="card" href={`/blog/${a.slug}`} key={a.slug}><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div></main>}
