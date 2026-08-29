'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  buildAgenticSearchPlan,
  executableConnectorKeys,
  sourceTruthSummary,
  type AgenticConnectorKey,
  type AgenticLaneId,
  type AgenticSearchLane,
  type AgenticSearchSurface,
} from '@/lib/agentic-search-v30'
import {
  accumulatedResultKeys,
  resultNoveltyRate,
  searchCoverageSummary,
  searchFingerprint,
  shouldExecuteSearch,
  type SearchAttempt,
} from '@/lib/search-state-memory-v30'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

const RESEARCH_CONNECTORS = new Set<AgenticConnectorKey>(['orcid', 'openalex', 'pubmed', 'crossref'])

type AgenticResult = {
  sourceKey: AgenticConnectorKey
  sourceId: string
  sourceUrl?: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  summary?: string
  skills: string[]
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
}

type RunResponse = {
  ok?: boolean
  error?: string
  execution?: string
  persisted?: boolean
  resultCount?: number
  sourceStatus?: Record<string, { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }>
  results?: AgenticResult[]
  trust?: { message?: string }
}

function memoryKey(roleId: string) {
  return `sourcingos.v30.search-memory.${roleId}`
}

function readAttempts(roleId: string): SearchAttempt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(memoryKey(roleId)) || '[]')
    return Array.isArray(parsed) ? parsed.slice(-100) : []
  } catch {
    return []
  }
}

function taskForSurface(lane: AgenticSearchLane, surface: AgenticSearchSurface) {
  return lane.tasks.find(task => task.surface === surface)
}

export function RoleAgenticSearchPanel({ roleId }: { roleId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const plan = useMemo(() => role ? buildAgenticSearchPlan(role.intake, role.calibration) : null, [role])
  const [laneId, setLaneId] = useState<AgenticLaneId>('exact_title')
  const [attempts, setAttempts] = useState<SearchAttempt[]>([])
  const [results, setResults] = useState<AgenticResult[]>([])
  const [sourceStatus, setSourceStatus] = useState<RunResponse['sourceStatus']>({})
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)
  const [novelty, setNovelty] = useState<number | null>(null)

  useEffect(() => {
    setAttempts(readAttempts(roleId))
  }, [roleId])

  useEffect(() => {
    if (!plan?.lanes.some(lane => lane.id === laneId)) setLaneId(plan?.lanes[0]?.id || 'exact_title')
  }, [laneId, plan])

  if (!role || !plan || mode === 'checking') return null

  const lane = plan.lanes.find(item => item.id === laneId) || plan.lanes[0]
  const truth = sourceTruthSummary(lane)
  const coverage = searchCoverageSummary(attempts)
  const executableTasks = lane.tasks.filter(task => task.mode === 'executable' && task.connectorKeys?.length)
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const pendingReview = role.candidates.filter(candidate => candidate.fitDecision === 'unreviewed').length

  function saveAttempts(next: SearchAttempt[]) {
    const trimmed = next.slice(-100)
    setAttempts(trimmed)
    try { localStorage.setItem(memoryKey(roleId), JSON.stringify(trimmed)) } catch { /* Browser memory is best-effort. */ }
  }

  async function runPublicSources() {
    if (working) return
    if (!executableTasks.length) {
      setStatus('This lane has no public connector that SourcingOS can execute on the current deployment. Guided and optional provider tasks remain visible instead of being faked.')
      return
    }

    const allowedTasks = executableTasks.filter(task => shouldExecuteSearch(attempts, task.surface, task.query).execute)
    if (!allowedTasks.length) {
      const blocked = executableTasks.map(task => shouldExecuteSearch(attempts, task.surface, task.query).reason).join(' ')
      setStatus(`Search memory blocked an exact repeat. ${blocked}`)
      return
    }

    const connectors = Array.from(new Set(allowedTasks.flatMap(task => task.connectorKeys || [])))
    const publicQuery = allowedTasks[0].query
    const startedAt = new Date().toISOString()
    const runningAttempts: SearchAttempt[] = allowedTasks.map(task => ({
      id: crypto.randomUUID(),
      roleId,
      laneId: lane.id,
      surface: task.surface,
      query: task.query,
      fingerprint: searchFingerprint(task.surface, task.query),
      status: 'running',
      resultKeys: [],
      startedAt,
    }))
    saveAttempts([...attempts, ...runningAttempts])
    setWorking(true)
    setStatus(`Running ${connectors.length} approved public connector${connectors.length === 1 ? '' : 's'} for ${lane.label}…`)
    setResults([])
    setSourceStatus({})
    setNovelty(null)

    try {
      const response = await fetch('/api/agentic-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: publicQuery,
          skills: role.intake.mustHaves,
          targetCompanies: role.intake.targetCompanies,
          locations: role.intake.location && role.intake.location !== 'Not specified' ? [role.intake.location] : [],
          connectors,
          limit: 30,
        }),
      })
      const json = await response.json() as RunResponse
      if (!response.ok || !json.ok) throw new Error(json.error || 'Agentic search failed.')

      const found = json.results || []
      const previousKeys = accumulatedResultKeys(attempts)
      const currentKeys = found.map(item => `${item.sourceKey}:${item.sourceId}`)
      setNovelty(resultNoveltyRate(previousKeys, currentKeys))
      setResults(found)
      setSourceStatus(json.sourceStatus || {})

      const completedAt = new Date().toISOString()
      const completed = runningAttempts.map(attempt => {
        const connectorSet = attempt.surface === 'github' ? new Set<AgenticConnectorKey>(['github']) : RESEARCH_CONNECTORS
        const keys = found.filter(item => connectorSet.has(item.sourceKey)).map(item => `${item.sourceKey}:${item.sourceId}`)
        const statuses = Array.from(connectorSet).map(key => json.sourceStatus?.[key]?.status).filter(Boolean)
        const failed = statuses.length > 0 && statuses.every(value => value === 'failed' || value === 'unavailable')
        const partial = statuses.some(value => value === 'failed' || value === 'unavailable') && !failed
        return {
          ...attempt,
          status: failed ? 'failed' as const : partial ? 'partial' as const : 'completed' as const,
          resultKeys: keys,
          completedAt,
          message: failed ? 'All connectors for this surface failed.' : `${keys.length} source identities returned.`,
        }
      })
      saveAttempts([...attempts, ...completed])
      setStatus(json.trust?.message || `Found ${found.length} public-source discoveries for recruiter review.`)
    } catch (error) {
      const completedAt = new Date().toISOString()
      saveAttempts([...attempts, ...runningAttempts.map(attempt => ({ ...attempt, status: 'failed' as const, completedAt, message: error instanceof Error ? error.message : 'Agentic search failed.' }))])
      setStatus(error instanceof Error ? error.message : 'Agentic search failed.')
    } finally {
      setWorking(false)
    }
  }

  return <section className="agentic-search-panel" aria-label="Agentic sourcing plan">
    <div className="agentic-spine" aria-label="Role sourcing loop progress">
      <span><b>Brief</b><small>{role.intake.mustHaves.length} must-have{role.intake.mustHaves.length === 1 ? '' : 's'}</small></span>
      <i>→</i>
      <span className="active"><b>Strategy</b><small>{plan.lanes.length} lanes · v{plan.revision}</small></span>
      <i>→</i>
      <span><b>Slate</b><small>{role.candidates.length} people</small></span>
      <i>→</i>
      <span><b>Review</b><small>{pendingReview} waiting</small></span>
      <i>→</i>
      <span><b>Learned</b><small>{plan.approvedLearningCount} approved</small></span>
    </div>

    <div className="agentic-search-head">
      <div>
        <span className="kicker">Agentic search foundation</span>
        <h2>One plan. Distinct strategies. Visible source truth.</h2>
        <p>SourcingOS can run approved public connectors now, guide recruiter-run systems, and expose paid provider slots without pretending they are connected.</p>
      </div>
      <div className="agentic-integrity">
        <b>{plan.distinctQueryCount}/{plan.lanes.length}</b>
        <span>distinct lane queries</span>
      </div>
    </div>

    {!!plan.integrityWarnings.length && <div className="agentic-warning-list">{plan.integrityWarnings.map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}

    <div className="agentic-lane-tabs" role="tablist" aria-label="Search strategy lanes">
      {plan.lanes.map(item => <button key={item.id} role="tab" aria-selected={item.id === lane.id} className={item.id === lane.id ? 'active' : ''} onClick={() => { setLaneId(item.id); setResults([]); setSourceStatus({}); setStatus(''); setNovelty(null) }}><b>{item.priority}</b><span>{item.label}</span></button>)}
    </div>

    <div className="agentic-plan-grid">
      <div className="agentic-lane-detail">
        <div className="agentic-lane-copy">
          <span className="kicker">Hypothesis</span>
          <h3>{lane.label}</h3>
          <p>{lane.hypothesis}</p>
          <div className="agentic-blindspot"><b>Blind spot</b><span>{lane.blindSpot}</span></div>
        </div>
        <div className="agentic-query-box"><span>Canonical lane query</span><code>{lane.query}</code></div>
        <div className="agentic-source-truth">
          <div className="agentic-source-truth-head"><span>Source tasks</span><small>{truth.executable || 0} executable · {truth.guided || 0} guided · {truth.provider_optional || 0} provider-ready</small></div>
          <div className="agentic-source-task-list">{lane.tasks.map(task => <div className="agentic-source-task" key={`${lane.id}:${task.surface}`}>
            <div><span className={`agentic-mode-dot ${task.mode}`} /><div><b>{task.label}</b><small>{task.truth}</small></div></div>
            <span className={`status-pill ${task.mode === 'executable' ? 'success' : task.mode === 'guided' ? 'active' : ''}`}>{task.mode.replace('_', ' ')}</span>
          </div>)}</div>
        </div>
      </div>

      <aside className="agentic-run-card">
        <div><span className="kicker">Run plan</span><h3>Public-source agent pass</h3><p>Read-only research through connectors SourcingOS can execute today. Nothing is persisted until a recruiter chooses the next action.</p></div>
        <div className="agentic-run-metrics">
          <span><b>{coverage.uniqueSearches}</b><small>unique searches</small></span>
          <span><b>{coverage.surfacesSearched}</b><small>surfaces</small></span>
          <span><b>{coverage.uniqueResultsSeen}</b><small>identities seen</small></span>
        </div>
        <button className="btn" disabled={working || !executableConnectorKeys(lane).length} onClick={() => void runPublicSources()}>{working ? 'Researching public sources…' : executableConnectorKeys(lane).length ? 'Run public sources' : 'No executable public source'}</button>
        <Link className="btn secondary" href={`/app/candidate-search?roleId=${encodeURIComponent(role.id)}`}>Open supported candidate search</Link>
        <small className="agentic-run-trust">No auto-send · no auto-reject · no silent identity merge · no clearance verification</small>
      </aside>
    </div>

    {status && <div className="cta agentic-run-status" role="status">{status}</div>}

    {!!Object.keys(sourceStatus || {}).length && <div className="agentic-source-status-row">{Object.entries(sourceStatus || {}).map(([key, value]) => <span key={key} className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`}>{key}: {value.status} · {value.discovered}</span>)}</div>}

    {!!results.length && <div className="agentic-results">
      <div className="agentic-results-head"><div><span className="kicker">Public-source discoveries</span><h3>{results.length} people to review</h3></div>{novelty !== null && <span className="status-pill active">{novelty}% novel vs search memory</span>}</div>
      <div className="agentic-result-grid">{results.slice(0, 18).map(result => <article className="agentic-result-card" key={`${result.sourceKey}:${result.sourceId}`}>
        <div className="agentic-result-top"><span className="status-pill">{result.sourceKey}</span><span>{result.evidence.length} evidence item{result.evidence.length === 1 ? '' : 's'}</span></div>
        <h4>{result.displayName}</h4>
        <p>{[result.headline, result.organization, result.location].filter(Boolean).join(' · ') || 'Public professional identity'}</p>
        {result.evidence[0] && <div className="agentic-result-evidence"><b>{result.evidence[0].label}</b><span>{result.evidence[0].value}</span></div>}
        <div className="agentic-result-foot"><span>Identity {result.identityConfidence}</span><span>Profile {result.profileQuality}</span>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}</div>
      </article>)}</div>
      <div className="agentic-results-note">Results remain read-only discoveries in this PR. The next action layer will normalize, dedupe, evidence-review, and add a person to the role only through an explicit recruiter decision.</div>
    </div>}
  </section>
}
