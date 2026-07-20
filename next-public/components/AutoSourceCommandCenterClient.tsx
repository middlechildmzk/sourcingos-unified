'use client'

import { useEffect, useMemo, useState } from 'react'

const connectorOptions = ['github','orcid','openalex','pubmed','crossref'] as const

type Campaign = { id: string; name: string; query: string; connectors: string[]; status: string; daily_limit: number; auto_promote_threshold: number; last_run_at?: string; next_run_at?: string }
type Run = { id: string; campaign_id: string; status: string; discovered_count: number; promoted_count: number; review_count: number; duplicate_count: number; error_count: number; created_at: string }
type Inbox = { id: string; priority: number; reason: string; status: string; candidates?: { canonical_name: string; headline?: string; current_company?: string; location?: string; skills?: string[] } }
type Review = { id: string; display_name: string; headline?: string; organization?: string; location?: string; source_key: string; source_url?: string; campaign_score: number; identity_confidence: number; profile_quality: number }

type Payload = { ok: boolean; campaigns: Campaign[]; runs: Run[]; inbox: Inbox[]; review: Review[] }

export function AutoSourceCommandCenterClient() {
  const [data, setData] = useState<Payload>({ ok: true, campaigns: [], runs: [], inbox: [], review: [] })
  const [status, setStatus] = useState('Loading AutoSource…')
  const [name, setName] = useState('Technical talent discovery')
  const [query, setQuery] = useState('senior software engineer cloud security')
  const [skills, setSkills] = useState('AWS, Kubernetes, Terraform, security')
  const [locations, setLocations] = useState('United States')
  const [selected, setSelected] = useState<string[]>(['github','openalex','orcid'])
  const [dailyLimit, setDailyLimit] = useState(250)
  const [threshold, setThreshold] = useState(92)

  async function load() {
    const res = await fetch('/api/autosource/campaigns', { headers: { accept: 'application/json' } })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || 'Could not load AutoSource.')
    setData(json)
    setStatus(json.mode === 'preview' ? 'Preview mode. Sign in to create durable campaigns.' : 'AutoSource is connected to the Candidate Graph.')
  }
  useEffect(() => { load().catch(err => setStatus(err instanceof Error ? err.message : 'Could not load AutoSource.')) }, [])

  async function action(payload: Record<string, unknown>, message: string) {
    setStatus(message)
    const res = await fetch('/api/autosource/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.ok) { setStatus(json.error || 'Action failed.'); return }
    setStatus('Done.')
    await load()
  }

  async function createCampaign() {
    await action({ action: 'create', campaign: { name, query, connectors: selected, targetCompanies: [], locations: locations.split(',').map(v => v.trim()).filter(Boolean), skills: skills.split(',').map(v => v.trim()).filter(Boolean), dailyLimit, autoPromoteThreshold: threshold } }, 'Creating autonomous campaign…')
  }

  const totals = useMemo(() => data.runs.reduce((acc, run) => ({ discovered: acc.discovered + run.discovered_count, promoted: acc.promoted + run.promoted_count, review: acc.review + run.review_count, duplicates: acc.duplicates + run.duplicate_count }), { discovered: 0, promoted: 0, review: 0, duplicates: 0 }), [data.runs])

  return <div className="interactive-tool">
    <div className="cta"><b>V22 AutoSource:</b> scheduled discovery across approved public APIs, source-linked evidence, automatic creation only above strict identity thresholds, and recruiter review for ambiguous profiles. No authenticated-platform scraping and no automatic outreach.</div>

    <div className="grid" style={{ marginTop: 18 }}>
      <div className="card"><span className="kicker">Campaigns</span><div className="big-number">{data.campaigns.length}</div></div>
      <div className="card"><span className="kicker">Discovered</span><div className="big-number">{totals.discovered.toLocaleString()}</div></div>
      <div className="card"><span className="kicker">Auto-promoted</span><div className="big-number">{totals.promoted.toLocaleString()}</div></div>
      <div className="card"><span className="kicker">Needs review</span><div className="big-number">{data.review.length.toLocaleString()}</div></div>
    </div>

    <section className="card" style={{ marginTop: 20 }}>
      <span className="kicker">V21.7 Discovery campaign</span><h2>Create an autonomous search universe</h2>
      <div className="grid two">
        <label>Campaign name<input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Daily discovery limit<input className="input" type="number" min={1} max={5000} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} /></label>
      </div>
      <label>Search intent<textarea className="textarea" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="grid two">
        <label>Skills<input className="input" value={skills} onChange={e => setSkills(e.target.value)} /></label>
        <label>Locations<input className="input" value={locations} onChange={e => setLocations(e.target.value)} /></label>
      </div>
      <label>Auto-create threshold: {threshold}<input style={{ width: '100%' }} type="range" min={70} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label>
      <div className="chips" style={{ margin: '12px 0' }}>{connectorOptions.map(key => <button key={key} className={selected.includes(key) ? 'tag' : 'btn ghost'} onClick={() => setSelected(current => current.includes(key) ? current.filter(v => v !== key) : [...current, key])}>{key}</button>)}</div>
      <button className="btn" onClick={createCampaign} disabled={!selected.length}>Create active campaign</button>
    </section>

    <section style={{ marginTop: 24 }}><span className="kicker">V21.5 Acquisition engine</span><h2>Active campaigns</h2><div className="results">
      {data.campaigns.map(c => <div className="result-card" key={c.id}><div className="result-head"><span>{c.status}</span><span>{c.daily_limit}/day · threshold {c.auto_promote_threshold}</span></div><h3>{c.name}</h3><p>{c.query}</p><div className="chips">{c.connectors.map(key => <span className="tag" key={key}>{key}</span>)}</div><div className="button-row" style={{ marginTop: 12 }}><button className="btn secondary" onClick={() => action({ action: 'run', campaignId: c.id }, `Running ${c.name}…`)}>Run now</button><button className="btn ghost" onClick={() => action({ action: 'status', campaignId: c.id, status: c.status === 'active' ? 'paused' : 'active' }, 'Updating campaign…')}>{c.status === 'active' ? 'Pause' : 'Activate'}</button></div></div>)}
      {!data.campaigns.length ? <div className="card"><p className="muted">No campaigns yet. Create one above.</p></div> : null}
    </div></section>

    <section style={{ marginTop: 24 }}><span className="kicker">V21.8 Identity review</span><h2>Ambiguous discoveries</h2><div className="results">
      {data.review.slice(0, 30).map(r => <div className="result-card" key={r.id}><div className="result-head"><span>{r.source_key}</span><span>campaign {r.campaign_score} · identity {r.identity_confidence}</span></div><h3>{r.display_name}</h3><p className="muted">{[r.headline,r.organization,r.location].filter(Boolean).join(' · ')}</p>{r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer">Review source →</a> : null}<div className="button-row" style={{ marginTop: 12 }}><button onClick={() => action({ action: 'review', discoveryId: r.id, decision: 'accepted' }, 'Accepting discovery…')}>Accept</button><button onClick={() => action({ action: 'review', discoveryId: r.id, decision: 'rejected' }, 'Rejecting discovery…')}>Reject</button></div></div>)}
      {!data.review.length ? <div className="card"><p className="muted">No ambiguous discoveries awaiting review.</p></div> : null}
    </div></section>

    <section style={{ marginTop: 24 }}><span className="kicker">V22 Recruiter inbox</span><h2>Prioritized candidate feed</h2><div className="results">
      {data.inbox.slice(0, 50).map(item => <div className="result-card" key={item.id}><div className="result-head"><span>{item.status}</span><span>priority {item.priority}</span></div><h3>{item.candidates?.canonical_name || 'Candidate'}</h3><p className="muted">{[item.candidates?.headline,item.candidates?.current_company,item.candidates?.location].filter(Boolean).join(' · ')}</p><p>{item.reason}</p><div className="chips">{(item.candidates?.skills || []).slice(0,8).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div></div>)}
      {!data.inbox.length ? <div className="card"><p className="muted">Candidates promoted by active campaigns will appear here.</p></div> : null}
    </div></section>
    <p className="muted" style={{ marginTop: 20 }}>{status}</p>
  </div>
}
