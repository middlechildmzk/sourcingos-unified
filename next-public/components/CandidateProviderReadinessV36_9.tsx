'use client'

import { useEffect, useMemo, useState } from 'react'

type ProviderStatus = {
  provider: string
  label: string
  state: 'configured' | 'missing_key' | 'planned' | 'disabled'
  executable: boolean
  message: string
}

type StatusResponse = {
  ok?: boolean
  providers?: ProviderStatus[]
  executableSearchProviders?: string[]
}

export function CandidateProviderReadinessV36_9() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let active = true
    void fetch('/api/candidate-data/status', { cache: 'no-store' })
      .then(async response => {
        const json = await response.json() as StatusResponse
        if (!active) return
        if (!response.ok || !json.ok) {
          setState('unavailable')
          return
        }
        setProviders(json.providers || [])
        setState('ready')
      })
      .catch(() => { if (active) setState('unavailable') })
    return () => { active = false }
  }, [])

  const executable = useMemo(() => providers.filter(provider => provider.executable), [providers])
  const missing = useMemo(() => providers.filter(provider => provider.state === 'missing_key'), [providers])

  if (state === 'loading') {
    return <div className="cta" style={{ marginTop: 0, marginBottom: 16 }} role="status"><strong>Checking Talent Universe connections…</strong></div>
  }

  if (state === 'unavailable') {
    return (
      <div className="preview-banner" style={{ marginBottom: 16 }} role="status">
        <span className="pb-icon">!</span>
        <div><strong>Could not verify external provider configuration.</strong><br />The search page is available, but SourcingOS could not read the provider-status endpoint in this session.</div>
      </div>
    )
  }

  if (!executable.length) {
    return (
      <div className="preview-banner" style={{ marginBottom: 16 }} role="status">
        <span className="pb-icon">!</span>
        <div>
          <strong>External Talent Universe is not active in this environment.</strong><br />
          Zero professional people-search providers have executable credentials present. This Talent Universe tab does <b>not</b> silently fall back to your imported LinkedIn connections or Candidate Database; external results will remain empty until at least one provider key is configured. {missing.length ? `${missing.length} implemented provider ${missing.length === 1 ? 'lane is' : 'lanes are'} waiting for credentials.` : ''}
        </div>
      </div>
    )
  }

  return (
    <div className="cta" style={{ marginTop: 0, marginBottom: 16 }} role="status">
      <strong>External Talent Universe configured · {executable.length} provider key{executable.length === 1 ? '' : 's'} present.</strong>
      <div className="chips" style={{ marginTop: 8 }}>
        {executable.map(provider => <span className="tag" key={provider.provider}>{provider.label} · key present</span>)}
        {!!missing.length && <span className="tag muted">{missing.length} more waiting for keys</span>}
      </div>
      <small className="muted">Key presence makes a provider executable but does not prove vendor authentication or API compatibility. A provider is live-verified only after a real search returns successful telemetry. Saved/imported candidates remain a separate source class in My Database / Workbench.</small>
    </div>
  )
}
