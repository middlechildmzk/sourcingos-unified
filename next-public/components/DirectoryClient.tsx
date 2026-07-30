'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { affiliateLabel, toolCategories, toolHref, toolRecords } from '@/lib/tool-directory'
import { trackClientEvent } from '@/lib/analytics'

function badgeFor(category: string) {
  if (category.includes('ATS') || category.includes('CRM')) return 'ATS/CRM workflow'
  if (category.includes('Healthcare')) return 'Healthcare source'
  if (category.includes('Research')) return 'Research evidence'
  if (category.includes('Clearance') || category.includes('GovCon')) return 'GovCon source'
  if (category.includes('AI Sourcing')) return 'Core sourcing tool'
  if (category.includes('Developer') || category.includes('Technical')) return 'Technical evidence'
  if (category.includes('Contact')) return 'Contact finder'
  if (category.includes('OSINT')) return 'OSINT method'
  return 'Specialist tool'
}

export function DirectoryClient() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const filtered = useMemo(() => toolRecords.filter(t =>
    (cat === 'All' || t.category === cat) &&
    (`${t.name} ${t.category} ${t.description} ${t.bestFor}`.toLowerCase().includes(q.toLowerCase()))
  ), [q, cat])

  return <div className="interactive-tool">
    <div className="filter-row">
      <input className="input" placeholder="Search tools, categories, use cases, OSINT methods..." value={q} onChange={e => { setQ(e.target.value); trackClientEvent('directory_search') }} />
      <select className="input" value={cat} onChange={e => setCat(e.target.value)}>{toolCategories.map(c => <option key={c}>{c}</option>)}</select>
    </div>

    <div className="cta">
      <strong>Directory note:</strong> every tool page separates what the product is good at, where it fits in a sourcing workflow, affiliate status, and compliance cautions. Contact data and public signals still require recruiter review.
    </div>

    <div className="directory-grid">
      {filtered.map(t => <Link className="card" href={toolHref(t)} key={t.id} onClick={() => trackClientEvent('directory_tool_opened', t.id, { category: t.category })}>
        <span className="kicker">{badgeFor(t.category)}</span>
        <h3>{t.name}</h3>
        <p className="muted">{t.description}</p>
        <p><strong>Category:</strong> {t.category}</p>
        <p><strong>Best for:</strong> {t.bestFor}</p>
        <p><strong>Cost:</strong> {t.cost}</p>
        <p><strong>Affiliate:</strong> {affiliateLabel(t)}</p>
        <span className="btn secondary" style={{ marginTop: '8px' }}>Open tool page →</span>
      </Link>)}
    </div>
  </div>
}
