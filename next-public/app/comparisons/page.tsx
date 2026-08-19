import Link from 'next/link'
import { comparisons } from '@/data/comparisons'

export const metadata = {
  alternates: { canonical: '/comparisons/' },
  title: 'Recruiting Tool Comparisons',
  description: 'Workflow-first comparison topics for sourcers evaluating tools and alternative stacks.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Recruiting Tool Comparison Topics | SourcingOS',
    description: 'Comparison topics under development. Use the recruiting tool directory and published sourcing frameworks for current decision support.',
    url: '/comparisons/',
    type: 'website',
  },
}

export default function Page(){
  return <main className="wrap"><h1>Recruiting Tool Comparison Topics</h1><p className="lead">These comparison routes are retained as a product roadmap and internal navigation layer, but the vendor-specific comparison research is not deep enough to publish as a search-facing buyer guide yet.</p><div className="grid">{comparisons.map(c=><Link className="card" href={`/comparisons/${c.slug}`} key={c.slug}><h3>{c.title}</h3><p className="muted">{c.description}</p></Link>)}</div><div className="cta"><strong>Use now:</strong> <Link href="/directory/">browse the recruiting tool directory</Link> or <Link href="/blog/ai-sourcing-workflow-2026/">use the 8-task AI sourcing evaluation harness</Link>.</div></main>
}
