'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRoleIntelligenceV33 } from '@/components/RoleIntelligenceProviderV33'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
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
  mergeReviewSlateDiscoveries,
  previewDeterministicIdentityReviews,
  reviewSlateDiscoveryKey,
  saveEligibleReviewSlateDiscoveries,
  type ReviewSlateDiscovery,
  type SavedSlateDiscovery,
} from '@/lib/agent-review-slate-v33-3'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type RunResponse = AgenticOrchestrationResponse & {
  ok?: boolean
  error?: string
  sourceStatus?: Record<string, { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }>
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

type SourceStatus = { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }

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

function mergeSourceStatus(current: Record<string, SourceStatus>, incoming: RunResponse['sourceStatus']) {
  const next = { ...current }
  for (const [key, value] of Object.entries(incoming || {})) {
    const prior = next[key]
    next[key] = prior
      ? {
          status: prior.status === 'completed' || value.status === 'completed' ? 'completed' : value.status,
          discovered: prior.discovered + value.discovered,
          message: value.message || prior.message,
        }
      : value
  }
  return next
}

export function RoleSourcingAgentV33_3({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const { onet, military, militaryApproved } = useRoleIntelligenceV33()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const plan = useMemo(
    () => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration, { onet, military, militaryApproved }) : null,
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

  const approvedLaneIds = useMemo(
    () => new Set((role?.searchLanes || []).filter(lane => lane.status === 'approved').map(lane => lane.id)),
    [role]
  )
  const approvedLanes = useMemo(
    () => plan?.lanes.filter(lane => approvedLaneIds.has(lane.id)) || [],
    [approvedLaneIds, plan]
  )
  const executableLanes = useMemo(
    () => approvedLanes.filter(lane => lane.tasks.some(task => task.mode === 'executable' && task.connectorKeys?.length)),
    [approvedLanes]
  )
  const executableSources = useMemo(
    () => new Set(executableLanes.flatMap(lane => lane.tasks.filter(task => task.mode === 'executable').flatMap(task => task.connectorKeys || []))),
    [executableLanes]
  )
  const saveEligible = useMemo(() => saveEligibleReviewSlateDiscoveries(discoveries), [discoveries])
  const selected = useMemo(() => {
    const keys = new Set(selectedKeys)
    return saveEligible.filter(item => keys.has(reviewSlateDiscoveryKey(item)))
  }, [saveEligible, selectedKeys])
  const identityReviewPreview = useMemo(() => previewDeterministicIdentityReviews(selected), [selected])
  const previewOnlyCount = discoveries.length - saveEligible.length

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

  function selectAllEligible() {
    const saved = new Set(savedKeys)
    setSelectedKeys(saveEligible.map(reviewSlateDiscoveryKey).filter(key => !saved.has(key)))
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

    try {
      for (let index = 0; index < executableLanes.length; index += 1) {
        const lane = executableLanes[index]
        setPassProgress({ current: index + 1, total: executableLanes.length })
        const executableTasks = lane.tasks.filter(task => task.mode === 'executable' && task.connectorKeys?.length)
        const allowedTasks = executableTasks.filter(task => shouldExecuteSearch(nextAttempts, task.surface, task.query).execute)
        if (!allowedTasks.length) continue
        runnableLaneCount += 1

        const connectors = Array.from(new Set(allowedTasks.flatMap(task => task.connectorKeys || [])))
        const connectorQueries: Partial<Record<AgenticConnectorKey, string>> = {}
        for (const task of allowedTasks) {
          for (const connector of task.connectorKeys || []) connectorQueries[connector] = task.query
        }
        const startedAt = new Date().toISOString()
        const running: SearchAttempt[] = allowedTasks.map(task => ({
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
        nextAttempts = [...nextAttempts, ...running].slice(-100)
        persistAttempts(nextAttempts)

        try {
          const intake = activeRole.intake
          const response = await fetch('/api/agentic-search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              query: allowedTasks[0].query,
              connectorQueries,
              skills: intake.mustHaves,
              targetCompanies: intake.targetCompanies,
              locations: intake.location && intake.location !== 'Not specified' ? [intake.location] : [],
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
      const autoSelected = saveEligibleReviewSlateDiscoveries(merged).map(reviewSlateDiscoveryKey).filter(key => !saved.has(key))
      setSelectedKeys(autoSelected)
      const thisPassKeys = foundThisPass.map(reviewSlateDiscoveryKey)
      setNovelty(resultNoveltyRate(priorResultKeys, thisPassKeys))
      setPassTelemetry({
        discoveredBeforeCap,
        returnedAfterCap: foundThisPass.length,
        sourceDistribution: sourceDistribution(foundThisPass),
      })
      const eligibleCount = saveEligibleReviewSlateDiscoveries(foundThisPass).length
      setStatus(`Agent pass finished: ${foundThisPass.length} unique source record${foundThisPass.length === 1 ? '' : 's'} retained from ${discoveredBeforeCap} raw public-source discover${discoveredBeforeCap === 1 ? 'y' : 'ies'}, with ${eligibleCount} eligible for an explicit review-slate save. No candidate was shortlisted, rejected, merged across sources, or contacted.`)
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

    const saved: SavedSlateDiscovery[] = []
    const successfulKeys: string[] = []
    const failedKeys: string[] = []
    let identityProposals = 0

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const discovery = selected[index]
        const key = reviewSlateDiscoveryKey(discovery)
        setPassProgress({ current: index + 1, total: selected.length })
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
        <span className="kicker">V33.3 sourcing agent</span>
        <h2>Run the approved search plan. Build one review slate.</h2>
        <p>SourcingOS executes the public sources attached to recruiter-approved hypotheses, accumulates unique source records, and waits for one explicit action before persisting a review slate.</p>
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
      <span><b>{passTelemetry.discoveredBeforeCap || '—'}</b><small>latest raw discoveries</small></span>
      <span><b>{discoveries.length}</b><small>unique review records</small></span>
    </div>

    {status && <div className="cta agent-review-status" role="status">{status}</div>}
    {!!Object.keys(sourceStatus).length && <div className="agent-review-source-status">{Object.entries(sourceStatus).map(([key, value]) => <span className={`status-pill ${value.status === 'completed' ? 'success' : value.status === 'failed' ? 'warning' : ''}`} key={key}>{key} · {value.status} · {value.discovered}</span>)}</div>}
    {!!passTelemetry.discoveredBeforeCap && <div className="agent-review-source-status" aria-label="Latest source orchestration summary">
      <span className="status-pill active">{passTelemetry.returnedAfterCap} retained from {passTelemetry.discoveredBeforeCap}</span>
      {Object.entries(passTelemetry.sourceDistribution).map(([source, count]) => <span className="status-pill" key={source}>{source} · {count} retained</span>)}
    </div>}

    {!!discoveries.length && <div className="agent-review-stage">
      <div className="agent-review-stage-head">
        <div>
          <span className="kicker">Proposed review slate</span>
          <h3>{saveEligible.length} save-eligible people · {previewOnlyCount} preview-only records</h3>
          <p>Select the source records you want persisted. Saving may create cross-source identity-review proposals, but never authorizes a cross-source merge.</p>
        </div>
        <div className="agent-review-stage-actions">
          <button className="btn ghost" disabled={Boolean(working)} onClick={selectAllEligible}>Select eligible</button>
          <button className="btn ghost" disabled={Boolean(working)} onClick={() => setSelectedKeys([])}>Clear selection</button>
          <button className="btn ghost" disabled={Boolean(working)} onClick={clearPass}>Clear pass</button>
        </div>
      </div>

      <div className="agent-review-preflight">
        <span><b>{selected.length}</b><small>explicitly selected</small></span>
        <span><b>{identityReviewPreview.length}</b><small>possible identity reviews</small></span>
        <span><b>{novelty === null ? '—' : `${novelty}%`}</b><small>novel this pass</small></span>
        <span><b>{savedKeys.length}</b><small>already saved this pass</small></span>
      </div>

      <div className="agent-review-grid">{discoveries.slice(0, 40).map(discovery => {
        const key = reviewSlateDiscoveryKey(discovery)
        const eligible = Boolean(discovery.saveEligible && discovery.sourceResult?.entityKind === 'person')
        const selectedNow = selectedKeys.includes(key)
        const saved = savedKeys.includes(key)
        return <article className={`agent-review-card ${selectedNow ? 'selected' : ''} ${saved ? 'saved' : ''}`} key={key}>
          <div className="agent-review-card-top">
            <label className="agent-review-check">
              <input type="checkbox" checked={selectedNow || saved} disabled={!eligible || saved || Boolean(working)} onChange={() => toggleSelection(key)} />
              <span>{saved ? 'Saved' : eligible ? 'Include' : 'Preview only'}</span>
            </label>
            <span className="status-pill">{discovery.sourceKey}</span>
          </div>
          <h4>{discovery.displayName}</h4>
          <p>{[discovery.headline, discovery.organization, discovery.location].filter(Boolean).join(' · ') || 'Public-source identity'}</p>
          <div className="agent-review-evidence">{discovery.evidence.slice(0, 2).map((item, index) => <div key={`${key}:${index}`}><b>{item.label}</b><span>{item.value}</span></div>)}</div>
          <div className="agent-review-card-foot"><span>{discovery.evidence.length} evidence items</span>{discovery.sourceUrl && <a href={discovery.sourceUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}</div>
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

    <div className="agent-review-trust">Autonomous research · recruiter-controlled persistence · source criteria never become candidate evidence · no auto-reject · no auto-shortlist · no auto-contact · no silent cross-source merge.</div>
  </section>
}
