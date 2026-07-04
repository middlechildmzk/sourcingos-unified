import Link from 'next/link'
import { methods } from '@/data/methods'
export const metadata = { alternates: { canonical: '/methods/' }, title: 'Sourcing Methods Library', description: 'Browse source packs, search lanes, role modes, and senior-sourcer workflows.' }
export default function Page(){return <main className="wrap"><h1>Sourcing Methods Library</h1><p className="lead">A living library of source packs, search lanes, and recruiter operating systems for hard-to-fill roles.</p><div className="grid">{methods.map(m=><Link href={m.href} className="card" key={m.slug}><span className="kicker">Method</span><h3>{m.name}</h3><p className="muted">{m.description}</p></Link>)}</div></main>}
