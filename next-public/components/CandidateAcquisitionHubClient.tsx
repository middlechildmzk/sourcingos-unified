'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Metrics = { candidates: number; sourceProfiles: number; evidence: number; contacts: number; queued: number }
type Source = { key: string; label: string; category: string; mode: string; note: string; registry?: { status: string; profile_count: number; last_synced_at?: string } | null }
type Payload = { ok: boolean; mode: string; metrics: Metrics; sources: Source[]; target: { target_profiles?: number; target_date?: string; daily_import_target?: number; profiles?: number } }

export function CandidateAcquisitionHubClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [status, setStatus] = useState('Loading live Candidate Graph metrics…')
  const [targetProfiles, setTargetProfiles] = useState(100000)
  const [targetDate, setTargetDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))

  async function load() {
    const res = await fetch('/api/candidate-acquisition', { headers: { accept: 'application/json' } })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || 'Could not load acquisition metrics.')
    setData(json)
    const target = json.target?.target_profiles || json.target?.profiles || 100000
    setTargetProfiles(target)
    if (json.target?.target_date) setTargetDate(json.target.target_date)
    setStatus(json.mode === 'supabase' ? 'Live Supabase metrics loaded.' : 'Preview metrics shown. Sign in to use durable acquisition controls.')
  }

  useEffect(() => { load().catch(error => setStatus(error instanceof Error ? error.message : 'Could not load metrics.')) }, [])

  const remaining = Math.max(0, targetProfiles - (data?.metrics.candidates || 0))
  const days = Math.max(1, Math.ceil((new Date(`${targetDate}T23:59:59`).getTime() - Date.now()) / 86400000))
  const dailyNeeded = Math.ceil(remaining / days)
  const progress = targetProfiles ? Math.min(100, Math.round(((data?.metrics.candidates || 0) / targetProfiles) * 1000) / 10) : 0
  const evidenceCoverage = useMemo(() => {
    const candidates = data?.metrics.candidates || 0
    return candidates ? Math.round(((data?.metrics.evidence || 0) / candidates) * 10) / 10 : 0
  }, [data])

  async function saveTarget() {
    setStatus('Saving growth target…')
    const res = await fetch('/api/candidate-acquisition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'set_target', targetProfiles, targetDate }) })
    const json = await res.json()
    setStatus(res.ok && json.ok ? `Target saved: ${targetProfiles.toLocaleString()} profiles by ${targetDate}.` : json.error || 'Could not save target.')
    if (res.ok) await load()
  }

  return (
    <div className="interactive-tool">
      <div className="cta"><b>Candidate Graph growth control:</b> prioritize data you own, official APIs, and reviewable public professional evidence. No automatic outreach, credential bypassing, or silent identity merges.</div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card"><span className="kicker">Canonical candidates</span><div className="big-number">{(data?.metrics.candidates || 0).toLocaleString()}</div><p className="muted">Deduplicated identities</p></div>
        <div className="card"><span className="kicker">Source profiles</span><div className="big-number">{(data?.metrics.sourceProfiles || 0).toLocaleString()}</div><p className="muted">Profiles linked or awaiting review</p></div>
        <div className="card"><span className="kicker">Evidence records</span><div className="big-number">{(data?.metrics.evidence || 0).toLocaleString()}</div><p className="muted">{evidenceCoverage} evidence items per candidate</p></div>
        <div className="card"><span className="kicker">Enrichment queue</span><div className="big-number">{(data?.metrics.queued || 0).toLocaleString()}</div><p className="muted">Queued, running, or awaiting review</p></div>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="kicker">100K growth target</div>
        <h2 style={{ margin: '6px 0' }}>{progress}% complete</h2>
        <div style={{ height: 12, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden', margin: '12px 0' }}><div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #7c8cff, #58d5c9)' }} /></div>
        <div className="grid two">
          <label>Target profiles<input className="input" type="number" value={targetProfiles} onChange={e => setTargetProfiles(Number(e.target.value))} min={1} max={10000000} /></label>
          <label>Target date<input className="input" type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></label>
        </div>
        <p className="muted">Remaining: {remaining.toLocaleString()} · Required pace: approximately {dailyNeeded.toLocaleString()} new canonical candidates per day for {days} day{days === 1 ? '' : 's'}.</p>
        <button className="btn secondary" onClick={saveTarget}>Save growth target</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="kicker">High-throughput acquisition</div>
        <h2>Import and connection lanes</h2>
        <div className="grid two">
          <div className="card"><h3>1. Owned-data bulk imports</h3><p className="muted">The fastest safe path to scale: LinkedIn connections, ATS, CRM, Avature, HireEZ, SeekOut, Gem, Bullhorn, Greenhouse, Lever, iCIMS, spreadsheets, and prior search exports you are authorized to use.</p><div className="button-row"><Link className="btn" href="/app/network/import">Import LinkedIn →</Link><Link className="btn ghost" href="/app/candidate-database">Import candidate CSV →</Link></div></div>
          <div className="card"><h3>2. Public evidence enrichment</h3><p className="muted">Queue known candidates for public bios, GitHub, publications, patents, conference appearances, company pages, and government records. Evidence remains source-linked and identity matches require review.</p><Link className="btn secondary" href="/app/candidate-database">Review Candidate Graph →</Link></div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="kicker">Connector roadmap</div>
        <h2>Available and planned source lanes</h2>
        <div className="results">
          {(data?.sources || []).map(source => <div className="result-card" key={source.key}>
            <div className="result-head"><span>{source.category.replaceAll('_', ' ')}</span><span>{source.registry?.status || 'available'}</span></div>
            <h3>{source.label}</h3><p>{source.note}</p><div className="chips"><span className="tag">{source.mode.replaceAll('_', ' ')}</span>{source.registry?.profile_count ? <span className="tag">{source.registry.profile_count.toLocaleString()} profiles</span> : null}</div>
          </div>)}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="kicker">One-week execution plan</div><h2>Path toward 100,000 profiles</h2>
        <ol>
          <li>Import every authorized historical candidate, ATS, CRM, sourcing-tool, spreadsheet, and LinkedIn export.</li>
          <li>Normalize and deduplicate into canonical candidates while preserving every source profile.</li>
          <li>Prioritize enrichment for active-role candidates, warm network connections, and high-value technical or cleared talent.</li>
          <li>Add official API connectors for GitHub, ORCID, NCBI/PubMed, USPTO, and USAspending.</li>
          <li>Use public company, conference, research, and government pages as evidence discovery queues, not unreviewed identity claims.</li>
        </ol>
        <p className="muted">{status}</p>
      </section>
    </div>
  )
}
