import Link from 'next/link'
import { articles } from '@/data/articles'

export default function Home() {
  return <main>
    <section className="wrap hero">
      <div className="eyebrow">The sourcing stack for hard-to-fill roles</div>
      <h1>Find who your search missed.</h1>
      <p className="lead">SourcingOS helps sourcers turn messy reqs into source packs, open-web searches, and recruiter-confirmed candidate evidence. Start with BooleanOS and X-Ray tools. Request access to the private Candidate Graph beta when you need evidence memory, source-profile matching, and refresh workflows.</p>
      <div className="hero-actions">
        <Link className="btn" href="/tools/boolean-generator">Start with BooleanOS</Link>
        <Link className="btn secondary" href="/tools/xray-search">Launch X-Ray searches</Link>
        <Link className="btn secondary" href="/blog/source-pack-methodology">Learn source packs</Link>
        <Link className="btn ghost" href="/waitlist">Request access</Link>
      </div>
      <div className="cta"><strong>Human-approved sourcing intelligence:</strong> public evidence, source provenance, recruiter-confirmed identity matching, and no silent profile merges.</div>
      <div className="grid">
        <Link className="card" href="/tools/boolean-generator"><span className="kicker">Hero tool</span><h3>BooleanOS</h3><p className="muted">Generate curated search strings by role mode and source.</p></Link>
        <Link className="card" href="/tools/xray-search"><span className="kicker">Open-web search</span><h3>X-Ray Launcher</h3><p className="muted">Launch GitHub, LinkedIn, resume, and open-web searches.</p></Link>
        <Link className="card" href="/sources"><span className="kicker">Private beta preview</span><h3>Candidate Graph</h3><p className="muted">Review source profiles separately, compare identity signals, and confirm matches manually.</p></Link>
        <Link className="card" href="/blog/source-pack-methodology"><span className="kicker">Method</span><h3>Source Pack Methodology</h3><p className="muted">The operating system for hard-to-fill reqs.</p></Link>
      </div>
    </section>
    <section className="wrap">
      <h2>Flagship guides</h2>
      <div className="grid">{articles.slice(0,5).map(a=><Link className="card" href={`/blog/${a.slug}`} key={a.slug}><span className="kicker">{a.category}</span><h3>{a.title}</h3><p className="muted">{a.description}</p></Link>)}</div>
    </section>
  </main>
}
