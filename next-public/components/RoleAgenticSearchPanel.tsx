'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  executableConnectorKeys,
  sourceTruthSummary,
  type AgenticConnectorKey,
  type AgenticLaneId,
  type AgenticSearchSurface,
} from '@/lib/agentic-search-v30'
import { buildCanonicalAgenticSearchPlan, executableTaskDistinctness } from '@/lib/canonical-agentic-search-v30'
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
const GITHUB_CONNECTORS = new Set<AgenticConnectorKey>(['github'])
const NPI_CONNECTORS = new Set<AgenticConnectorKey>(['npi'])

type AgenticResult = {
  sourceKey: AgenticConnectorKey
  sourceId: string
  sourceUrl?: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
}

type RunResponse = {
  ok?: boolean
  error?: string
  sourceStatus?: Record<string, { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }>
  results?: AgenticResult[]
  trust?: { message?: string; externalContent?: string; registryData?: string }
}

function memoryKey(roleId: string) {
  return `sourcingos.v30.search-memory.${roleId}`
}

function readAttempts(roleId: string): SearchAttempt[] {
  try {
    const value = JSON.parse(localStorage.getItem(memoryKey(roleId)) || '[]')
    return Array.isArray(value) ? value.slice(-100) : []
  } catch {
    return []
  }
}

function connectorsForSurface(surface: AgenticSearchSurface): Set<AgenticConnectorKey> {
  if (surface === 'github') return GITHUB_CONNECTORS
  if (surface === 'healthcare_registry') return NPI_CONNECTORS
  if (surface === 'research_publications') return RESEARCH_CONNECTORS
  return new Set<AgenticConnectorKey>()
}

export function RoleAgenticSearchPanel({ roleId }: { roleId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const plan = useMemo(() => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration) : null, [role])
  const [laneId, setLaneId] = useState<AgenticLaneId>('exact_title')
  const [attempts, setAttempts] = useState<SearchAttempt[]>([])
  const [results, setResults] = useState<AgenticResult[]>([])
  const [sourceStatus, setSourceStatus] = useState<RunResponse['sourceStatus']>({})
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)
  const [novelty, setNovelty] = useState<number | null>(null)

  useEffect(() => setAttempts(readAttempts(roleId)), [roleId])
  useEffect(() => {
    if (plan && !plan.lanes.some(lane => lane.id === laneId)) setLaneId(plan.lanes[0]?.id || 'exact_title')
  }, [laneId, plan])

  if (!role || !plan || mode === 'checking') return null
  const activeRole = role
  const lane = plan.lanes.find(item => item.id === laneId) || plan.lanes[0]
  if (!lane) return null

  const truth = sourceTruthSummary(lane)
  const taskDistinctness = executableTaskDistinctness(plan)
  const coverage = searchCoverageSummary(attempts)
  const executableTasks = lane.tasks.filter(task => task.mode === 'executable' && task.connectorKeys?.length)
  const reviewed = activeRole.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const waiting = activeRole.candidates.filter(candidate => candidate.fitDecision === 'unreviewed').length

  function saveAttempts(next: SearchAttempt[]) {
    const trimmed = next.slice(-100)
    setAttempts(trimmed)
    try { localStorage.setItem(memoryKey(roleId), JSON.stringify(trimmed)) } catch { /* best effort */ }
  }

  async function runPublicSources() {
    if (working) return
    if (!executableTasks.length) {
      setStatus('This strategy has no public connector SourcingOS can truthfully execute today. Guided and provider-ready tasks remain visible instead of being faked.')
      return
    }

    const allowedTasks = executableTasks.filter(task => shouldExecuteSearch(attempts, task.surface, task.query).execute)
    if (!allowedTasks.length) {
      setStatus('Search memory blocked an exact repeat. Change the strategy or role criteria before spending another search.')
      return
    }

    const connectors = Array.from(new Set(allowedTasks.flatMap(task => task.connectorKeys || [])))
    const connectorQueries: Partial<Record<AgenticConnectorKey, string>> = {}
    for (const task of allowedTasks) {
      for (const connector of task.connectorKeys || []) connectorQueries[connector] = task.query
    }
    const query = allowedTasks[0].query
    const startedAt = new Date().toISOString()
    const running: SearchAttempt[] = allowedTasks.map(task => ({
      id: crypto.randomUUID(), roleId, laneId: lane.id, surface: task.surface, query: task.query,
      fingerprint: searchFingerprint(task.surface, task.query), status: 'running', resultKeys: [], startedAt,
    }))

    saveAttempts([...attempts, ...running])
    setWorking(true)
    setResults([])
    setSourceStatus({})
    setNovelty(null)
    setStatus(`Researching ${lane.label} across ${connectors.length} executable connector${connectors.length === 1 ? '' : 's'}…`)

    try {
      const intake = activeRole.intake
      const response = await fetch('/api/agentic-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
          connectorQueries,
          skills: intake.mustHaves,
          targetCompanies: intake.targetCompanies,
          locations: intake.location && intake.location !== 'Not specified' ? [intake.location] : [],
          connectors,
          limit: 30,
        }),
      })
      const json = await response.json() as RunResponse
      if (!response.ok || !json.ok) throw new Error(json.error || 'Public-source research failed.')

      const found = json.results || []
      const currentKeys = found.map(item => `${item.sourceKey}:${item.sourceId}`)
      setNovelty(resultNoveltyRate(accumulatedResultKeys(attempts), currentKeys))
      setResults(found)
      setSourceStatus(json.sourceStatus || {})

      const completedAt = new Date().toISOString()
      const completed = running.map(attempt => {
        const connectorSet = connectorsForSurface(attempt.surface)
        const keys = found.filter(item => connectorSet.has(item.sourceKey)).map(item => `${item.sourceKey}:${item.sourceId}`)
        const statuses = Array.from(connectorSet).map(key => json.sourceStatus?.[key]?.status).filter(Boolean)
        const failed = statuses.length > 0 && statuses.every(value => value === 'failed' || value === 'unavailable')
        const partial = statuses.some(value => value === 'failed' || value === 'unavailable') && !failed
        return { ...attempt, status: failed ? 'failed' as const : partial ? 'partial' as const : 'completed' as const, resultKeys: keys, completedAt, message: `${keys.length} source identities returned.` }
      })
      saveAttempts([...attempts, ...completed])
      setStatus(json.trust?.message || `Found ${found.length} public-source discoveries for recruiter review.`)
    } catch (error) {
      const completedAt = new Date().toISOString()
      saveAttempts([...attempts, ...running.map(attempt => ({ ...attempt, status: 'failed' as const, completedAt, message: error instanceof Error ? error.message : 'Search failed.' }))])
      setStatus(error instanceof Error ? error.message : 'Public-source research failed.')
    } finally {
      setWorking(false)
    }
  }

  return <section className="agentic-search-panel" aria-label="Role research strategy">
    <div className="agentic-spine" aria-label="Sourcing loop">
      <span><b>Brief</b><small>{activeRole.intake.mustHaves.length} must-haves</small></span><i>→</i>
      <span className="active"><b>Strategy</b><small>{plan.lanes.length} hypotheses · v{plan.revision}</small></span><i>→</i>
      <span><b>Slate</b><small>{activeRole.candidates.length} people</small></span><i>→</i>
      <span><b>Review</b><small>{waiting} waiting · {reviewed} reviewed</small></span><i>→</i>
      <span><b>Learned</b><small>{plan.approvedLearningCount} approved</small></span>
    </div>

    <div className="agentic-search-head">
      <div><span className="kicker">Role research strategy</span><h2>Distinct hypotheses with visible source truth.</h2><p>Each lane states why it exists, what it can miss, and which sources SourcingOS can execute versus merely guide.</p></div>
      <div className="agentic-integrity"><b>{plan.distinctQueryCount}/{plan.lanes.length}</b><span>distinct strategy queries</span><small>{taskDistinctness.distinctCount}/{taskDistinctness.taskCount} executable task fingerprints</small></div>
    </div>

    {!!plan.domainPacks.length && <div className="agentic-source-status-row" aria-label="Detected domain packs">{plan.domainPacks.map(pack => <span className="status-pill" key={pack.id}>{pack.label} · {Math.round(pack.confidence * 100)}%</span>)}</div>}
    {!!plan.integrityWarnings.length && <div className="agentic-warning-list">{plan.integrityWarnings.map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}

    <div className="agentic-lane-tabs" role="tablist" aria-label="Research hypotheses">
      {plan.lanes.map(item => <button key={item.id} role="tab" aria-selected={item.id === lane.id} className={item.id === lane.id ? 'active' : ''} onClick={() => { setLaneId(item.id); setResults([]); setSourceStatus({}); setStatus(''); setNovelty(null) }}><b>{item.priority}</b><span>{item.label}</span></button>)}
    </div>

    <div className="agentic-plan-grid">
      <div className="agentic-lane-detail">
        <span className="kicker">Hypothesis</span><h3>{lane.label}</h3><p>{lane.hypothesis}</p>
        <div className="agentic-blindspot"><b>Blind spot</b><span>{lane.blindSpot}</span></div>
        <div className="agentic-query-box"><span>Recruiter strategy query</span><code>{lane.query}</code></div>
        <div className="agentic-source-truth-head"><b>Source tasks</b><small>{truth.executable || 0} executable · {truth.guided || 0} guided · {truth.provider_optional || 0} provider-ready</small></div>
        <div className="agentic-source-task-list">{lane.tasks.map(task => <div className="agentic-source-task" key={`${lane.id}:${task.surface}`}><div><span className={`agentic-mode-dot ${task.mode}`} /><div><b>{task.label}</b><small>{task.truth}</small></div></div><span className={`status-pill ${task.mode === 'executable' ? 'success' : task.mode === 'guided' ? 'active' : ''}`}>{task.mode.replace('_', ' ')}</span></div>)}</div>
      </div>

      <aside className="agentic-run-card">
        <div><span className="kicker">Research pass</span><h3>Run what SourcingOS can actually access.</h3><p>Read-only public research. Discoveries are not saved, merged, rejected, contacted, or treated as verified.</p></div>
        <div className="agentic-run-metrics"><span><b>{coverage.uniqueSearches}</b><small>unique searches</small></span><span><b>{coverage.surfacesSearched}</b><small>surfaces run</small></span><span><b>{coverage.uniqueResultsSeen}</b><small>identities seen</small></span></div>
        <button className="btn" disabled={working || !executableConnectorKeys(lane).length} onClick={() => void runPublicSources()}>{working ? 'Researching…' : executableConnectorKeys(lane).length ? 'Run public sources' : 'No executable public source'}</button>
        <Link className="btn secondary" href={`/app/candidate-search?roleId=${encodeURIComponent(activeRole.id)}`}>Open Candidate Search</Link>
        <small className="agentic-run-trust">External content is data, never instructions · professional registries are evidence, not interest · no auto-send · no auto-reject · no silent identity merge</small>
      </aside>
    </div>

    {status && <div className="cta agentic-run-status" role="status">{status}</div>}
    {!!Object.keys(sourceStatus || {}).length && <div className="agentic-source-status-row">{Object.entries(sourceStatus || {}).map(([key, value]) => <span key={key} className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`}>{key}: {value.status} · {value.discovered}</span>)}</div>}

    {!!results.length && <div className="agentic-results">
      <div className="agentic-results-head"><div><span className="kicker">Public-source discoveries</span><h3>{results.length} records to inspect</h3></div>{novelty !== null && <span className="status-pill active">{novelty}% novel vs role search memory</span>}</div>
      <div className="agentic-result-grid">{results.slice(0, 18).map(result => <article className="agentic-result-card" key={`${result.sourceKey}:${result.sourceId}`}><div className="agentic-result-top"><span className="status-pill">{result.sourceKey}</span><span>{result.evidence.length} evidence items</span></div><h4>{result.displayName}</h4><p>{[result.headline, result.organization, result.location].filter(Boolean).join(' · ') || 'Public-source identity'}</p>{result.evidence[0] && <div className="agentic-result-evidence"><b>{result.evidence[0].label}</b><span>{result.evidence[0].value}</span></div>}<div className="agentic-result-foot"><span>Identity {result.identityConfidence}</span><span>Profile {result.profileQuality}</span>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}</div></article>)}</div>
      <div className="agentic-results-note">Read-only discoveries only. Registry and public-source records are evidence for recruiter review. Adding a person to a role still requires explicit recruiter action through the existing Candidate Graph/evidence workflow.</div>
    </div>}
  </section>
}
