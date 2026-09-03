'use client'

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
  note: string
}

type ResponseShape = {
  ok: boolean
  providers?: Provider[]
  connected?: number
  executableNow?: number
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

export function AgentProviderStatusV36_16() {
  const [data, setData] = useState<ResponseShape | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/agentic-sourcing/providers', { headers: { accept: 'application/json' } })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as ResponseShape
        if (!response.ok || !body.ok) throw new Error('provider status unavailable')
        if (alive) setData(body)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const configured = useMemo(() => (data?.providers || []).filter(item => item.configured), [data])
  const liveNow = configured.filter(item => item.executableNow)
  const staged = configured.filter(item => !item.executableNow)

  if (failed) return <div className="agent-data-status"><span className="status-pill">Data tools · status unavailable</span></div>
  if (!data) return <div className="agent-data-status"><span className="status-pill">Checking connected data tools…</span></div>

  return <details className="advanced-disclosure agent-data-status">
    <summary>
      <span className="status-pill success">{data.connected ?? configured.length} connected data tools</span>
      <span className="status-pill">{data.executableNow ?? liveNow.length} executable now</span>
      {!!staged.length && <span className="status-pill">{staged.length} staged</span>}
    </summary>
    <div className="product-list" style={{ marginTop: 8 }}>
      {configured.map(provider => <div className="product-row" key={provider.id}>
        <div className="product-row-main">
          <div className="product-row-title">{provider.label}</div>
          <div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{provider.note}</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {provider.capabilities.slice(0, 5).map(capability => <span className="tag" key={capability}>{label(capability)}</span>)}
          </div>
        </div>
        <div className="chips">
          <span className={`status-pill ${provider.executableNow ? 'success' : ''}`}>{provider.executableNow ? 'ready' : 'staged'}</span>
          <span className="status-pill">{provider.transports.join(' / ')}</span>
          <span className="status-pill">{label(provider.costClass)}</span>
          <span className="status-pill">{label(provider.freshness)}</span>
        </div>
      </div>)}
    </div>
    <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>Connected means a server credential is present. It does not prove plan entitlement, available credits, or provider uptime. Secrets are never returned to the browser.</p>
  </details>
}
