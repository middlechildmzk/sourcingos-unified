'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Provider = {
  id: string
  label: string
  configured: boolean
  executableNow: boolean
  transports: string[]
  capabilities: string[]
  costClass: string
  freshness: string
  note?: string
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function category(provider: Provider) {
  if (provider.capabilities.some(cap => cap === 'ats_read' || cap === 'ats_write')) return 'Systems'
  if (provider.capabilities.includes('semantic_memory')) return 'Memory'
  if (provider.capabilities.includes('find_contacts') || provider.capabilities.includes('verify_email')) return 'Contact enrichment'
  if (provider.capabilities.includes('search_people')) return 'People discovery'
  if (provider.capabilities.includes('search_web') || provider.capabilities.includes('refresh_entity')) return 'Web & refresh'
  if (provider.capabilities.includes('search_jobs')) return 'Jobs & company'
  return 'Other'
}

export function SourcesWorkspaceV37() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    let alive = true
    fetch('/api/agentic-sourcing/providers', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json.ok || !Array.isArray(json.providers)) throw new Error(json.error || 'Could not load provider status.')
        if (alive) setProviders(json.providers)
      })
      .catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : 'Could not load provider status.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const categories = useMemo(() => ['All', ...Array.from(new Set(providers.map(category)))], [providers])
  const visible = filter === 'All' ? providers : providers.filter(provider => category(provider) === filter)
  const configured = providers.filter(provider => provider.configured).length
  const executable = providers.filter(provider => provider.configured && provider.executableNow).length

  return <div className="sources-workspace-v37">
    <header className="sources-v37-header"><div><span className="search-kicker">Sources</span><h1>Connections, provenance, and evidence.</h1><p>Search and roles use these systems underneath. This workspace is for inspecting configuration, capability, freshness, and trust boundaries.</p></div><div className="sources-v37-header-actions"><Link href="/app/import">Import authorized data</Link><Link className="primary" href="/app/evidence-ledger">Evidence ledger</Link></div></header>

    <section className="sources-v37-metrics"><div><small>Configured</small><b>{configured}</b><span>Credentials detected</span></div><div><small>Executable</small><b>{executable}</b><span>Available to current runtime</span></div><div><small>Providers</small><b>{providers.length}</b><span>Registered capabilities</span></div><div><small>Trust</small><b>Explicit</b><span>Observation ≠ verified fact</span></div></section>

    <div className="sources-v37-grid">
      <main className="sources-v37-provider-pane">
        <div className="sources-v37-toolbar"><div><span className="search-kicker">Provider fabric</span><h2>Connected data tools</h2></div><div>{categories.map(item => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
        {loading && <div className="sources-v37-loading">Loading provider registry…</div>}
        {error && <div className="sources-v37-error">{error}</div>}
        {!loading && !error && <div className="sources-v37-provider-list">{visible.map(provider => <div className="sources-v37-provider" key={provider.id}>
          <span className={`sources-v37-provider-dot ${provider.configured && provider.executableNow ? 'is-live' : provider.configured ? 'is-configured' : 'is-off'}`} />
          <span className="sources-v37-provider-main"><span><strong>{provider.label}</strong><em>{category(provider)}</em></span><small>{provider.note || 'Registered SourcingOS data capability.'}</small><span className="sources-v37-capabilities">{provider.capabilities.slice(0, 8).map(cap => <i key={cap}>{label(cap)}</i>)}</span></span>
          <span className="sources-v37-provider-meta"><b>{provider.configured ? provider.executableNow ? 'Executable' : 'Configured' : 'Not configured'}</b><small>{provider.transports.map(value => value.toUpperCase()).join(' · ') || '—'}</small><small>{label(provider.freshness)} · {label(provider.costClass)}</small></span>
        </div>)}</div>}
      </main>

      <aside className="sources-v37-side">
        <section><div className="search-section-title"><span>Review queues</span><small>human controlled</small></div><Link href="/app/identity-review"><b>Identity review</b><span>Resolve probable cross-source matches before canonical merge.</span></Link><Link href="/app/evidence-ledger"><b>Evidence ledger</b><span>Inspect provenance, conflicts, freshness, and support for candidate claims.</span></Link></section>
        <section><div className="search-section-title"><span>Data operations</span><small>authorized only</small></div><Link href="/app/import"><b>Import center</b><span>Add recruiter-authorized candidate data with owner scope and provenance.</span></Link><Link href="/app/acquisition"><b>Source operations</b><span>Inspect lower-level acquisition and graph-growth controls.</span></Link></section>
        <section><div className="search-section-title"><span>Operating rules</span><small>always on</small></div><ul><li>Provider retrieval score is not candidate fit.</li><li>Missing evidence remains unknown.</li><li>Cross-provider identity uncertainty stays reviewable.</li><li>Company or job evidence never becomes candidate evidence.</li><li>Contact data does not imply permission to contact.</li></ul></section>
      </aside>
    </div>
  </div>
}
