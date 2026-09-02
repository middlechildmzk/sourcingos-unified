'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRoleIntelligenceV33 } from '@/components/RoleIntelligenceProviderV33'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import {
  approvedExecutionLocationsV35,
  approvedRetrievalContextV35,
} from '@/lib/entity-intelligence/search-approval-v35'
import {
  accumulatedResultKeys,
  resultNoveltyRate,
  searchFingerprint,
  shouldExecuteSearch,
  type SearchAttempt,
} from '@/lib/search-state-memory-v30'
import type { AgenticConnectorKey } from '@/lib/agentic-search-v30'
import {
  connectorKeysForSurface,
  sourceDistribution,
  telemetryForSurface,
  type AgenticOrchestrationResponse,
} from '@/lib/source-orchestration-v33-8'
import {
  buildRoleReviewSlateCandidates,
  evidenceBearingFirstReviewBatch,
  mergeReviewSlateDiscoveries,
  previewDeterministicIdentityReviews,
  reviewSlateDiscoveryKey,
  saveEligibleReviewSlateDiscoveries,
  type ReviewSlateDiscovery,
  type SavedSlateDiscovery,
} from '@/lib/agent-review-slate-v33-3'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type SourceGeographyStatusV35 = {
  mode: 'bounded_fanout' | 'array_native' | 'source_agnostic' | 'none'
  requestedLocations: string[]
  executedLocations: string[]
  omittedLocations: string[]
  perLocationLimit: number
  explanation: string
  discoveredByLocation?: Record<string, number>
}

type SourceStatus = {
  status: 'completed' | 'failed' | 'unavailable'
  discovered: number
  message?: string
  geography?: SourceGeographyStatusV35
}

type RunResponse = AgenticOrchestrationResponse & {
  ok?: boolean
  error?: string
  sourceStatus?: Record<string, SourceStatus>
  results?: ReviewSlateDiscovery[]
  trust?: { message?: string }
}

type SaveResponse = {
  ok?: boolean
  error?: string
  reused?: boolean
  candidateId?: string
  candidateUrl?: string
  identityProposals?: { created?: Array<unknown> }
}

type SearchProgressPhase = 'searching' | 'reviewing' | 'saving' | 'ready' | 'paused'

function emitRoleSearchProgress(roleId: string, phase: SearchProgressPhase, message: string, current = 0, total = 0) {
  window.dispatchEvent(new CustomEvent('sourcingos:role-search-progress', {
    detail: { roleId, phase, message, current, total },
  }))
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

function mergeDiscoveredByLocation(prior: Record<string, number> | undefined, incoming: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!prior && !incoming) return undefined
  const next = { ...(prior || {}) }
  for (const [location, count] of Object.entries(incoming || {})) next[location] = (next[location] || 0) + count
  return next
}

function mergeSourceStatus(current: Record<string, SourceStatus>, incoming: RunResponse['sourceStatus']) {
  const next = { ...current }
  for (const [key, value] of Object.entries(incoming || {})) {
    const prior = next[key]
    const geography = value.geography
      ? { ...value.geography, discoveredByLocation: mergeDiscoveredByLocation(prior?.geography?.discoveredByLocation, value.geography.discoveredByLocation) }
      : prior?.geography
    next[key] = prior
      ? {
          status: prior.status === 'completed' || value.status === 'completed' ? 'completed' : value.status,
          discovered: prior.discovered + value.discovered,
          message: value.message || prior.message,
          ...(geography ? { geography } : {}),
        }
      : value
  }
  return next
}

function geographyStatusLabel(status: SourceStatus): string {
  const geography = status.geography
  if (!geography || geography.mode === 'none') return ''
  if (geography.mode === 'source_agnostic') return ' · geography downstream'
  const executed = geography.executedLocations.length
  const marketLabel = `${executed} market${executed === 1 ? '' : 's'}`
  if (geography.mode === 'array_native') return ` · ${marketLabel}`
  const deferred = geography.omittedLocations.length
  return ` · ${marketLabel}${deferred ? ` · ${deferred} deferred` : ''}`
}

function unique(values: string[], max: number): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, max)
}

function candidateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || '—').toUpperCase()
}

function sourceLabel(value: string): string {
  if (value === 'github') return 'GitHub'
  if (value === 'stackoverflow') return 'Stack Overflow'
  if (value === 'devto') return 'DEV'
  if (value === 'huggingface') return 'Hugging Face'
  if (value === 'npi') return 'NPI Registry'
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function contactHref(type: string, value: string): string | undefined {
  if (type === 'public_email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : undefined
  if (type !== 'website' && type !== 'profile_url') return undefined
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

export function RoleSourcingAgentV33_3({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const { onet, military, militaryApproved } = useRoleIntelligenceV33()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const plan = useMemo(
    () => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration, {
      onet,
      military,
      militaryApproved,
      searchIntelligence: role.searchIntelligence,
    }) : null,
    [role, onet, military, militaryApproved]
  )
  const [attempts, setAttempts] = useState<SearchAttempt[]>([])
  const [discoveries, setDiscoveries] = useState<ReviewSlateDiscovery[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [savedKeys, setSavedKeys] = useState<string[]>([])
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>({})
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState<'search' | 'slate' | ''>('')
  const [passProgress, setPassProgress] = useState({ current: 0, total: 0 })
  const [novelty, setNovelty] = useState<number | null>(null)
  const [passTelemetry, setPassTelemetry] = useState({
    discoveredBeforeCap: 0,
    returnedAfterCap: 0,
    sourceDistribution: {} as Record<string, number>,
  })

  useEffect(() => setAttempts(readAttempts(roleId)), [roleId])

  const approvedLaneIds = useMemo(() => new Set((role?.searchLanes || []).filter(lane => lane.status === 'approved').map(lane => lane.id)), [role])
  const approvedLanes = useMemo(() => plan?.lanes.filter(lane => approvedLaneIds.has(lane.id)) || [], [approvedLaneIds, plan])
  const executableLanes = useMemo(() => approvedLanes.filter(lane => lane.tasks.some(task => task.mode === 'executable' && task.connectorKeys?.length)), [approvedLanes])
  const executableSources = useMemo(() => new Set(executableLanes.flatMap(lane => lane.tasks.filter(task => task.mode === 'executable').flatMap(task => task.connectorKeys || []))), [executableLanes])
  const saveEligible = useMemo(() => saveEligibleReviewSlateDiscoveries(discoveries), [discoveries])
  const approvedLocations = useMemo(() => role ? approvedExecutionLocationsV35(role.intake, role.searchIntelligence) : [], [role])
  const firstBatch = useMemo(
    () => role
      ? evidenceBearingFirstReviewBatch(discoveries, role.intake, 12, { approvedLocations })
      : { batch: [], checks: [], summary: { discoveredPeople: 0, reviewReady: 0, promisingVerify: 0, held: 0, admitted: 0, heldByReason: {} } },
    [discoveries, role, approvedLocations]
  )
  const evidenceCheckByKey = useMemo(() => new Map(firstBatch.checks.map(check => [reviewSlateDiscoveryKey(check.discovery), check])), [firstBatch.checks])
  const selected = useMemo(() => {
    const keys = new Set(selectedKeys)
    return saveEligible.filter(item => keys.has(reviewSlateDiscoveryKey(item)))
  }, [saveEligible, selectedKeys])
  const identityReviewPreview = useMemo(() => previewDeterministicIdentityReviews(selected), [selected])

  if (!role || !plan || mode === 'checking') return null
  const activeRole = role

  function persistAttempts(next: SearchAttempt[]) {
    const trimmed = next.slice(-100)
    setAttempts(trimmed)
    try { localStorage.setItem(memoryKey(roleId), JSON.stringify(trimmed)) } catch { /* best effort */ }
  }

  function toggleSelection(key: string) {
    if (savedKeys.includes(key)) return
    setSelectedKeys(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function selectAllReviewable() {
    const saved = new Set(savedKeys)
    setSelectedKeys(firstBatch.batch.map(reviewSlateDiscoveryKey).filter(key => !saved.has(key)))
  }

  async function runApprovedAgentPass() {
    if (working) return
    if (!executableLanes.length) {
      setStatus('Approve at least one sourcing hypothesis with an executable public source before running the agent.')
      return
    }

    let nextAttempts = [...attempts]
    let foundThisPass: ReviewSlateDiscovery[] = []
    let aggregateStatus: Record<string, SourceStatus> = {}
    let discoveredBeforeCap = 0
    let runnableLaneCount = 0
    const priorResultKeys = accumulatedResultKeys(attempts)
    setWorking('search')
    setSourceStatus({})
    setNovelty(null)
    setPassTelemetry({ discoveredBeforeCap: 0, returnedAfterCap: 0, sourceDistribution: {} })
    setPassProgress({ current: 0, total: executableLanes.length })
    setStatus(`Running ${executableLanes.length} approved sourcing hypoth${executableLanes.length === 1 ? 'esis' : 'eses'} across ${executableSources.size} executable public source${executableSources.size === 1 ? '' : 's'}…`)
    emitRoleSearchProgress(roleId, 'searching', `Searching ${executableSources.size} public source${executableSources.size === 1 ? '' : 's'} across ${executableLanes.length} approved angles…`, 0, executableLanes.length)

    try {
      for (let index = 0; index < executableLanes.length; index += 1) {
        const lane = executableLanes[index]
        setPassProgress({ current: index + 1, total: executableLanes.length })
        emitRoleSearchProgress(roleId, 'searching', `Searching angle ${index + 1} of ${executableLanes.length}: ${lane.label}`, index + 1, executableLanes.length)
        const executableTasks = lane.tasks.filter(task => task.mode === 'executable' && task.connectorKeys?.length)
        const allowedTasks = executableTasks.filter(task => shouldExecuteSearch(nextAttempts, task.surface, task.query).execute)
        if (!allowedTasks.length) continue
        runnableLaneCount += 1

        const connectors = Array.from(new Set(allowedTasks.flatMap(task => task.connectorKeys || [])))
        const connectorQueries: Partial<Record<AgenticConnectorKey, string>> = {}
        for (const task of allowedTasks) for (const connector of task.connectorKeys || []) connectorQueries[connector] = task.query
        const startedAt = new Date().toISOString()
        const running: SearchAttempt[] = allowedTasks.map(task => ({
          id: crypto.randomUUID(), roleId, laneId: lane.id, surface: task.surface, query: task.query,
          fingerprint: searchFingerprint(task.surface, task.query), status: 'running', resultKeys: [], startedAt,
        }))
        nextAttempts = [...nextAttempts, ...running].slice(-100)
        persistAttempts(nextAttempts)

        try {
          const intake = activeRole.intake
          const approvedRetrieval = approvedRetrievalContextV35(activeRole.searchIntelligence)
          const executionSkills = unique([...intake.mustHaves, ...approvedRetrieval.capabilityTerms], 40)
          const executionCompanies = unique([...intake.targetCompanies, ...approvedRetrieval.companyTerms], 40)
          const executionLocations = approvedExecutionLocationsV35(intake, activeRole.searchIntelligence)
          const response = await fetch('/api/agentic-search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: allowedTasks[0].query,
              connectorQueries,
              skills: executionSkills,
              targetCompanies: executionCompanies,
              locations: executionLocations,
              connectors,
              limit: 30,
            }),
          })
          const json = await response.json() as RunResponse
          if (!response.ok || !json.ok) throw new Error(json.error || `${lane.label} research failed.`)

          const laneResults = json.results || []
          foundThisPass = mergeReviewSlateDiscoveries(foundThisPass, laneResults)
          aggregateStatus = mergeSourceStatus(aggregateStatus, json.sourceStatus)
          discoveredBeforeCap += json.discoveredBeforeCap || 0
          setSourceStatus(aggregateStatus)

          const completedAt = new Date().toISOString()
          const completed = running.map(attempt => {
            const connectorSet = connectorKeysForSurface(attempt.surface)
            const keys = laneResults.filter(item => connectorSet.has(item.sourceKey)).map(reviewSlateDiscoveryKey)
            const statuses = Array.from(connectorSet).map(key => json.sourceStatus?.[key]?.status).filter(Boolean)
            const failed = statuses.length > 0 && statuses.every(value => value === 'failed' || value === 'unavailable')
            const partial = statuses.some(value => value === 'failed' || value === 'unavailable') && !failed
            const telemetry = telemetryForSurface(attempt.surface, json)
            return {
              ...attempt,
              status: failed ? 'failed' as const : partial ? 'partial' as const : 'completed' as const,
              resultKeys: keys,
              completedAt,
              telemetry,
              message: `${telemetry.returnedAfterCap} of ${telemetry.discoveredBeforeCap} source discoveries returned for ${lane.label} after source-diverse capping.`,
            }
          })
          const runningIds = new Set(running.map(item => item.id))
          nextAttempts = [...nextAttempts.filter(item => !runningIds.has(item.id)), ...completed].slice(-100)
          persistAttempts(nextAttempts)
        } catch (error) {
          const completedAt = new Date().toISOString()
          const failedAttempts = running.map(attempt => ({
            ...attempt,
            status: 'failed' as const,
            completedAt,
            message: error instanceof Error ? error.message : `${lane.label} research failed.`,
          }))
          const runningIds = new Set(running.map(item => item.id))
          nextAttempts = [...nextAttempts.filter(item => !runningIds.has(item.id)), ...failedAttempts].slice(-100)
          persistAttempts(nextAttempts)
        }
      }

      if (!runnableLaneCount) {
        setStatus('Search memory blocked exact repeats across the approved hypotheses. Approve a different hypothesis or change the role/search criteria before spending another search.')
        return
      }

      const merged = mergeReviewSlateDiscoveries(discoveries, foundThisPass)
      setDiscoveries(merged)
      const saved = new Set(savedKeys)
      const currentApprovedLocations = approvedExecutionLocationsV35(activeRole.intake, activeRole.searchIntelligence)
      const batch = evidenceBearingFirstReviewBatch(merged, activeRole.intake, 12, { approvedLocations: currentApprovedLocations })
      const autoSelected = batch.batch.map(reviewSlateDiscoveryKey).filter(key => !saved.has(key))
      setSelectedKeys(autoSelected)
      const thisPassKeys = foundThisPass.map(reviewSlateDiscoveryKey)
      setNovelty(resultNoveltyRate(priorResultKeys, thisPassKeys))
      setPassTelemetry({ discoveredBeforeCap, returnedAfterCap: foundThisPass.length, sourceDistribution: sourceDistribution(foundThisPass) })
      const s = batch.summary
      setStatus(`Agent pass finished: ${foundThisPass.length} unique source records retained from ${discoveredBeforeCap} raw public-source discoveries. ${s.discoveredPeople} people reached admission review: ${s.reviewReady} Review Ready, ${s.promisingVerify} Promising — Verify, ${s.held} Held for inspection. ${batch.batch.length} are proposed in the capped first review batch. Unknown evidence is not rejection; no candidate was shortlisted, rejected, merged across sources, or contacted.`)
      emitRoleSearchProgress(roleId, batch.batch.length ? 'reviewing' : 'paused', batch.batch.length
        ? `Prepared ${batch.batch.length} people for recruiter review: ${s.reviewReady} Review Ready and ${s.promisingVerify} Promising — Verify across the full approved geography.`
        : `No person had role-relevant public evidence after ${discoveredBeforeCap} raw discoveries. Held records remain inspectable; the system did not reject them.`)
    } finally {
      setWorking('')
      setPassProgress({ current: 0, total: 0 })
    }
  }

  async function createReviewSlate() {
    if (working || !selected.length) return
    setWorking('slate')
    setPassProgress({ current: 0, total: selected.length })
    setStatus(`Creating a recruiter review slate from ${selected.length} explicitly selected source record${selected.length === 1 ? '' : 's'}…`)
    emitRoleSearchProgress(roleId, 'saving', `Building your first review batch from ${selected.length} recruiter-selected ${selected.length === 1 ? 'person' : 'people'}…`, 0, selected.length)

    const saved: SavedSlateDiscovery[] = []
    const successfulKeys: string[] = []
    const failedKeys: string[] = []
    let identityProposals = 0

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const discovery = selected[index]
        const key = reviewSlateDiscoveryKey(discovery)
        setPassProgress({ current: index + 1, total: selected.length })
        emitRoleSearchProgress(roleId, 'saving', `Building your review batch: ${index + 1} of ${selected.length}`, index + 1, selected.length)
        if (!discovery.sourceResult) { failedKeys.push(key); continue }
        try {
          const response = await fetch('/api/workbench/save-source-profile', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sourceResult: discovery.sourceResult }),
          })
          const json = await response.json() as SaveResponse
          if (!response.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate Graph save failed.')
          successfulKeys.push(key)
          identityProposals += json.identityProposals?.created?.length || 0
          saved.push({
            discovery,
            candidateId: json.candidateId,
            candidateUrl: json.candidateUrl || `/app/candidate/${json.candidateId}`,
            reused: Boolean(json.reused),
          })
        } catch {
          failedKeys.push(key)
        }
      }

      let addedCount = 0
      let existingCount = 0
      const reusedCount = saved.filter(item => item.reused).length
      if (saved.length) {
        updateRole(roleId, workspace => {
          const existingIds = workspace.candidates.map(candidate => candidate.candidateId).filter((id): id is string => Boolean(id))
          const additions = buildRoleReviewSlateCandidates(saved, existingIds)
          addedCount = additions.length
          existingCount = saved.length - additions.length
          if (!additions.length) return workspace
          const now = new Date().toISOString()
          return {
            ...workspace,
            candidates: [...additions, ...workspace.candidates],
            activity: [{
              id: crypto.randomUUID(),
              type: 'candidate_added',
              message: `Created recruiter review slate with ${additions.length} canonical candidate${additions.length === 1 ? '' : 's'} from an explicit agent-save action. All entered as unreviewed.`,
              createdAt: now,
            }, ...workspace.activity],
            updatedAt: now,
          }
        })
      }

      setSavedKeys(current => Array.from(new Set([...current, ...successfulKeys])))
      setSelectedKeys(failedKeys)
      const proposalMessage = identityProposals
        ? ` ${identityProposals} deterministic cross-source identity review proposal${identityProposals === 1 ? '' : 's'} await recruiter review; no cross-source merge occurred.`
        : ' No cross-source identity was silently merged.'
      const failureMessage = failedKeys.length ? ` ${failedKeys.length} record${failedKeys.length === 1 ? '' : 's'} failed to save and remain selected for retry.` : ''
      setStatus(`Review slate ready: ${addedCount} new canonical candidate${addedCount === 1 ? '' : 's'} added as needs-review/unreviewed. ${existingCount} already existed in this role; ${reusedCount} Candidate Graph identit${reusedCount === 1 ? 'y was' : 'ies were'} reused.${proposalMessage}${failureMessage}`)
      emitRoleSearchProgress(roleId, 'ready', `First review batch ready: ${addedCount} new candidate${addedCount === 1 ? '' : 's'} to review.${failedKeys.length ? ` ${failedKeys.length} could not be saved.` : ''}`)
    } finally {
      setWorking('')
      setPassProgress({ current: 0, total: 0 })
    }
  }

  function clearPass() {
    if (working) return
    setDiscoveries([])
    setSelectedKeys([])
    setSavedKeys([])
    setSourceStatus({})
    setNovelty(null)
    setPassTelemetry({ discoveredBeforeCap: 0, returnedAfterCap: 0, sourceDistribution: {} })
    setStatus('Cleared this unsaved discovery pass. Role candidates and Candidate Graph records were not changed.')
  }

  return <section className="agent-review-slate-v33" aria-label="Sourcing agent review slate builder">
    <div className="agent-review-command">
      <div>
        <span className="kicker">V36.7 sourcing agent</span>
        <h2>Run the approved search plan. Review people before filtering them away.</h2>
        <p>SourcingOS separates discovery from admission: role-relevant people with incomplete public evidence remain visible as Promising — Verify instead of disappearing.</p>
      </div>
      <div className="agent-review-command-actions">
        <button className="btn" disabled={Boolean(working) || !executableLanes.length} onClick={() => void runApprovedAgentPass()}>
          {working === 'search' ? `Running ${passProgress.current}/${passProgress.total}…` : executableLanes.length ? 'Run sourcing agent' : 'Approve an executable hypothesis'}
        </button>
        <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(roleId)}?tab=strategy`}>Review hypotheses</Link>
      </div>
    </div>

    <div className="agent-review-metrics">
      <span><b>{approvedLanes.length}</b><small>approved hypotheses</small></span>
      <span><b>{executableSources.size}</b><small>executable sources</small></span>
      <span><b>{passTelemetry.discoveredBeforeCap || '—'}</b><small>raw discoveries</small></span>
      <span><b>{firstBatch.summary.discoveredPeople || '—'}</b><small>people assessed</small></span>
      <span><b>{firstBatch.summary.reviewReady}</b><small>Review Ready</small></span>
      <span><b>{firstBatch.summary.promisingVerify}</b><small>Promising · Verify</small></span>
      <span><b>{firstBatch.summary.held}</b><small>Held · inspectable</small></span>
    </div>

    {status && <div className="cta agent-review-status" role="status">{status}</div>}
    {!!approvedLocations.length && <div className="agent-review-source-status" aria-label="Recruiter-approved geography">
      <span className="status-pill active">Approved geography</span>
      {approvedLocations.map(location => <span className="status-pill" key={location}>{location}</span>)}
    </div>}
    {!!Object.keys(sourceStatus).length && <div className="agent-review-source-status">{Object.entries(sourceStatus).map(([key, value]) => <span
      className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`}
      key={key}
      title={value.message || value.geography?.explanation}
    >{key} · {value.status} · {value.discovered}{geographyStatusLabel(value)}</span>)}</div>}
    {!!passTelemetry.discoveredBeforeCap && <div className="agent-review-source-status" aria-label="Latest source orchestration summary">
      <span className="status-pill active">{passTelemetry.returnedAfterCap} retained from {passTelemetry.discoveredBeforeCap}</span>
      {Object.entries(passTelemetry.sourceDistribution).map(([source, count]) => <span className="status-pill" key={source}>{source} · {count} retained</span>)}
    </div>}

    {!!discoveries.length && <div className="agent-review-stage">
      <div className="agent-review-stage-head">
        <div>
          <span className="kicker">Recruiter admission funnel</span>
          <h3>{firstBatch.batch.length} in the capped first batch · {firstBatch.summary.reviewReady} Ready · {firstBatch.summary.promisingVerify} Verify · {firstBatch.summary.held} Held</h3>
          <p>Unknown evidence is not a rejection. Review Ready and Promising — Verify can enter the first batch; Held records remain visible and can still be manually included by the recruiter.</p>
        </div>
        <div className="agent-review-stage-actions">
          <button className="btn ghost" disabled={Boolean(working)} onClick={selectAllReviewable}>Select reviewable</button>
          <button className="btn ghost" disabled={Boolean(working)} onClick={() => setSelectedKeys([])}>Clear selection</button>
          <button className="btn ghost" disabled={Boolean(working)} onClick={clearPass}>Clear pass</button>
        </div>
      </div>

      {!!Object.keys(firstBatch.summary.heldByReason).length && <details className="advanced-disclosure">
        <summary>Why {firstBatch.summary.held} record{firstBatch.summary.held === 1 ? ' is' : 's are'} held</summary>
        <div className="agent-review-source-status">{Object.entries(firstBatch.summary.heldByReason).map(([reason, count]) => <span className="status-pill" key={reason}>{count} · {reason}</span>)}</div>
      </details>}

      <div className="agent-review-preflight">
        <span><b>{selected.length}</b><small>explicitly selected</small></span>
        <span><b>{identityReviewPreview.length}</b><small>possible identity reviews</small></span>
        <span><b>{novelty === null ? '—' : `${novelty}%`}</b><small>novel this pass</small></span>
        <span><b>{savedKeys.length}</b><small>already saved this pass</small></span>
      </div>

      <div className="agent-review-grid">{discoveries.slice(0, 50).map(discovery => {
        const key = reviewSlateDiscoveryKey(discovery)
        const personEligible = Boolean(discovery.saveEligible && discovery.sourceResult?.entityKind === 'person')
        const selectedNow = selectedKeys.includes(key)
        const saved = savedKeys.includes(key)
        const evidenceCheck = evidenceCheckByKey.get(key)
        const result = discovery.sourceResult
        const observedLocation = discovery.location || result?.location || ''
        const profileUrl = result?.profileUrl || discovery.sourceUrl
        const contacts = (result?.contactSignals || []).filter(signal => ['public_email', 'website', 'profile_url'].includes(signal.type)).slice(0, 3)
        const reviewLabel = evidenceCheck?.reviewState === 'review_ready'
          ? 'Review Ready'
          : evidenceCheck?.reviewState === 'promising_verify'
            ? 'Promising · Verify'
            : evidenceCheck?.reviewState === 'held'
              ? 'Held · inspect'
              : 'Discovery'
        return <article className={`agent-review-card ${selectedNow ? 'selected' : ''} ${saved ? 'saved' : ''}`} key={key}>
          <div className="agent-review-card-top">
            <label className="agent-review-check">
              <input type="checkbox" checked={selectedNow || saved} disabled={!personEligible || saved || Boolean(working)} onChange={() => toggleSelection(key)} />
              <span>{saved ? 'Saved' : !personEligible ? 'Preview only' : evidenceCheck?.reviewState === 'held' ? 'Include anyway' : 'Include'}</span>
            </label>
            <span className={`status-pill ${evidenceCheck?.reviewState === 'review_ready' ? 'success' : evidenceCheck?.reviewState === 'promising_verify' ? 'active' : ''}`}>{reviewLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
            {result?.avatarUrl
              ? <img src={result.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' }} />
              : <span className="role-candidate-avatar-v33-9">{candidateInitials(discovery.displayName)}</span>}
            <div style={{ minWidth: 0 }}>
              <h4 style={{ margin: 0 }}>{discovery.displayName}</h4>
              <p style={{ margin: '2px 0 0' }}>{[discovery.headline, discovery.organization].filter(Boolean).join(' · ') || 'Public-source identity'}</p>
            </div>
          </div>

          <div className="agent-review-source-status" style={{ marginBottom: 8 }}>
            <span className="status-pill">{sourceLabel(discovery.sourceKey)}</span>
            <span className={`status-pill ${observedLocation ? 'success' : ''}`}>{observedLocation ? `📍 ${observedLocation}` : '📍 Location not observed'}</span>
            <span className="status-pill">{contacts.length ? `${contacts.length} public contact signal${contacts.length === 1 ? '' : 's'}` : 'Contact not observed'}</span>
          </div>

          {!!result?.skills?.length && <div className="agent-review-source-status" aria-label="Observed skills">
            {result.skills.slice(0, 6).map(skill => <span className="status-pill" key={`${key}:skill:${skill}`}>{skill}</span>)}
          </div>}

          <div className="agent-review-evidence">{discovery.evidence.slice(0, 3).map((item, index) => <div key={`${key}:${index}`}><b>{item.label}</b><span>{item.value}</span></div>)}</div>
          {evidenceCheck && <p className={`agent-review-floor ${evidenceCheck.reviewState === 'held' ? 'held' : 'admitted'}`}>{evidenceCheck.explanation}</p>}

          {!!contacts.length && <div className="agent-review-source-status" aria-label="Public contact signals">
            {contacts.map((contact, index) => {
              const href = contactHref(contact.type, contact.value)
              return href
                ? <a className="status-pill" key={`${key}:contact:${index}`} href={href} target={contact.type === 'public_email' ? undefined : '_blank'} rel={contact.type === 'public_email' ? undefined : 'noreferrer noopener'}>{contact.type === 'public_email' ? 'Email' : contact.type === 'website' ? 'Website' : 'Profile'} ↗</a>
                : <span className="status-pill" key={`${key}:contact:${index}`}>{contact.type.replace('_', ' ')}</span>
            })}
          </div>}

          <div className="agent-review-card-foot">
            <span>{discovery.evidence.length} evidence items · {Math.round(discovery.identityConfidence * 100)}% source identity confidence</span>
            {profileUrl && <a href={profileUrl} target="_blank" rel="noreferrer noopener">Open {sourceLabel(discovery.sourceKey)} profile ↗</a>}
          </div>
        </article>
      })}</div>

      <div className="agent-review-create-bar">
        <div>
          <b>Create review slate</b>
          <span>{selected.length} selected source record{selected.length === 1 ? '' : 's'} will pass the canonical Candidate Graph write boundary again and enter this role as unreviewed.</span>
        </div>
        <button className="btn" disabled={Boolean(working) || !selected.length} onClick={() => void createReviewSlate()}>
          {working === 'slate' ? `Saving ${passProgress.current}/${passProgress.total}…` : `Create review slate (${selected.length})`}
        </button>
      </div>

      {!!savedKeys.length && <div className="agent-review-next"><Link className="btn secondary" href={`/app/roles/${encodeURIComponent(roleId)}?tab=candidates`}>Review role candidates →</Link><span>Evidence review remains separate from recruiter fit decisions. Nothing here auto-shortlists or rejects a person.</span></div>}
    </div>}

    <div className="agent-review-trust">Autonomous research · recruiter-controlled persistence · unknown ≠ negative · source criteria never become candidate evidence · no auto-reject · no auto-shortlist · no auto-contact · no silent cross-source merge.</div>
  </section>
}
