'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type FleetLane = {
  id: string
  label: string
  sources: string[]
  cadence_minutes: number
  people_limit: number
  credits_per_run: number
  enabled: boolean
  last_run_at?: string | null
  last_run_id?: string | null
  paused_reason?: string | null
  consecutive_empty_runs: number
  consecutive_error_runs: number
  last_result_summary?: { found?: number; errors?: number; warnings?: string[]; completedAt?: string } | null
  next_due_at?: string | null
}

type SourceYield = { source: string; found: number; persisted: number; proposals: number; errors: number; credits: number; lastRunAt: string | null }
type Payload = {
  ok: boolean
  preview?: boolean
  scheduler: { state: 'preview' | 'idle' | 'armed' | 'active'; cadenceMinutes: number; activeLanes: number; pausedLanes: number; lastRunAt: string | null; nextDueAt: string | null }
  graph: { candidates: number; sourceProfiles: number; evidenceItems: number; candidates24h: number; sourceProfiles24h: number; evidence24h: number }
  fleet: { rawDiscoveries24h: number; persisted24h: number; proposals24h: number; errors24h: number; credits24h: number; pendingIdentityReviews: number }
  lanes: FleetLane[]
  sources: SourceYield[]
}

const EMPTY: Payload = {
  ok: true,
  scheduler: { state: 'idle', cadenceMinutes: 30, activeLanes: 0, pausedLanes: 0, lastRunAt: null, nextDueAt: null },
  graph: { candidates: 0, sourceProfiles: 0, evidenceItems: 0, candidates24h: 0, sourceProfiles24h: 0, evidence24h: 0 },
  fleet: { rawDiscoveries24h: 0, persisted24h: 0, proposals24h: 0, errors24h: 0, credits24h: 0, pendingIdentityReviews: 0 },
  lanes: [],
  sources: [],
}

function timeLabel(value?: string | null) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function stateLabel(state: Payload['scheduler']['state']) {
  if (state === 'active') return 'Running'
  if (state === 'armed') return 'Armed — first run due'
  if (state === 'preview') return 'Preview'
  return 'Idle'
}

export function FleetGrowthDashboardClient() {
  const [data, setData] = useState<Payload>(EMPTY)
  const [message, setMessage] = useState('Loading live fleet telemetry…')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    try {
      const response = await fetch('/api/fleet/status', { headers: { accept: 'application/json' }, cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not load fleet status.')
      setData(json)
      setMessage(json.preview ? 'Preview mode — durable fleet telemetry requires production sign-in.' : `Live telemetry · refreshed ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load fleet status.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => load(true), 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  const retainedRate = useMemo(() => data.fleet.rawDiscoveries24h > 0
    ? Math.round((data.fleet.persisted24h / data.fleet.rawDiscoveries24h) * 100)
    : 0, [data.fleet.persisted24h, data.fleet.rawDiscoveries24h])

  return <div className="interactive-tool">
    <div className="product-page-head">
      <div>
        <span className="kicker">24/7 sourcing operations</span>
        <h1>Agent Fleet</h1>
        <p>Watch SourcingOS discover public professional evidence, persist source observations, grow the Candidate Graph, and route deterministic cross-source identity questions to recruiter review.</p>
      </div>
      <div className="product-page-actions">
        <Link className="btn secondary" href="/app/identity-review">Identity review</Link>
        <Link className="btn secondary" href="/app/autosource">AutoSource</Link>
        <button className="btn" disabled={refreshing} onClick={() => load()}>{refreshing ? 'Refreshing…' : 'Refresh live'}</button>
      </div>
    </div>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Fleet state</small><b style={{ fontSize: 22 }}>{stateLabel(data.scheduler.state)}</b><span>{data.scheduler.activeLanes} active lane{data.scheduler.activeLanes === 1 ? '' : 's'} · {data.scheduler.pausedLanes} paused</span></div>
      <div className="product-stat"><small>Candidate Graph</small><b>{data.graph.candidates.toLocaleString()}</b><span>+{data.graph.candidates24h.toLocaleString()} created in 24h</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{data.graph.sourceProfiles.toLocaleString()}</b><span>+{data.graph.sourceProfiles24h.toLocaleString()} in 24h</span></div>
      <div className="product-stat"><small>Evidence</small><b>{data.graph.evidenceItems.toLocaleString()}</b><span>+{data.graph.evidence24h.toLocaleString()} in 24h</span></div>
    </div>

    <div className="product-summary-grid" style={{ marginTop: 14 }}>
      <div className="product-stat"><small>Fleet discoveries · 24h</small><b>{data.fleet.rawDiscoveries24h.toLocaleString()}</b><span>Durable, contact-scrubbed source observations</span></div>
      <div className="product-stat"><small>Persisted · 24h</small><b>{data.fleet.persisted24h.toLocaleString()}</b><span>{retainedRate}% of raw discoveries captured</span></div>
      <div className="product-stat"><small>Identity review · 24h</small><b>{data.fleet.proposals24h.toLocaleString()}</b><span>{data.fleet.pendingIdentityReviews.toLocaleString()} pending recruiter decisions</span></div>
      <div className="product-stat"><small>Fleet health · 24h</small><b>{data.fleet.errors24h.toLocaleString()}</b><span>errors · {data.fleet.credits24h.toLocaleString()} credits</span></div>
    </div>

    <div className="product-layout" style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Standing work</span><h2>Autonomous sourcing lanes</h2></div><span>Scheduler every {data.scheduler.cadenceMinutes}m</span></div>
          <div className="product-list">
            {data.lanes.map(lane => {
              const result = lane.last_result_summary || {}
              const healthy = lane.enabled && !lane.paused_reason && Number(result.errors || 0) === 0
              return <div className="product-row" key={lane.id}>
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div className="product-row-title">{lane.label}</div><span className={`status-pill ${healthy ? 'active' : lane.paused_reason ? 'warning' : ''}`}>{lane.paused_reason ? 'paused' : lane.enabled ? 'active' : 'disabled'}</span></div>
                  <div className="product-row-meta">Last: {timeLabel(lane.last_run_at)} · Next due: {timeLabel(lane.next_due_at)} · {Number(result.found || 0)} found last run · {Number(result.errors || 0)} errors</div>
                  <div className="chips">{(lane.sources || []).map(source => <span className="tag" key={source}>{source}</span>)}<span className="tag">limit {lane.people_limit}/source</span><span className="tag">budget {lane.credits_per_run}</span></div>
                  {lane.paused_reason && <div className="cta" style={{ marginTop: 8 }}>{lane.paused_reason}</div>}
                </div>
              </div>
            })}
            {!data.lanes.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No standing lanes</div><div className="product-row-meta">Create a standing intent to give the fleet recurring sourcing work.</div></div></div>}
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Yield by source</span><h2>Scout performance</h2></div><span>Last 7 days</span></div>
          <div className="product-list">
            {data.sources.map(source => <div className="product-row" key={source.source}><div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="product-row-title">{source.source}</div><span className={`status-pill ${source.errors ? 'warning' : 'success'}`}>{source.errors ? `${source.errors} errors` : 'healthy'}</span></div><div className="product-row-meta">{source.found.toLocaleString()} found · {source.persisted.toLocaleString()} persisted · {source.proposals.toLocaleString()} identity proposals · {source.credits.toLocaleString()} credits</div></div><span className="product-row-meta">{timeLabel(source.lastRunAt)}</span></div>)}
            {!data.sources.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Waiting for the first fleet run</div><div className="product-row-meta">Per-source discovery, persistence, review, error, and credit telemetry will appear here automatically.</div></div></div>}
          </div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Scheduler</h2><span className={`status-pill ${data.scheduler.state === 'active' ? 'success' : 'active'}`}>{stateLabel(data.scheduler.state)}</span></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Last fleet run</div><div className="product-row-meta">{timeLabel(data.scheduler.lastRunAt)}</div></div></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Next due work</div><div className="product-row-meta">{timeLabel(data.scheduler.nextDueAt)}</div></div></div></div></section>
        <section className="product-panel"><div className="product-panel-head"><h2>Trust boundary</h2><span className="status-pill success">enforced</span></div><p className="muted" style={{ fontSize: 12, lineHeight: 1.65 }}>The fleet can discover, normalize, persist evidence, and propose deterministic identity links. It cannot reveal contacts, silently merge people, contact candidates, or make recruiter/hiring decisions.</p><Link className="btn secondary" href="/app/identity-review">Review identity proposals</Link></section>
      </aside>
    </div>

    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{message}</p>
  </div>
}
