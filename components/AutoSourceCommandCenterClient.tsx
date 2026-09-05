'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const connectorOptions = ['github','orcid','openalex','pubmed','crossref'] as const

type Campaign = { id: string; role_id?: string | null; name: string; query: string; connectors: string[]; status: string; daily_limit: number; auto_promote_threshold: number; last_run_at?: string; next_run_at?: string }
type Run = { id: string; campaign_id: string; status: string; discovered_count: number; promoted_count: number; review_count: number; duplicate_count: number; error_count: number; created_at: string }
type Inbox = { id: string; priority: number; reason: string; status: string; candidates?: { canonical_name: string; headline?: string; current_company?: string; location?: string; skills?: string[] } | Array<{ canonical_name: string; headline?: string; current_company?: string; location?: string; skills?: string[] }> }
type Review = { id: string; display_name: string; headline?: string; organization?: string; location?: string; source_key: string; source_url?: string; campaign_score: number; identity_confidence: number; profile_quality: number }
type Role = { id: string; title: string; status: string }
type Payload = { ok: boolean; mode?: string; campaigns: Campaign[]; runs: Run[]; inbox: Inbox[]; review: Review[]; roles: Role[] }

function candidateFrom(item: Inbox) { return Array.isArray(item.candidates) ? item.candidates[0] : item.candidates }
function words(value: string) { return value.replaceAll('_', ' ') }

export function AutoSourceCommandCenterClient() {
  const [data, setData] = useState<Payload>({ ok: true, campaigns: [], runs: [], inbox: [], review: [], roles: [] })
  const [status, setStatus] = useState('Loading AutoSource…')
  const [name, setName] = useState('Technical talent discovery')
  const [query, setQuery] = useState('senior software engineer cloud security')
  const [skills, setSkills] = useState('AWS, Kubernetes, Terraform, security')
  const [locations, setLocations] = useState('United States')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selected, setSelected] = useState<string[]>(['github','openalex','orcid'])
  const [dailyLimit, setDailyLimit] = useState(250)
  const [threshold, setThreshold] = useState(92)

  async function load() {
    const res = await fetch('/api/autosource/campaigns', { headers: { accept: 'application/json' } })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || 'Could not load AutoSource.')
    setData({ ...json, roles: json.roles || [] })
    setSelectedRoleId(current => current || json.roles?.[0]?.id || '')
    setStatus(json.mode === 'preview' ? 'Preview mode. Sign in to create durable campaigns.' : 'AutoSource is connected and scheduled.')
  }
  useEffect(() => { load().catch(error => setStatus(error instanceof Error ? error.message : 'Could not load AutoSource.')) }, [])

  async function action(payload: Record<string, unknown>, message: string) {
    setStatus(message)
    const res = await fetch('/api/autosource/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.ok) { setStatus(json.error || 'Action failed.'); return }
    setStatus('Done.')
    await load()
  }

  async function createCampaign() {
    await action({ action: 'create', campaign: { roleId: selectedRoleId || null, name, query, connectors: selected, targetCompanies: [], locations: locations.split(',').map(value => value.trim()).filter(Boolean), skills: skills.split(',').map(value => value.trim()).filter(Boolean), dailyLimit, autoPromoteThreshold: threshold } }, 'Creating discovery campaign…')
  }

  const totals = useMemo(() => data.runs.reduce((acc, run) => ({ discovered: acc.discovered + run.discovered_count, promoted: acc.promoted + run.promoted_count, review: acc.review + run.review_count, errors: acc.errors + run.error_count }), { discovered: 0, promoted: 0, review: 0, errors: 0 }), [data.runs])
  const activeCampaigns = data.campaigns.filter(campaign => campaign.status === 'active')

  return <div className="interactive-tool">
    <div className="product-page-head">
      <div><span className="kicker">Autonomous discovery</span><h1>AutoSource</h1><p>Run approved public-source searches continuously. High-confidence identities enter your review queue; ambiguous matches stop here for a recruiter decision.</p></div>
      <div className="product-page-actions"><Link className="btn secondary" href="/app/agent-os">Review candidate queue</Link><button className="btn" onClick={() => document.getElementById('new-campaign')?.setAttribute('open', '')}>New campaign</button></div>
    </div>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Active campaigns</small><b>{activeCampaigns.length}</b><span>Scheduled discovery lanes</span></div>
      <div className="product-stat"><small>Discovered</small><b>{totals.discovered.toLocaleString()}</b><span>Across recent runs</span></div>
      <div className="product-stat"><small>Promoted</small><b>{totals.promoted.toLocaleString()}</b><span>High-confidence candidates</span></div>
      <div className="product-stat"><small>Identity review</small><b>{data.review.length}</b><span>Ambiguous matches waiting</span></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Recruiter control</span><h2>Identity review</h2></div><span>{data.review.length} waiting</span></div>
          <div className="product-list">
            {data.review.slice(0, 40).map(item => <div className="product-row" key={item.id}>
              <div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div className="product-row-title">{item.display_name}</div><span className="status-pill">{item.source_key}</span></div><div className="product-row-meta">{[item.headline, item.organization, item.location].filter(Boolean).join(' · ') || 'Public professional profile'}</div><div className="chips"><span className="tag">role {item.campaign_score}</span><span className="tag">identity {item.identity_confidence}</span><span className="tag">quality {item.profile_quality}</span></div></div>
              <div className="product-row-actions">{item.source_url && <a className="btn ghost" href={item.source_url} target="_blank" rel="noreferrer">Source</a>}<button className="btn secondary" onClick={() => action({ action: 'review', discoveryId: item.id, decision: 'rejected' }, `Rejecting ${item.display_name}…`)}>Reject</button><button className="btn" onClick={() => action({ action: 'review', discoveryId: item.id, decision: 'accepted' }, `Adding ${item.display_name} to the Candidate Graph…`)}>Accept</button></div>
            </div>)}
            {!data.review.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Identity queue is clear</div><div className="product-row-meta">New ambiguous public-source matches will stop here instead of entering the Candidate Graph automatically.</div></div><span className="status-pill success">clear</span></div>}
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Search operations</span><h2>Campaigns</h2></div><span>{data.campaigns.length} total</span></div>
          <div className="product-list">
            {data.campaigns.map(campaign => {
              const role = data.roles.find(item => item.id === campaign.role_id)
              const latest = data.runs.find(run => run.campaign_id === campaign.id)
              return <div className="product-row" key={campaign.id}><div className="product-row-main"><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div className="product-row-title">{campaign.name}</div><span className={`status-pill ${campaign.status === 'active' ? 'active' : ''}`}>{campaign.status}</span></div><div className="product-row-meta">{role ? `${role.title} · ` : ''}{campaign.query}</div><div className="chips">{campaign.connectors.map(connector => <span className="tag" key={connector}>{connector}</span>)}{latest && <span className="tag">last run {latest.discovered_count} found</span>}</div></div><div className="product-row-actions"><button className="btn ghost" onClick={() => action({ action: 'run', campaignId: campaign.id }, `Running ${campaign.name}…`)}>Run now</button><button className="btn secondary" onClick={() => action({ action: 'status', campaignId: campaign.id, status: campaign.status === 'active' ? 'paused' : 'active' }, 'Updating campaign…')}>{campaign.status === 'active' ? 'Pause' : 'Activate'}</button></div></div>
            })}
            {!data.campaigns.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No discovery campaigns yet</div><div className="product-row-meta">Launch an agent from a role, or create a campaign below.</div></div></div>}
          </div>
        </section>

        <details id="new-campaign" className="advanced-disclosure product-panel">
          <summary>Create a custom discovery campaign</summary>
          <div style={{ marginTop: 14 }}><div className="grid two"><label>Campaign name<input className="input" value={name} onChange={event => setName(event.target.value)} /></label><label>Role<select value={selectedRoleId} onChange={event => setSelectedRoleId(event.target.value)}><option value="">Unassigned campaign</option>{data.roles.map(role => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label></div><label>Search intent<textarea className="textarea" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="grid two"><label>Skills<input className="input" value={skills} onChange={event => setSkills(event.target.value)} /></label><label>Locations<input className="input" value={locations} onChange={event => setLocations(event.target.value)} /></label></div><div className="grid two"><label>Daily discovery limit<input className="input" type="number" min={1} max={5000} value={dailyLimit} onChange={event => setDailyLimit(Number(event.target.value))} /></label><label>Auto-promote threshold: {threshold}<input style={{ width: '100%', marginTop: 14 }} type="range" min={70} max={100} value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></label></div><div className="chips" style={{ margin: '10px 0 16px' }}>{connectorOptions.map(connector => <button key={connector} className={selected.includes(connector) ? 'tag' : 'btn ghost'} onClick={() => setSelected(current => current.includes(connector) ? current.filter(item => item !== connector) : [...current, connector])}>{connector}</button>)}</div><button className="btn" onClick={createCampaign} disabled={!selected.length}>Create active campaign</button></div>
        </details>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Candidate flow</h2><span>{data.inbox.length} in inbox</span></div><p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>Candidate review, enrichment, and role routing now live on <b>Today</b> so your daily decisions stay in one place.</p><Link className="btn" href="/app/agent-os">Open Today</Link><div className="product-list" style={{ marginTop: 14 }}>{data.inbox.slice(0, 5).map(item => { const candidate = candidateFrom(item); return <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{candidate?.canonical_name || 'Candidate'}</div><div className="product-row-meta">{[candidate?.headline, candidate?.current_company].filter(Boolean).join(' · ') || item.reason}</div></div><span className="status-pill active">{item.priority}</span></div> })}</div></section>
        <section className="product-panel"><div className="product-panel-head"><h2>Recent runs</h2><span>{data.runs.length}</span></div><div className="product-list">{data.runs.slice(0, 10).map(run => <div className="product-row" key={run.id}><div className="product-row-main"><div className="product-row-title">{data.campaigns.find(campaign => campaign.id === run.campaign_id)?.name || 'Campaign run'}</div><div className="product-row-meta">{run.discovered_count} found · {run.promoted_count} promoted · {run.review_count} review</div></div><span className={`status-pill ${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'warning' : 'active'}`}>{words(run.status)}</span></div>)}</div></section>
        <details className="advanced-disclosure product-panel"><summary>Safety and matching controls</summary><div className="cta" style={{ marginTop: 12 }}><b>Recruiter-controlled:</b> AutoSource uses approved public APIs and source-linked evidence. It does not scrape authenticated recruiting platforms, auto-contact candidates, or silently merge ambiguous identities.</div><p className="muted" style={{ fontSize: 11 }}>Automatic candidate creation requires both identity confidence and campaign relevance to meet the campaign threshold. Everything else waits for review.</p></details>
      </aside>
    </div>
    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{status}</p>
  </div>
}