'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRoleIntelligenceV33 } from '@/components/RoleIntelligenceProviderV33'
import {
  executableConnectorKeys,
  sourceTruthSummary,
  type AgenticConnectorKey,
  type AgenticLaneId,
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
import {
  connectorKeysForSurface,
  telemetryForSurface,
  type AgenticOrchestrationResponse,
} from '@/lib/source-orchestration-v33-8'
import type { SourceResult } from '@/lib/source-types'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

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
  saveEligible?: boolean
  sourceResult?: SourceResult
}

type RunResponse = AgenticOrchestrationResponse & {
  ok?: boolean
  error?: string
  sourceStatus?: Record<string, { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }>
  results?: AgenticResult[]
  trust?: { message?: string; externalContent?: string; registryData?: string; sourceTruth?: string }
}

type ProviderProfileUrl = {
  kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'
  url: string
}

type ProviderObservation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: ProviderProfileUrl[]
  contactAvailability: { email: boolean | 'unknown'; phone: boolean | 'unknown' }
  providerRetrievalScore?: number
  providerScoreScale?: string
  providerExplanation?: string
  refreshedAt?: string
  observedAt: string
}

type ProviderReviewObservation = {
  observation: ProviderObservation
  observationSignature: string
  sourceResult: SourceResult
}

type ProviderTelemetry = {
  provider: string
  status: 'completed' | 'failed' | 'unavailable' | 'skipped'
  discovered: number
  latencyMs: number
  estimatedCredits?: number
  message?: string
}

type ProviderRunResponse = {
  ok?: boolean
  error?: string
  reviewObservations?: ProviderReviewObservation[]
  telemetry?: ProviderTelemetry[]
  providerMix?: Record<string, number>
  retainedProviderMix?: Record<string, number>
  discoveredBeforeCap?: number
  returnedAfterCap?: number
  contributingProviders?: number
  warnings?: string[]
}

type ProviderStatusResponse = {
  ok?: boolean
  executableSearchProviders?: string[]
}

type SaveResponse = {
  ok?: boolean
  error?: string
  reused?: boolean
  candidateId?: string
  candidateUrl?: string
  identityProposals?: { created?: Array<unknown> }
  note?: string
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

function displayProvider(value: string): string {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function providerAvailability(value: boolean | 'unknown'): string {
  return value === true ? 'available' : value === false ? 'not returned' : 'unknown'
}

function roleSkillTerms(mustHaves: string[]): string[] {
  const excluded = /\b(years?|experience|clearance|secret|top secret|ts\/sci|location|located|citizen|citizenship|degree|bachelor|master|must be|required)\b/i
  const terms = mustHaves.flatMap(value => value.split(/[,;/]/)).map(value => value.trim()).filter(Boolean)
  return Array.from(new Set(terms.filter(value => value.length <= 100 && !excluded.test(value)))).slice(0, 30)
}

export function RoleAgenticSearchPanel({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const { onet, military, militaryApproved, militaryDataset } = useRoleIntelligenceV33()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const plan = useMemo(() => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration, { onet, military, militaryApproved }) : null, [role, onet, military, militaryApproved])
  const [laneId, setLaneId] = useState<AgenticLaneId>('exact_title')
  const [attempts, setAttempts] = useState<SearchAttempt[]>([])
  const [results, setResults] = useState<AgenticResult[]>([])
  const [providerResults, setProviderResults] = useState<ProviderReviewObservation[]>([])
  const [sourceStatus, setSourceStatus] = useState<RunResponse['sourceStatus']>({})
  const [providerTelemetry, setProviderTelemetry] = useState<ProviderTelemetry[]>([])
  const [providerRunMeta, setProviderRunMeta] = useState<Pick<ProviderRunResponse, 'discoveredBeforeCap' | 'returnedAfterCap' | 'contributingProviders' | 'retainedProviderMix'>>({})
  const [providerConfiguredCount, setProviderConfiguredCount] = useState(0)
  const [runTelemetry, setRunTelemetry] = useState<Pick<AgenticOrchestrationResponse, 'discoveredBeforeCap' | 'resultCount' | 'sourceDistribution' | 'orchestration'>>({})
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)
  const [novelty, setNovelty] = useState<number | null>(null)
  const [savingKey, setSavingKey] = useState('')
  const [savedCandidates, setSavedCandidates] = useState<Record<string, { candidateId: string; candidateUrl: string; reused: boolean }>>({})

  useEffect(() => setAttempts(readAttempts(roleId)), [roleId])
  useEffect(() => {
    if (plan && !plan.lanes.some(lane => lane.id === laneId)) setLaneId(plan.lanes[0]?.id || 'exact_title')
  }, [laneId, plan])
  useEffect(() => {
    let active = true
    void fetch('/api/candidate-data/status', { cache: 'no-store' })
      .then(async response => response.json() as Promise<ProviderStatusResponse>)
      .then(json => { if (active && json.ok) setProviderConfiguredCount(json.executableSearchProviders?.length || 0) })
      .catch(() => { /* the sourcing run will report provider availability */ })
    return () => { active = false }
  }, [])

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

  function linkSavedCandidateToRole(params: {
    candidateId: string
    displayName: string
    headline?: string
    organization?: string
    location?: string
    sourceUrl?: string
    sourceResult?: SourceResult
  }): boolean {
    let alreadyInRole = false
    updateRole(roleId, workspace => {
      if (workspace.candidates.some(candidate => candidate.candidateId === params.candidateId)) {
        alreadyInRole = true
        return workspace
      }
      const now = new Date().toISOString()
      return {
        ...workspace,
        candidates: [{
          id: crypto.randomUUID(),
          candidateId: params.candidateId,
          name: params.displayName,
          headline: params.headline || '',
          company: params.organization || '',
          location: params.location || '',
          source: 'candidate_database',
          sourceUrl: params.sourceUrl,
          stage: 'needs_review',
          fitDecision: 'unreviewed',
          fitReasons: [],
          concerns: [],
          tags: params.sourceResult?.skills.slice(0, 12) || [],
          contactStatus: params.sourceResult?.contactSignals.length ? 'signals_found' : 'unknown',
          evidenceStatus: 'unreviewed',
          addedAt: now,
          updatedAt: now,
        }, ...workspace.candidates],
        activity: [{
          id: crypto.randomUUID(),
          type: 'candidate_added',
          message: `Added ${params.displayName} from Candidate Graph to the review queue after an explicit recruiter save.`,
          createdAt: now,
        }, ...workspace.activity],
        updatedAt: now,
      }
    })
    return alreadyInRole
  }

  async function saveToCandidateGraph(result: AgenticResult) {
    const key = `public:${result.sourceKey}:${result.sourceId}`
    if (!result.saveEligible || !result.sourceResult || savingKey) return
    setSavingKey(key)
    try {
      const response = await fetch('/api/workbench/save-source-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceResult: result.sourceResult }),
      })
      const json = await response.json() as SaveResponse
      if (!response.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate Graph save failed.')
      const candidateId = json.candidateId
      const candidateUrl = json.candidateUrl || `/app/candidate/${candidateId}`
      setSavedCandidates(current => ({ ...current, [key]: { candidateId, candidateUrl, reused: Boolean(json.reused) } }))

      const alreadyInRole = linkSavedCandidateToRole({
        candidateId,
        displayName: result.displayName,
        headline: result.headline,
        organization: result.organization,
        location: result.location,
        sourceUrl: result.sourceUrl,
        sourceResult: result.sourceResult,
      })
      const proposals = json.identityProposals?.created?.length || 0
      const roleMessage = alreadyInRole
        ? `${result.displayName} was already in ${activeRole.intake.title}'s review queue.`
        : `${result.displayName} was added to ${activeRole.intake.title}'s review queue as unreviewed.`
      const identityMessage = proposals
        ? `${proposals} cross-source identity proposal${proposals === 1 ? '' : 's'} await recruiter review; nothing was merged automatically.`
        : 'No cross-source identity was silently merged.'
      setStatus(`${json.reused ? 'Reused the existing Candidate Graph identity.' : 'Saved to Candidate Graph.'} ${roleMessage} ${identityMessage}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate Graph save failed.')
    } finally {
      setSavingKey('')
    }
  }

  async function saveProviderToCandidateGraph(review: ProviderReviewObservation) {
    const observation = review.observation
    const key = `provider:${observation.provider}:${observation.providerPersonId}`
    if (savingKey) return
    setSavingKey(key)
    try {
      const response = await fetch('/api/candidate-data/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observation, observationSignature: review.observationSignature }),
      })
      const json = await response.json() as SaveResponse
      if (!response.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Provider observation save failed.')
      const candidateId = json.candidateId
      const candidateUrl = json.candidateUrl || `/app/candidate/${candidateId}`
      setSavedCandidates(current => ({ ...current, [key]: { candidateId, candidateUrl, reused: Boolean(json.reused) } }))
      const alreadyInRole = linkSavedCandidateToRole({
        candidateId,
        displayName: observation.displayName,
        headline: observation.currentTitle || observation.headline,
        organization: observation.currentEmployer,
        location: observation.location,
        sourceUrl: observation.profileUrls[0]?.url,
        sourceResult: review.sourceResult,
      })
      setStatus(`${json.reused ? 'Reused the existing Candidate Graph identity.' : 'Saved the signed provider observation to Candidate Graph.'} ${alreadyInRole ? `${observation.displayName} was already in the role queue.` : `${observation.displayName} was added to the role queue as unreviewed.`} Provider retrieval remains separate from qualification.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Provider observation save failed.')
    } finally {
      setSavingKey('')
    }
  }

  async function runSourcingAgent() {
    if (working) return

    const allowedTasks = executableTasks.filter(task => shouldExecuteSearch(attempts, task.surface, task.query).execute)
    if (!allowedTasks.length && providerConfiguredCount === 0) {
      setStatus(executableTasks.length
        ? 'Search memory blocked the public-source repeat and no professional-data provider is configured. Change the strategy or role criteria before another run.'
        : 'This strategy has no executable public connector and no professional-data provider is configured. Guided tasks stay visible rather than being faked.')
      return
    }

    const connectors = Array.from(new Set(allowedTasks.flatMap(task => task.connectorKeys || [])))
    const connectorQueries: Partial<Record<AgenticConnectorKey, string>> = {}
    for (const task of allowedTasks) {
      for (const connector of task.connectorKeys || []) connectorQueries[connector] = task.query
    }
    const query = allowedTasks[0]?.query || lane.query
    const startedAt = new Date().toISOString()
    const running: SearchAttempt[] = allowedTasks.map(task => ({
      id: crypto.randomUUID(), roleId, laneId: lane.id, surface: task.surface, query: task.query,
      fingerprint: searchFingerprint(task.surface, task.query), status: 'running', resultKeys: [], startedAt,
    }))

    if (running.length) saveAttempts([...attempts, ...running])
    setWorking(true)
    setResults([])
    setProviderResults([])
    setSourceStatus({})
    setProviderTelemetry([])
    setRunTelemetry({})
    setProviderRunMeta({})
    setNovelty(null)
    setStatus(`Running ${lane.label} across ${connectors.length} public connector${connectors.length === 1 ? '' : 's'} and ${providerConfiguredCount || 'configured'} professional-data provider${providerConfiguredCount === 1 ? '' : 's'}…`)

    try {
      const intake = activeRole.intake
      const publicPromise = allowedTasks.length
        ? fetch('/api/agentic-search', {
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
        }).then(async response => ({ response, json: await response.json() as RunResponse }))
        : Promise.resolve(undefined)

      const providerPromise = providerConfiguredCount > 0
        ? fetch('/api/candidate-data/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: lane.query,
            requirements: intake.mustHaves.slice(0, 30).map(text => ({ text, mustHave: true })),
            titles: intake.title && intake.title !== 'Not specified' ? [intake.title] : [],
            skills: roleSkillTerms(intake.mustHaves),
            locations: intake.location && intake.location !== 'Not specified' ? [intake.location] : [],
            limit: 30,
            highFreshness: false,
          }),
        }).then(async response => ({ response, json: await response.json() as ProviderRunResponse }))
        : Promise.resolve(undefined)

      const [publicOutcome, providerOutcome] = await Promise.allSettled([publicPromise, providerPromise])
      let publicSucceeded = false
      let providerSucceeded = false
      let publicFound: AgenticResult[] = []
      let providerFound: ProviderReviewObservation[] = []
      let publicError = ''
      let providerError = ''
      let publicJson: RunResponse | undefined
      let providerJson: ProviderRunResponse | undefined

      if (publicOutcome.status === 'fulfilled' && publicOutcome.value) {
        if (publicOutcome.value.response.ok && publicOutcome.value.json.ok) {
          publicJson = publicOutcome.value.json
          publicSucceeded = true
          publicFound = publicJson.results || []
          const currentKeys = publicFound.map(item => `${item.sourceKey}:${item.sourceId}`)
          setNovelty(resultNoveltyRate(accumulatedResultKeys(attempts), currentKeys))
          setResults(publicFound)
          setSourceStatus(publicJson.sourceStatus || {})
          setRunTelemetry({
            discoveredBeforeCap: publicJson.discoveredBeforeCap,
            resultCount: publicJson.resultCount,
            sourceDistribution: publicJson.sourceDistribution,
            orchestration: publicJson.orchestration,
          })
        } else publicError = publicOutcome.value.json.error || 'Public-source research failed.'
      } else if (publicOutcome.status === 'rejected') {
        publicError = publicOutcome.reason instanceof Error ? publicOutcome.reason.message : 'Public-source research failed.'
      }

      if (providerOutcome.status === 'fulfilled' && providerOutcome.value) {
        if (providerOutcome.value.response.ok && providerOutcome.value.json.ok) {
          providerJson = providerOutcome.value.json
          providerSucceeded = true
          providerFound = providerJson.reviewObservations || []
          setProviderResults(providerFound)
          setProviderTelemetry(providerJson.telemetry || [])
          setProviderRunMeta({
            discoveredBeforeCap: providerJson.discoveredBeforeCap,
            returnedAfterCap: providerJson.returnedAfterCap,
            contributingProviders: providerJson.contributingProviders,
            retainedProviderMix: providerJson.retainedProviderMix,
          })
        } else providerError = providerOutcome.value.json.error || 'Professional-data provider search failed.'
      } else if (providerOutcome.status === 'rejected') {
        providerError = providerOutcome.reason instanceof Error ? providerOutcome.reason.message : 'Professional-data provider search failed.'
      }

      if (running.length) {
        const completedAt = new Date().toISOString()
        const completed = running.map(attempt => {
          const connectorSet = connectorKeysForSurface(attempt.surface)
          const keys = publicFound.filter(item => connectorSet.has(item.sourceKey)).map(item => `${item.sourceKey}:${item.sourceId}`)
          const statuses = Array.from(connectorSet).map(key => publicJson?.sourceStatus?.[key]?.status).filter(Boolean)
          const failed = !publicSucceeded || (statuses.length > 0 && statuses.every(value => value === 'failed' || value === 'unavailable'))
          const partial = publicSucceeded && statuses.some(value => value === 'failed' || value === 'unavailable') && !failed
          const telemetry = publicJson ? telemetryForSurface(attempt.surface, publicJson) : undefined
          return {
            ...attempt,
            status: failed ? 'failed' as const : partial ? 'partial' as const : 'completed' as const,
            resultKeys: keys,
            completedAt,
            telemetry,
            message: telemetry
              ? `${telemetry.returnedAfterCap} of ${telemetry.discoveredBeforeCap} source discoveries returned after source-diverse capping.`
              : publicError || 'Public-source search did not execute.',
          }
        })
        saveAttempts([...attempts, ...completed])
      }

      if (!publicSucceeded && !providerSucceeded) throw new Error([publicError, providerError].filter(Boolean).join(' ') || 'No sourcing lane completed successfully.')

      const statusParts = [
        publicSucceeded ? `${publicFound.length} public evidence record${publicFound.length === 1 ? '' : 's'}.` : publicError ? `Public lane: ${publicError}` : '',
        providerSucceeded ? `${providerFound.length} professional-provider observation${providerFound.length === 1 ? '' : 's'} retained from ${providerJson?.discoveredBeforeCap || providerFound.length} discoveries across ${providerJson?.contributingProviders || 0} contributing provider${providerJson?.contributingProviders === 1 ? '' : 's'}.` : providerError ? `Provider lane: ${providerError}` : '',
        'Nothing was auto-saved, merged, shortlisted, rejected, or contacted.',
      ].filter(Boolean)
      setStatus(statusParts.join(' '))
    } catch (error) {
      if (running.length) {
        const completedAt = new Date().toISOString()
        saveAttempts([...attempts, ...running.map(attempt => ({ ...attempt, status: 'failed' as const, completedAt, message: error instanceof Error ? error.message : 'Search failed.' }))])
      }
      setStatus(error instanceof Error ? error.message : 'Sourcing agent run failed.')
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
      <div><span className="kicker">Role research strategy</span><h2>Distinct hypotheses with one multi-source sourcing run.</h2><p>Each lane states why it exists and what it can miss. One run now executes eligible public evidence connectors and configured professional-data providers in parallel while preserving source truth.</p></div>
      <div className="agentic-integrity"><b>{plan.distinctQueryCount}/{plan.lanes.length}</b><span>distinct strategy queries</span><small>{taskDistinctness.distinctCount}/{taskDistinctness.taskCount} executable task fingerprints</small></div>
    </div>

    <div className="agentic-source-status-row" aria-label="Role intelligence">
      {plan.domainPacks.map(pack => <span className="status-pill" key={pack.id}>{pack.label} · {Math.round(pack.confidence * 100)}%</span>)}
      {onet?.matchedOccupation && <span className="status-pill active">O*NET · {onet.matchedOccupation.title}</span>}
      {onet?.relatedOccupations?.length ? <span className="status-pill">{onet.relatedOccupations.length} occupation adjacencies</span> : null}
      {military?.applicable && <span className={`status-pill ${plan.roleIntelligence.militaryApproved ? 'success' : militaryDataset?.verified ? 'active' : 'warning'}`}>Military MOC · {military.occupations.length}{plan.roleIntelligence.militaryApproved ? ' · approved' : militaryDataset?.verified ? ' · review' : ' · provisional'}</span>}
      <span className={`status-pill ${providerConfiguredCount ? 'success' : 'warning'}`}>Professional providers · {providerConfiguredCount} executable</span>
    </div>
    {!!plan.integrityWarnings.length && <div className="agentic-warning-list">{plan.integrityWarnings.map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}

    <div className="agentic-lane-tabs" role="tablist" aria-label="Research hypotheses">
      {plan.lanes.map(item => <button key={item.id} role="tab" aria-selected={item.id === lane.id} className={item.id === lane.id ? 'active' : ''} onClick={() => { setLaneId(item.id); setResults([]); setProviderResults([]); setSourceStatus({}); setProviderTelemetry([]); setRunTelemetry({}); setProviderRunMeta({}); setStatus(''); setNovelty(null) }}><b>{item.priority}</b><span>{item.label}</span></button>)}
    </div>

    <div className="agentic-plan-grid">
      <div className="agentic-lane-detail">
        <span className="kicker">Hypothesis</span><h3>{lane.label}</h3><p>{lane.hypothesis}</p>
        <div className="agentic-blindspot"><b>Blind spot</b><span>{lane.blindSpot}</span></div>
        <div className="agentic-query-box"><span>Recruiter strategy query</span><code>{lane.query}</code></div>
        <div className="agentic-source-truth-head"><b>Source tasks</b><small>{truth.executable || 0} executable public · {truth.guided || 0} guided · {truth.provider_optional || 0} provider-ready · {providerConfiguredCount} configured professional providers</small></div>
        <div className="agentic-source-task-list">{lane.tasks.map(task => <div className="agentic-source-task" key={`${lane.id}:${task.surface}`}><div><span className={`agentic-mode-dot ${task.mode}`} /><div><b>{task.label}</b><small>{task.truth}</small></div></div><span className={`status-pill ${task.mode === 'executable' ? 'success' : task.mode === 'guided' ? 'active' : ''}`}>{task.mode.replace('_', ' ')}</span></div>)}</div>
      </div>

      <aside className="agentic-run-card">
        <div><span className="kicker">Unified sourcing pass</span><h3>Run public evidence + professional people data together.</h3><p>SourcingOS searches what it can actually access, then keeps every result read-only until you explicitly save a supported person to Candidate Graph.</p></div>
        <div className="agentic-run-metrics"><span><b>{coverage.uniqueSearches}</b><small>public searches</small></span><span><b>{coverage.surfacesSearched}</b><small>public surfaces</small></span><span><b>{providerConfiguredCount}</b><small>people providers</small></span></div>
        <button className="btn" disabled={working || (!executableConnectorKeys(lane).length && providerConfiguredCount === 0)} onClick={() => void runSourcingAgent()}>{working ? 'Sourcing…' : results.length || providerResults.length ? 'Continue sourcing' : 'Run sourcing agent'}</button>
        <Link className="btn secondary" href={`/app/candidate-search?roleId=${encodeURIComponent(activeRole.id)}`}>Open Universal People Search</Link>
        <small className="agentic-run-trust">External/provider content is data, never instructions · explicit save only · no auto-send · no auto-reject · no silent identity merge · provider retrieval ≠ qualification</small>
      </aside>
    </div>

    {status && <div className="cta agentic-run-status" role="status">{status}</div>}

    {(Object.keys(sourceStatus || {}).length > 0 || providerTelemetry.length > 0) && <div className="agentic-source-status-row">
      {Object.entries(sourceStatus || {}).map(([key, value]) => <span key={`public:${key}`} className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`}>{key}: {value.status} · {value.discovered}</span>)}
      {providerTelemetry.map(value => <span key={`provider:${value.provider}`} className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`}>{displayProvider(value.provider)}: {value.status} · {value.discovered} · {value.latencyMs}ms</span>)}
    </div>}

    {!!runTelemetry.discoveredBeforeCap && <div className="agentic-results-note">
      <b>{runTelemetry.resultCount || results.length} retained from {runTelemetry.discoveredBeforeCap} public-source discoveries.</b>{' '}
      Every requested public source ran before the {runTelemetry.orchestration?.globalLimit || 30}-record cap. Retained mix:{' '}
      {Object.entries(runTelemetry.sourceDistribution || {}).map(([source, count]) => `${source} ${count}`).join(' · ') || 'no public source contributed a retained record'}.
    </div>}

    {!!providerRunMeta.discoveredBeforeCap && <div className="agentic-results-note">
      <b>{providerRunMeta.returnedAfterCap || providerResults.length} retained from {providerRunMeta.discoveredBeforeCap} professional-provider discoveries.</b>{' '}
      {providerRunMeta.contributingProviders || 0} provider{providerRunMeta.contributingProviders === 1 ? '' : 's'} contributed after source-diverse interleaving. Retained mix:{' '}
      {Object.entries(providerRunMeta.retainedProviderMix || {}).map(([source, count]) => `${displayProvider(source)} ${count}`).join(' · ') || 'no professional provider contributed a retained record'}.
    </div>}

    {!!providerResults.length && <div className="agentic-results">
      <div className="agentic-results-head"><div><span className="kicker">Professional-provider discoveries</span><h3>{providerResults.length} observations to inspect{providerRunMeta.discoveredBeforeCap ? ` from ${providerRunMeta.discoveredBeforeCap} discoveries` : ''}</h3></div><span className="status-pill">retrieval ≠ qualification</span></div>
      <div className="agentic-result-grid">{providerResults.slice(0, 18).map(review => {
        const observation = review.observation
        const key = `provider:${observation.provider}:${observation.providerPersonId}`
        const saved = savedCandidates[key]
        return <article className="agentic-result-card" key={key}>
          <div className="agentic-result-top"><span className="status-pill">{displayProvider(observation.provider)}</span><span>provider observation</span></div>
          <h4>{observation.displayName}</h4>
          <p>{[observation.currentTitle || observation.headline, observation.currentEmployer, observation.location].filter(Boolean).join(' · ') || 'Professional profile observation'}</p>
          {!!observation.skills.length && <div className="chips" style={{ margin: '10px 0' }}>{observation.skills.slice(0, 7).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>}
          <div className="agentic-result-evidence"><b>Why this record appeared</b><span>{observation.providerExplanation || 'Returned by this professional-data provider for the recruiter-approved role search. This retrieval result is not evidence that every must-have is satisfied.'}</span></div>
          <div className="agentic-result-foot"><span>Email {providerAvailability(observation.contactAvailability.email)}</span><span>Phone {providerAvailability(observation.contactAvailability.phone)}</span>{observation.providerRetrievalScore !== undefined && <span>Provider retrieval {observation.providerRetrievalScore}{observation.providerScoreScale ? ` / ${observation.providerScoreScale}` : ''}</span>}</div>
          {!!observation.profileUrls.length && <div className="button-row" style={{ marginTop: 10 }}>{observation.profileUrls.slice(0, 4).map(profile => <a className="btn ghost" href={profile.url} target="_blank" rel="noreferrer noopener" key={`${profile.kind}:${profile.url}`}>{profile.kind} ↗</a>)}</div>}
          {saved
            ? <Link className="btn secondary" href={saved.candidateUrl}>{saved.reused ? 'Existing Candidate 360 →' : 'Open Candidate 360 →'}</Link>
            : <button className="btn secondary" disabled={Boolean(savingKey)} onClick={() => void saveProviderToCandidateGraph(review)}>{savingKey === key ? 'Saving…' : 'Save + add to role review'}</button>}
        </article>
      })}</div>
      <div className="agentic-results-note">Professional provider rows are signed retrieval observations. Saving re-validates the server signature and enters the role as unreviewed; provider scores, search requirements, and contact availability never become SourcingOS qualification truth automatically.</div>
    </div>}

    {!!results.length && <div className="agentic-results">
      <div className="agentic-results-head"><div><span className="kicker">Public-source evidence discoveries</span><h3>{results.length} records to inspect{runTelemetry.discoveredBeforeCap ? ` from ${runTelemetry.discoveredBeforeCap} discoveries` : ''}</h3></div>{novelty !== null && <span className="status-pill active">{novelty}% novel vs role search memory</span>}</div>
      <div className="agentic-result-grid">{results.slice(0, 18).map(result => {
        const key = `public:${result.sourceKey}:${result.sourceId}`
        const saved = savedCandidates[key]
        return <article className="agentic-result-card" key={key}>
          <div className="agentic-result-top"><span className="status-pill">{result.sourceKey}</span><span>{result.evidence.length} evidence items</span></div>
          <h4>{result.displayName}</h4>
          <p>{[result.headline, result.organization, result.location].filter(Boolean).join(' · ') || 'Public-source identity'}</p>
          {result.evidence[0] && <div className="agentic-result-evidence"><b>{result.evidence[0].label}</b><span>{result.evidence[0].value}</span></div>}
          <div className="agentic-result-foot"><span>Identity {result.identityConfidence}</span><span>Profile {result.profileQuality}</span>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}</div>
          {saved
            ? <Link className="btn secondary" href={saved.candidateUrl}>{saved.reused ? 'Existing Candidate 360 →' : 'Open Candidate 360 →'}</Link>
            : result.saveEligible && result.sourceResult
              ? <button className="btn secondary" disabled={Boolean(savingKey)} onClick={() => void saveToCandidateGraph(result)}>{savingKey === key ? 'Saving…' : 'Save + add to role review'}</button>
              : <small className="muted">Preview evidence only · this connector is not yet on the canonical person-save path.</small>}
        </article>
      })}</div>
      <div className="agentic-results-note">Discovery stays read-only by default. Save-eligible public people require an explicit recruiter action, pass the canonical source-truth boundary again on write, reuse exact same-source identities instead of creating duplicates, and enter this role as unreviewed candidates. Deterministic cross-source anchors create review proposals only; they never merge profiles automatically.</div>
    </div>}
  </section>
}