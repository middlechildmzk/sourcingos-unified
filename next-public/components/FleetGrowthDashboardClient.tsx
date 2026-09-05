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
  paused_reason?: string | null
  last_result_summary?: { found?: number; errors?: number; warnings?: string[]; completedAt?: string } | null
  next_due_at?: string | null
}

type AgentDef = { id: string; label: string; team: string; task: string; source?: string; executable: boolean; notes: string }
type SourceYield = { source: string; found: number; persisted: number; proposals: number; errors: number; credits: number; lastRunAt: string | null }
type Payload = {
  ok: boolean
  preview?: boolean
  scheduler: { state: 'preview' | 'idle' | 'armed' | 'active'; discoveryCadenceMinutes: number; enrichmentCadenceMinutes: number; activeLanes: number; pausedLanes: number; lastRunAt: string | null; nextDueAt: string | null }
  graph: { candidates: number; sourceProfiles: number; evidenceItems: number; candidates24h: number; sourceProfiles24h: number; evidence24h: number }
  fleet: { rawDiscoveries24h: number; persisted24h: number; proposals24h: number; errors24h: number; credits24h: number; pendingIdentityReviews: number }
  enrichment: { queued: number; running: number; needsReview: number; completed24h: number; resumeLeads: number; resumesAttached: number; profileFacts24h: number }
  agents: { total: number; executable: number; byTeam: Record<string, number>; definitions: AgentDef[] }
  lanes: FleetLane[]
  sources: SourceYield[]
}

const EMPTY: Payload = {
  ok: true,
  scheduler: { state: 'idle', discoveryCadenceMinutes: 30, enrichmentCadenceMinutes: 15, activeLanes: 0, pausedLanes: 0, lastRunAt: null, nextDueAt: null },
  graph: { candidates: 0, sourceProfiles: 0, evidenceItems: 0, candidates24h: 0, sourceProfiles24h: 0, evidence24h: 0 },
  fleet: { rawDiscoveries24h: 0, persisted24h: 0, proposals24h: 0, errors24h: 0, credits24h: 0, pendingIdentityReviews: 0 },
  enrichment: { queued: 0, running: 0, needsReview: 0, completed24h: 0, resumeLeads: 0, resumesAttached: 0, profileFacts24h: 0 },
  agents: { total: 50, executable: 0, byTeam: {}, definitions: [] },
  lanes: [],
  sources: [],
}

function timeLabel(value?: string | null) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function teamLabel(team: string) {
  return team.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
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

  const teams = useMemo(() => Object.entries(data.agents.byTeam).sort((a, b) => b[1] - a[1]), [data.agents.byTeam])

  return <div className="interactive-tool">
    <div className="product-page-head">
      <div>
        <span className="kicker">Autonomous talent intelligence</span>
        <h1>Agent Fleet</h1>
        <p>Discovery scouts find new people. Resume/CV and enrichment workers continuously improve Talent with provenance-backed employment, skills, education, certifications, professional URLs, projects, and documents.</p>
      </div>
      <div className="product-page-actions">
        <Link className="btn secondary" href="/app/candidate-database">Open Talent</Link>
        <Link className="btn secondary" href="/app/identity-review">Identity review</Link>
        <button className="btn" disabled={refreshing} onClick={() => load()}>{refreshing ? 'Refreshing…' : 'Refresh live'}</button>
      </div>
    </div>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Logical agents</small><b>{data.agents.total}</b><span>{data.agents.executable} wired for current runtime</span></div>
      <div className="product-stat"><small>Talent</small><b>{data.graph.candidates.toLocaleString()}</b><span>+{data.graph.candidates24h.toLocaleString()} candidates in 24h</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{data.graph.sourceProfiles.toLocaleString()}</b><span>+{data.graph.sourceProfiles24h.toLocaleString()} in 24h</span></div>
      <div className="product-stat"><small>Evidence</small><b>{data.graph.evidenceItems.toLocaleString()}</b><span>+{data.graph.evidence24h.toLocaleString()} in 24h</span></div>
    </div>

    <div className="product-summary-grid" style={{ marginTop: 14 }}>
      <div className="product-stat"><small>Discoveries · 24h</small><b>{data.fleet.rawDiscoveries24h.toLocaleString()}</b><span>{data.fleet.persisted24h.toLocaleString()} persisted · {retainedRate}% capture rate</span></div>
      <div className="product-stat"><small>Enrichment queue</small><b>{data.enrichment.queued.toLocaleString()}</b><span>{data.enrichment.running} running · {data.enrichment.completed24h} completed today</span></div>
      <div className="product-stat"><small>Resume/CV intelligence</small><b>{data.enrichment.resumesAttached.toLocaleString()}</b><span>{data.enrichment.resumeLeads.toLocaleString()} public leads · attached only after identity proof</span></div>
      <div className="product-stat"><small>Structured facts · 24h</small><b>{data.enrichment.profileFacts24h.toLocaleString()}</b><span>{data.enrichment.needsReview} enrichment items need review</span></div>
    </div>

    <div className="product-layout" style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">50-agent operating model</span><h2>Specialized teams</h2></div><span>{data.agents.total} roles</span></div>
          <div className="product-list">
            {teams.map(([team, count]) => <div className="product-row" key={team}><div className="product-row-main"><div className="product-row-title">{teamLabel(team)}</div><div className="product-row-meta">{count} logical workers</div></div><span className="status-pill active">{count}</span></div>)}
          </div>
          <div className="chips" style={{ marginTop: 12 }}>{data.agents.definitions.slice(0, 18).map(agent => <span className="tag" title={agent.notes} key={agent.id}>{agent.label}{agent.executable ? '' : ' · staged'}</span>)}</div>
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Standing discovery</span><h2>Sourcing lanes</h2></div><span>Wake every {data.scheduler.discoveryCadenceMinutes}m</span></div>
          <div className="product-list">
            {data.lanes.map(lane => {
              const result = lane.last_result_summary || {}
              const healthy = lane.enabled && !lane.paused_reason && Number(result.errors || 0) === 0
              return <div className="product-row" key={lane.id}>
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div className="product-row-title">{lane.label}</div><span className={`status-pill ${healthy ? 'success' : lane.paused_reason ? 'warning' : 'active'}`}>{lane.paused_reason ? 'paused' : lane.enabled ? 'active' : 'disabled'}</span></div>
                  <div className="product-row-meta">Last: {timeLabel(lane.last_run_at)} · Next: {timeLabel(lane.next_due_at)} · {Number(result.found || 0)} found last run · {Number(result.errors || 0)} errors</div>
                  <div className="chips">{(lane.sources || []).map(source => <span className="tag" key={source}>{source}</span>)}</div>
                </div>
              </div>
            })}
            {!data.lanes.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No standing lanes</div><div className="product-row-meta">Create a standing sourcing intent to give the discovery team recurring work.</div></div></div>}
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Source productivity</span><h2>Scout yield</h2></div><span>Last 7 days</span></div>
          <div className="product-list">
            {data.sources.map(source => <div className="product-row" key={source.source}><div className="product-row-main"><div className="product-row-title">{source.source}</div><div className="product-row-meta">{source.found.toLocaleString()} found · {source.persisted.toLocaleString()} persisted · {source.proposals.toLocaleString()} identity proposals · {source.credits.toLocaleString()} credits</div></div><span className={`status-pill ${source.errors ? 'warning' : 'success'}`}>{source.errors ? `${source.errors} errors` : 'healthy'}</span></div>)}
          </div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Schedulers</h2><span className="status-pill success">active</span></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Discovery</div><div className="product-row-meta">Every {data.scheduler.discoveryCadenceMinutes}m · {data.scheduler.activeLanes} active lanes</div></div></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Enrichment</div><div className="product-row-meta">Every {data.scheduler.enrichmentCadenceMinutes}m · candidate-gap queue</div></div></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Last discovery run</div><div className="product-row-meta">{timeLabel(data.scheduler.lastRunAt)}</div></div></div></div></section>
        <section className="product-panel"><div className="product-panel-head"><h2>Review pressure</h2></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Identity proposals</div><div className="product-row-meta">{data.fleet.pendingIdentityReviews} awaiting recruiter decision</div></div></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Resume identity review</div><div className="product-row-meta">{data.enrichment.needsReview} enrichment tasks need review</div></div></div></div></section>
        <section className="product-panel"><div className="product-panel-head"><h2>Trust boundary</h2><span className="status-pill success">enforced</span></div><p className="muted" style={{ fontSize: 12, lineHeight: 1.65 }}>Public Resume/CV workers may search indexed public links, parse documents that are accessible without authentication, and attach them only after identity corroboration. They never guess Drive IDs, enumerate buckets, bypass Scribd/login walls, reveal contact values, silently merge people, send outreach, or make hiring decisions.</p></section>
      </aside>
    </div>

    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{message}</p>
  </div>
}
