import Link from 'next/link'
import { notFound } from 'next/navigation'
import { affiliateLabel, getToolById, outboundHref, toolRecords } from '@/lib/tool-directory'

export function generateStaticParams() {
  return toolRecords.map(tool => ({ id: tool.id }))
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const tool = getToolById(params.id)
  if (!tool) return {}
  return {
    alternates: { canonical: `/directory/${tool.id}/` },
    title: `${tool.name} Review | SourcingOS Tool Directory`,
    description: `${tool.name} profile for sourcers: workflow fit, safe-use notes, pricing status, affiliate status, and next sourcing steps.`,
  }
}

export default function ToolDetailPage({ params }: { params: { id: string } }) {
  const tool = getToolById(params.id)
  if (!tool) notFound()
  const outbound = outboundHref(tool)

  return <main className="wrap article">
    <span className="kicker">Recruiting tool profile</span>
    <h1>{tool.name}</h1>
    <p className="lead">{tool.description}</p>

    <div className="article-callout">
      <strong>Quick take:</strong> {tool.bestFor} SourcingOS fit score: {tool.sourcingOSFit}/100. {affiliateLabel(tool)}.
    </div>

    <div className="grid two">
      <section className="card">
        <span className="kicker">Workflow fit</span>
        <h2>Where it fits</h2>
        <p><strong>Category:</strong> {tool.category}</p>
        <p><strong>Cost:</strong> {tool.pricingNote || tool.cost}</p>
        <p><strong>Best for:</strong> {tool.bestFor}</p>
      </section>

      <section className="card">
        <span className="kicker">Affiliate readiness</span>
        <h2>Link status</h2>
        <p>{affiliateLabel(tool)}. Add partner links only after the relationship is real and disclosed.</p>
        <p><a className="btn" href={outbound} target="_blank" rel="nofollow sponsored noopener noreferrer">Open official site →</a></p>
      </section>
    </div>

    <section>
      <h2>How sourcers should use it</h2>
      <p>Use {tool.name} when it helps answer a specific sourcing question: where to search, what evidence exists, how to validate a signal, or how to build a better source pack.</p>
      {tool.caution && <div className="preview-banner"><span className="pb-icon">◈</span><span><strong>Safe-use note:</strong> {tool.caution}</span></div>}
    </section>

    <section>
      <h2>SourcingOS checklist</h2>
      <ul>
        <li>Keep source provenance attached.</li>
        <li>Separate facts, public signals, assumptions, and missing data.</li>
        <li>Do not treat any one tool as final confirmation.</li>
        <li>Respect platform terms and privacy expectations.</li>
      </ul>
    </section>

    <section>
      <h2>Next steps</h2>
      <p>
        <Link className="btn secondary" href="/directory">Back to directory</Link>{' '}
        <Link className="btn secondary" href="/tools/search-lane-expander">Open Search Lane Expander</Link>{' '}
        <Link className="btn ghost" href="/candidate-search">Try Candidate Search</Link>
      </p>
    </section>
  </main>
}
