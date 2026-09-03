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

const SEARCH_PROVIDER_ENV: Record<string, string> = {
  pearch: 'PEARCH_API_KEY',
  people_data_labs: 'PDL_API_KEY',
  coresignal: 'CORESIGNAL_API_KEY',
  data_vertex: 'DATAVERTEX_API_KEY',
  contactout: 'CONTACTOUT_API_KEY',
  signalhire: 'SIGNALHIRE_API_KEY',
  linkup: 'LINKUP_API_KEY',
  exa: 'EXA_API_KEY',
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

  const searchProviders = useMemo(() => providers.filter(provider => provider.provider in SEARCH_PROVIDER_ENV), [providers])
  const executable = useMemo(() => searchProviders.filter(provider => provider.executable), [searchProviders])
  const missing = useMemo(() => searchProviders.filter(provider => provider.state === 'missing_key'), [searchProviders])
  const total = searchProviders.length || Object.keys(SEARCH_PROVIDER_ENV).length

  if (state === 'loading') {
    return <div className="cta" style={{ marginTop: 0, marginBottom: 16 }} role="status"><strong>Checking Talent Universe provider connections…</strong></div>
  }

  if (state === 'unavailable') {
    return (
      <div className="preview-banner" style={{ marginBottom: 16 }} role="status">
        <span className="pb-icon">!</span>
        <div><strong>Could not verify external provider connections.</strong><br />The search page is available, but SourcingOS could not read the authenticated provider-status endpoint in this session.</div>
      </div>
    )
  }

  const connectionSummary = `${executable.length}/${total} professional search provider${total === 1 ? '' : 's'} available in this environment`

  if (!executable.length) {
    return (
      <div className="preview-banner" style={{ marginBottom: 16 }} role="status">
        <span className="pb-icon">!</span>
        <div>
          <strong>Provider connections: {connectionSummary}.</strong><br />
          External Talent Universe cannot search until at least one provider key is visible to this deployment. This tab does <b>not</b> silently fall back to imported LinkedIn connections or Candidate Database records.
          {!!missing.length && <div style={{ marginTop: 8 }}><b>Missing from this runtime:</b> {missing.map(provider => SEARCH_PROVIDER_ENV[provider.provider]).join(', ')}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={missing.length ? 'preview-banner' : 'cta'} style={{ marginTop: 0, marginBottom: 16 }} role="status">
      {missing.length ? <span className="pb-icon">!</span> : null}
      <div style={{ width: '100%' }}>
        <strong>Provider connections: {connectionSummary}.</strong>
        {missing.length
          ? <><br /><span>Only the connected providers below will run. Keys shown as missing are not visible to this Preview runtime even if they exist elsewhere in Vercel.</span></>
          : <><br /><span>All implemented professional-search provider keys are visible to this environment.</span></>}
        <div className="chips" style={{ marginTop: 9 }}>
          {executable.map(provider => <span className="tag" key={provider.provider}>{provider.label} · key present</span>)}
        </div>
        {!!missing.length && <div style={{ marginTop: 9, fontSize: 12 }}>
          <b>Missing here:</b> {missing.map(provider => `${provider.label} (${SEARCH_PROVIDER_ENV[provider.provider]})`).join(' · ')}
        </div>}
        <small className="muted" style={{ display: 'block', marginTop: 7 }}>Key presence makes a provider executable but does not prove vendor authentication. A provider becomes live-verified only after a real search succeeds.</small>
      </div>
    </div>
  )
}
