import Link from 'next/link'
import { methods } from '@/data/methods'

export const metadata = {
  alternates: { canonical: '/methods/' },
  title: 'Sourcing Methods Library',
  description: 'Browse documented source-pack methods, search lanes, research workflows, and recruiter tools for hard-to-fill roles.',
  openGraph: {
    title: 'Sourcing Methods Library | SourcingOS',
    description: 'An index into documented source-pack methods, search lanes, research workflows, and recruiter tools.',
    url: '/methods/',
    type: 'website',
  },
}

export default function Page(){
  return <main className="wrap">
    <h1>Sourcing Methods Library</h1>
    <p className="lead">An index into SourcingOS methods documented across practical guides and tools. Choose the lane that matches the sourcing problem you are trying to solve.</p>
    <div className="cta"><strong>AI sourcing foundation:</strong> <Link href="/ai-sourcing/">read the AI sourcing workflow, tools, and guardrails pillar</Link> before choosing individual methods or automation layers.</div>
    <div className="grid">{methods.map(m=><Link href={m.href} className="card" key={m.slug}><span className="kicker">Method</span><h3>{m.name}</h3><p className="muted">{m.description}</p></Link>)}</div>
  </main>
}
