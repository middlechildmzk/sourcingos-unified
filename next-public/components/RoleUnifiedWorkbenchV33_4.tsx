'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoleCandidate, RoleIntake, RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { approveStagedRoleBrief, initializeApprovedRoleBrief, stageRoleBriefRevision } from '@/lib/role-brief-artifact-v33-4'
import {
  activeRoleBriefVersion,
  calibrationReviewAsk,
  roleBriefVersions,
  searchLaneProgress,
  slateGapAnalysis,
  type WorkbenchCandidateAssessment,
} from '@/lib/role-workbench-v33-4'
import {
  NEGATIVE_REVIEW_REASONS,
  concernsAfterReviewDecision,
  reviewReasonLabel,
  type NegativeReviewReasonCode,
} from '@/lib/recruiter-review-reasons-v33-4'
import { pickSlateEvidenceSnippet } from '@/lib/slate-evidence-v33-4'
import { searchCoverageSummary, type SearchAttempt } from '@/lib/search-state-memory-v30'

type EvidenceState = 'supported' | 'contradicted' | 'unknown' | 'needs_verification'
type Requirement = {
  requirementId: string
  requirementText: string
  tier: 'must_have' | 'preferred' | 'disqualifier'
  kind: 'general' | 'credential' | 'clearance'
  state: EvidenceState
  rationale: string
  evidence: Array<{ id: string; source: string; sourceType: string; sourceUrl?: string; evidenceClass: string; detail: string; spanText?: string; freshness: string }>
  contradictions: Array<{ id: string; source: string; detail: string; sourceUrl?: string }>
  recruiterContext: string[]
}
type PublicIdentity = {
  profiles: Array<{ source: string; sourceProfileId: string; displayName: string; profileUrl?: string; headline?: string }>
  contacts: Array<{ type: string; value: string; source: string; verified: boolean; permissionStatus: string }>
}
type CandidateAssessment = {
  candidateId: string
  canonicalName: string
  headline: string
  state: 'conflicting' | 'needs_verification' | 'insufficient_evidence' | 'evidence_ready' | 'no_requirements'
  tally: { supported: number; contradicted: number; needsVerification: number; unknown: number; total: number }
  mustHaveTally: { supported: number; contradicted: number; needsVerification: number; unknown: number; total: number }
  claimCount: number
  publicIdentity?: PublicIdentity
  requirements: Requirement[]
}
type AssessmentResponse = {
  ok?: boolean
  error?: string
  mode?: 'supabase' | 'preview'
  candidates?: CandidateAssessment[]
  trust?: { decision?: string; unknown?: string; sensitive?: string }
}

type Decision = 'strong_fit' | 'possible_fit' | 'not_fit'

type RejectionSuggestion = {
  code: NegativeReviewReasonCode | ''
  detail: string
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

function cloneIntake(intake: RoleIntake): RoleIntake {
  return {
    ...intake,
    mustHaves: [...intake.mustHaves],
    niceToHaves: [...intake.niceToHaves],
    disqualifiers: [...intake.disqualifiers],
    targetCompanies: [...intake.targetCompanies],
    adjacentBackgrounds: [...intake.adjacentBackgrounds],
  }
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 40)
}

function list(value: string[]): string {
  return value.join(', ')
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : value
}

function evidenceStateLabel(state: EvidenceState): string {
  if (state === 'needs_verification') return 'Needs verification'
  if (state === 'supported') return 'Supported'
  if (state === 'contradicted') return 'Contradicted'
  return 'Unknown'
}

function evidenceStateClass(state: EvidenceState): string {
  if (state === 'supported') return 'supported'
  if (state === 'contradicted') return 'contradicted'
  if (state === 'needs_verification') return 'verify'
  return 'unknown'
}

function decisionLabel(candidate: RoleCandidate): string {
  if (candidate.fitDecision === 'strong_fit') return 'Yes'
  if (candidate.fitDecision === 'possible_fit') return 'Maybe'
  if (candidate.fitDecision === 'not_fit') return 'No'
  return 'Unreviewed'
}

function safeSearchAttempts(roleId: string): SearchAttempt[] {
  return typeof window === 'undefined' ? [] : readAttempts(roleId)
}

function candidateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || '—').toUpperCase()
}

function sourceLabel(source: string): string {
  const normalized = source.toLowerCase()
  if (normalized === 'github') return 'GitHub'
  if (normalized === 'stackoverflow') return 'Stack Overflow'
  if (normalized === 'devto') return 'DEV'
  if (normalized === 'huggingface') return 'Hugging Face'
  if (normalized === 'linkedin') return 'LinkedIn'
  return source.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function publicContactHref(type: string, value: string): string | undefined {
  if (type === 'public_email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : undefined
  if (type !== 'website' && type !== 'profile_url') return undefined
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function eventTargetIsEditable(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

function rejectionSuggestion(assessment?: CandidateAssessment): RejectionSuggestion {
  if (!assessment) return { code: '', detail: '' }
  const disqualifier = assessment.requirements.find(requirement => requirement.tier === 'disqualifier' && (requirement.state === 'supported' || requirement.state === 'contradicted'))
  if (disqualifier) return { code: 'explicit_requirement_conflict', detail: `Recruiter-defined disqualifier requires review: ${disqualifier.requirementText}` }
  const contradicted = assessment.requirements.find(requirement => requirement.tier === 'must_have' && requirement.state === 'contradicted')
  return contradicted
    ? { code: 'explicit_requirement_conflict', detail: `Contradicted must-have: ${contradicted.requirementText}` }
    : { code: '', detail: '' }
}

export function RoleUnifiedWorkbenchV33_4({ roleId }: { roleId: string }) {
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const [attempts, setAttempts] = useState<SearchAttempt[]>([])
  const [assessment, setAssessment] = useState<AssessmentResponse>({ candidates: [] })
  const [assessmentNonce, setAssessmentNonce] = useState(0)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [candidateQuery, setCandidateQuery] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [editingBrief, setEditingBrief] = useState(false)
  const [briefDraft, setBriefDraft] = useState<RoleIntake | null>(null)
  const [rejectionCandidateId, setRejectionCandidateId] = useState('')
  const [rejectionReasonCode, setRejectionReasonCode] = useState<NegativeReviewReasonCode | ''>('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [status, setStatus] = useState('')
  const candidateSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!roleId) return
    const refresh = () => setAttempts(safeSearchAttempts(roleId))
    refresh()
    const timer = window.setInterval(refresh, 1500)
    window.addEventListener('storage', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('storage', refresh) }
  }, [roleId])

  const initializedRole = useMemo(() => role ? initializeApprovedRoleBrief(role) : null, [role])
  const brief = useMemo(() => initializedRole ? activeRoleBriefVersion(initializedRole) : null, [initializedRole])
  const briefVersions = useMemo(() => initializedRole ? roleBriefVersions(initializedRole) : [], [initializedRole])
  const laneProgress = useMemo(() => initializedRole ? searchLaneProgress(initializedRole, attempts) : [], [attempts, initializedRole])
  const coverage = useMemo(() => searchCoverageSummary(attempts), [attempts])
  const calibrationAsk = useMemo(() => initializedRole ? calibrationReviewAsk(initializedRole) : null, [initializedRole])

  const candidateKey = useMemo(() => role?.candidates.map(candidate => candidate.candidateId).filter(Boolean).sort().join('|') || '', [role?.candidates])
  const intakeKey = useMemo(() => role ? JSON.stringify({
    mustHaves: role.intake.mustHaves,
    niceToHaves: role.intake.niceToHaves,
    disqualifiers: role.intake.disqualifiers,
    clearance: role.intake.clearance,
  }) : '', [role])

  useEffect(() => {
    if (!role) return
    const canonical = role.candidates.filter(candidate => candidate.candidateId)
    if (!canonical.length) { setAssessment({ candidates: [] }); return }
    const controller = new AbortController()
    setAssessmentLoading(true)
    void (async () => {
      try {
        const response = await fetch('/api/role-candidate-assessment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            intake: role.intake,
            candidates: canonical.map(candidate => ({
              candidateId: candidate.candidateId,
              name: candidate.name,
              headline: candidate.headline,
              company: candidate.company,
              location: candidate.location,
              fitReasons: candidate.fitReasons,
              concerns: candidate.concerns,
              tags: candidate.tags,
              contactStatus: candidate.contactStatus,
              evidenceStatus: candidate.evidenceStatus,
            })),
          }),
        })
        const json = await response.json() as AssessmentResponse
        if (!response.ok || !json.ok) throw new Error(json.error || 'Evidence assessment failed.')
        setAssessment(json)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setAssessment({ ok: false, error: error instanceof Error ? error.message : 'Evidence assessment failed.', candidates: [] })
      } finally {
        if (!controller.signal.aborted) setAssessmentLoading(false)
      }
    })()
    return () => controller.abort()
  }, [role?.id, candidateKey, intakeKey, assessmentNonce])

  const assessmentById = useMemo(() => new Map((assessment.candidates || []).map(item => [item.candidateId, item])), [assessment.candidates])
  const filteredCandidates = useMemo(() => {
    if (!role) return []
    const needle = candidateQuery.trim().toLowerCase()
    const candidates = role.candidates.filter(candidate => !needle || [candidate.name, candidate.headline, candidate.company, candidate.location, candidate.source, ...candidate.tags].join(' ').toLowerCase().includes(needle))
    return [...candidates].sort((a, b) => {
      if (a.fitDecision === 'unreviewed' && b.fitDecision !== 'unreviewed') return -1
      if (b.fitDecision === 'unreviewed' && a.fitDecision !== 'unreviewed') return 1
      if (a.evidenceStatus === 'conflicting' && b.evidenceStatus !== 'conflicting') return -1
      if (b.evidenceStatus === 'conflicting' && a.evidenceStatus !== 'conflicting') return 1
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
  }, [candidateQuery, role])

  useEffect(() => {
    if (!filteredCandidates.length) { setSelectedCandidateId(''); return }
    if (!filteredCandidates.some(candidate => candidate.id === selectedCandidateId)) setSelectedCandidateId(filteredCandidates[0].id)
  }, [filteredCandidates, selectedCandidateId])

  const selectedCandidate = role?.candidates.find(candidate => candidate.id === selectedCandidateId)
  const selectedAssessment = selectedCandidate?.candidateId ? assessmentById.get(selectedCandidate.candidateId) : undefined
  const gapInput = useMemo<WorkbenchCandidateAssessment[]>(() => (assessment.candidates || []).map(candidate => ({
    candidateId: candidate.candidateId,
    requirements: candidate.requirements.map(requirement => ({
      requirementId: requirement.requirementId,
      requirementText: requirement.requirementText,
      tier: requirement.tier,
      state: requirement.state,
    })),
  })), [assessment.candidates])
  const gap = useMemo(() => slateGapAnalysis(gapInput), [gapInput])

  function updateCandidateDecision(candidate: RoleCandidate, decision: Decision, reasonCode: NegativeReviewReasonCode | '' = '', reasonDetail = '') {
    const now = new Date().toISOString()
    const reasonLabel = reviewReasonLabel(reasonCode)
    const detail = reasonDetail.trim()
    const reasonText = decision === 'not_fit'
      ? [reasonLabel, detail].filter(Boolean).join(' — ')
      : ''
    updateRole(roleId, workspace => ({
      ...workspace,
      candidates: workspace.candidates.map(item => item.id === candidate.id ? {
        ...item,
        fitDecision: decision,
        concerns: concernsAfterReviewDecision(item.concerns, decision, reasonCode, detail),
        updatedAt: now,
      } : item),
      activity: [{
        id: crypto.randomUUID(),
        type: 'candidate_reviewed',
        message: `Recruiter marked ${candidate.name} ${decision === 'strong_fit' ? 'Yes' : decision === 'possible_fit' ? 'Maybe' : 'No'}${reasonText ? ` — ${reasonText}` : ''}.`,
        createdAt: now,
      }, ...workspace.activity],
      updatedAt: now,
    }))
    setStatus(`${candidate.name}: ${decision === 'strong_fit' ? 'Yes' : decision === 'possible_fit' ? 'Maybe' : 'No'} recorded. This recruiter decision can inform proposed calibration; it does not rewrite candidate evidence.`)
  }

  function chooseDecision(decision: Decision) {
    if (!selectedCandidate) return
    if (decision === 'not_fit') {
      const suggestion = rejectionSuggestion(selectedAssessment)
      setRejectionCandidateId(selectedCandidate.id)
      setRejectionReasonCode(suggestion.code)
      setRejectionReason(suggestion.detail)
      return
    }
    updateCandidateDecision(selectedCandidate, decision)
    setRejectionCandidateId('')
    setRejectionReasonCode('')
    setRejectionReason('')
  }

  function confirmNo() {
    const candidate = role?.candidates.find(item => item.id === rejectionCandidateId)
    if (!candidate) return
    const reason = rejectionReason.trim()
    if (!rejectionReasonCode) { setStatus('Choose a recruiter reason before recording No. Unknown evidence is not a rejection reason by itself.'); return }
    if (rejectionReasonCode === 'other' && !reason) { setStatus('Add a short recruiter note when using Other so the feedback remains useful.'); return }
    updateCandidateDecision(candidate, 'not_fit', rejectionReasonCode, reason)
    setRejectionCandidateId('')
    setRejectionReasonCode('')
    setRejectionReason('')
  }

  function moveSelection(direction: -1 | 1) {
    if (!filteredCandidates.length) return
    const currentIndex = Math.max(0, filteredCandidates.findIndex(candidate => candidate.id === selectedCandidateId))
    const next = Math.min(filteredCandidates.length - 1, Math.max(0, currentIndex + direction))
    setSelectedCandidateId(filteredCandidates[next].id)
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (eventTargetIsEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === '?') { event.preventDefault(); setShowShortcuts(current => !current); return }
      if (!selectedCandidate) return
      if (key === 'j') { event.preventDefault(); moveSelection(-1) }
      if (key === 'k') { event.preventDefault(); moveSelection(1) }
      if (key === 'y') { event.preventDefault(); chooseDecision('strong_fit') }
      if (key === 'm') { event.preventDefault(); chooseDecision('possible_fit') }
      if (key === 'n') { event.preventDefault(); chooseDecision('not_fit') }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  function startBriefEdit() {
    if (!brief) return
    setBriefDraft(cloneIntake(brief.intake))
    setEditingBrief(true)
  }

  function updateBrief<K extends keyof RoleIntake>(field: K, value: RoleIntake[K]) {
    setBriefDraft(current => current ? ({ ...current, [field]: value } as RoleIntake) : current)
  }

  function saveBriefDraft() {
    if (!role || !briefDraft) return
    const updated = stageRoleBriefRevision(role, briefDraft)
    updateRole(roleId, () => updated)
    setEditingBrief(false)
    setStatus('Draft Role Brief saved. The currently approved intake and Search Plan are unchanged until you approve this version.')
  }

  function approveBrief() {
    if (!role) return
    const updated = approveStagedRoleBrief(role)
    updateRole(roleId, () => updated)
    setStatus('Role Brief approved. Search angles were regenerated as proposed; approve the angles you want before the next sourcing run.')
  }

  function scrollToSourcingAgent() {
    const element = document.querySelector('.agent-review-slate-v33') as HTMLElement | null
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!role || !initializedRole || !brief || !calibrationAsk) {
    return <section className="role-workbench-v33-4 role-workbench-loading-v33-4"><span className="kicker">Unified Role Workbench</span><p>{mode === 'checking' ? 'Loading role intelligence…' : 'Role workspace unavailable.'}</p></section>
  }

  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const selectedIndex = selectedCandidate ? filteredCandidates.findIndex(candidate => candidate.id === selectedCandidate.id) : -1
  const selectedActivity = selectedCandidate ? role.activity.filter(item => item.message.toLowerCase().includes(selectedCandidate.name.toLowerCase())).slice(0, 8) : []
  const approvedAngles = role.searchLanes.filter(lane => lane.status === 'approved').length
  const briefIsDraft = brief.status === 'draft'
  const selectedSupportedMustHaves = selectedAssessment?.requirements.filter(requirement => requirement.tier === 'must_have' && requirement.state === 'supported') || []
  const selectedVerificationNeeds = selectedAssessment?.requirements.filter(requirement => requirement.state === 'unknown' || requirement.state === 'needs_verification') || []
  const selectedPublicProfiles = selectedAssessment?.publicIdentity?.profiles || []
  const selectedPublicContacts = selectedAssessment?.publicIdentity?.contacts || []

  return <section className="role-workbench-v33-4" aria-label="Unified Role Workbench">
    <link rel="stylesheet" href="/role-review-speed-v33-4.css" />
    <header className="role-workbench-head-v33-4">
      <div>
        <div className="role-workbench-eyebrow-v33-4"><span className="kicker">Unified Role Workbench · V33.4</span><span className={`status-pill ${mode === 'supabase' ? 'success' : mode === 'error' ? 'warning' : ''}`}>{mode}</span></div>
        <h1>{role.intake.title}</h1>
        <p>{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? `Clearance: ${role.intake.clearance}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="role-workbench-head-actions-v33-4">
        <button className="btn" onClick={scrollToSourcingAgent}>{approvedAngles ? 'Run / continue sourcing' : 'Review search angles'}</button>
        <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(roleId)}?tab=calibration`}>Calibration</Link>
      </div>
    </header>

    {status && <div className="role-workbench-status-v33-4" role="status">{status}</div>}

    <div className="role-workbench-topline-v33-4" aria-label="Sourcing funnel">
      <span><b>Role Brief v{brief.version}</b><small className={briefIsDraft ? 'draft' : 'approved'}>{brief.status}</small></span>
      <span><b>{coverage.uniqueResultsSeen || '—'}</b><small>source profiles reviewed</small></span>
      <span><b>{role.candidates.length}</b><small>first review batch</small></span>
      <span><b>{reviewed}</b><small>recruiter decisions</small></span>
      <span><b>{approvedAngles}</b><small>search angles</small></span>
    </div>

    <div className="role-workbench-grid-v33-4">
      <details className="role-workbench-pane-v33-4 role-workbench-agent-v33-4">
        <summary className="role-workbench-pane-head-v33-4"><div><span className="kicker">Search brief + progress</span><h2>What SourcingOS searched and why</h2><p>{brief.intake.mustHaves.length} must-have{brief.intake.mustHaves.length === 1 ? '' : 's'} · {approvedAngles} search angles · {coverage.uniqueResultsSeen} source profiles reviewed</p></div><span className="role-agent-expand-v33-9">View details</span></summary>

        <section className="role-workbench-section-v33-4">
          <div className="role-workbench-section-head-v33-4"><div><b>Role Brief v{brief.version}</b><span>{brief.status === 'draft' ? 'Draft does not affect the active search.' : 'Recruiter approved'}</span></div><div className="role-workbench-inline-actions-v33-4"><button onClick={startBriefEdit}>Edit</button>{briefIsDraft && <button className="primary" onClick={approveBrief}>Approve</button>}</div></div>
          <div className="role-brief-chip-group-v33-4"><small>Must have</small><div>{brief.intake.mustHaves.map(item => <span key={item}>{item}</span>)}</div></div>
          <div className="role-brief-chip-group-v33-4"><small>Search constraints</small><div>{brief.intake.location !== 'Not specified' && <span>Location: {brief.intake.location}</span>}{brief.intake.workMode !== 'unknown' && <span>Work mode: {brief.intake.workMode}</span>}{brief.intake.clearance !== 'Not specified' && <span>Clearance: {brief.intake.clearance}</span>}</div>{brief.intake.clearance !== 'Not specified' && <p>Clearance is a verification-gated role constraint. Public technical sources receive capability-only queries; authorized recruiter surfaces can use the clearance search context.</p>}</div>
          {!!brief.intake.niceToHaves.length && <div className="role-brief-chip-group-v33-4 preferred"><small>Preferred</small><div>{brief.intake.niceToHaves.map(item => <span key={item}>{item}</span>)}</div></div>}
          {!!brief.intake.disqualifiers.length && <div className="role-brief-chip-group-v33-4 disqualifier"><small>Recruiter-defined conflicts</small><div>{brief.intake.disqualifiers.map(item => <span key={item}>{item}</span>)}</div><p>Surfaced for review; never used for silent rejection.</p></div>}
        </section>

        <section className="role-workbench-section-v33-4">
          <div className="role-workbench-section-head-v33-4"><div><b>How I interpreted the request</b><span>Visible assumptions before search</span></div></div>
          <div className="role-interpretations-v33-4">{brief.interpretations.map(note => <div key={note.id} className={note.verificationGated ? 'verification' : ''}><b>{note.label}</b><span>{note.statement}</span></div>)}</div>
        </section>

        <section className="role-workbench-section-v33-4">
          <div className="role-workbench-section-head-v33-4"><div><b>Search angles</b><span>Plan → search → assess → complete</span></div></div>
          <div className="role-search-progress-v33-4">{laneProgress.map(lane => <div key={lane.id} className={`state-${lane.state}`}><i /><span><b>{lane.label}</b><small>{lane.state}{lane.attempts ? ` · ${lane.yield} retained${lane.discoveredBeforeCap ? ` from ${lane.discoveredBeforeCap} discoveries` : ''}` : ''}</small></span></div>)}</div>
          <details className="role-workbench-disclosure-v33-4"><summary>Why SourcingOS searched here</summary><div>{role.searchLanes.map(lane => <p key={lane.id}><b>{lane.label}</b><br /><span>{lane.purpose}</span></p>)}</div></details>
        </section>

        <section className="role-workbench-section-v33-4">
          <div className="role-workbench-section-head-v33-4"><div><b>Mid-flight controls</b><span>Change one thing at a time</span></div></div>
          <div className="role-midflight-controls-v33-4">
            <button onClick={scrollToSourcingAgent}><b>Fetch more</b><span>Continue approved search angles</span></button>
            <button onClick={startBriefEdit}><b>Update search</b><span>Create a new Role Brief draft</span></button>
            <button onClick={() => setAssessmentNonce(value => value + 1)}><b>Refresh evidence</b><span>Reassess saved Candidate Graph evidence</span></button>
            <button onClick={() => candidateSearchRef.current?.focus()}><b>Filter candidates</b><span>Focus the review slate</span></button>
          </div>
        </section>

        <section className="role-workbench-section-v33-4 role-calibration-ask-v33-4">
          <div className="role-workbench-section-head-v33-4"><div><b>Calibration</b><span>{calibrationAsk.reviewed}/{calibrationAsk.minimumReviewed} review sample</span></div></div>
          <p>{calibrationAsk.message}</p>
          <div className="role-calibration-meter-v33-4"><span style={{ width: `${Math.min(100, (calibrationAsk.reviewed / calibrationAsk.minimumReviewed) * 100)}%` }} /></div>
          {calibrationAsk.ready && <Link href={`/app/roles/${encodeURIComponent(roleId)}?tab=calibration`}>Review proposed learning →</Link>}
        </section>

        <details className="role-workbench-disclosure-v33-4"><summary>Role Brief version history</summary><div className="role-brief-history-v33-4">{briefVersions.slice().reverse().map(version => <div key={version.id}><b>v{version.version} · {version.status}</b><span>{version.changeSummary.join(' ') || 'No change summary.'}</span><small>{formatDate(version.approvedAt || version.createdAt)}</small></div>)}</div></details>
      </details>

      <main className="role-workbench-pane-v33-4 role-workbench-slate-v33-4">
        <div className="role-workbench-pane-head-v33-4 role-slate-head-v33-4">
          <div><span className="kicker">First review batch</span><h2>{filteredCandidates.length} candidate{filteredCandidates.length === 1 ? '' : 's'} ready for judgment</h2><p>{coverage.uniqueResultsSeen ? `${coverage.uniqueResultsSeen} source profiles were reviewed before this batch.` : 'Only evidence-bearing people should enter this batch.'}</p></div>
          <div><input ref={candidateSearchRef} className="input" value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} placeholder="Filter slate…" aria-label="Filter review slate" /><button title="Keyboard shortcuts" onClick={() => setShowShortcuts(current => !current)}>?</button></div>
        </div>

        {showShortcuts && <div className="role-shortcuts-v33-4"><span><kbd>J</kbd> Previous</span><span><kbd>K</kbd> Next</span><span><kbd>Y</kbd> Yes</span><span><kbd>M</kbd> Maybe</span><span><kbd>N</kbd> No</span><span><kbd>?</kbd> Help</span></div>}

        {!!assessment.error && <div className="role-workbench-alert-v33-4">{assessment.error}</div>}
        {!!role.candidates.length && <div className="role-gap-analysis-v33-4">
          <div><span className="kicker">Slate gap analysis</span><b>{gap.mostEvidenceConstrained ? 'Most evidence-constrained must-have' : 'Building evidence picture'}</b></div>
          <p>{gap.summary}</p>
          {gap.mostEvidenceConstrained && <div className="role-gap-stats-v33-4"><span><b>{gap.mostEvidenceConstrained.supported}</b> supported</span><span><b>{gap.mostEvidenceConstrained.needsVerification}</b> verify</span><span><b>{gap.mostEvidenceConstrained.unknown}</b> unknown</span>{gap.mostEvidenceConstrained.contradicted > 0 && <span><b>{gap.mostEvidenceConstrained.contradicted}</b> contradicted</span>}</div>}
          <details><summary>Possible recruiter-approved next moves</summary>{gap.nextMoves.map(move => <p key={move}>• {move}</p>)}</details>
        </div>}

        <div className="role-candidate-table-v33-4">
          <div className="role-candidate-table-header-v33-4"><span>Candidate</span><span>Evidence coverage</span><span>Decision</span></div>
          {filteredCandidates.map(candidate => {
            const item = candidate.candidateId ? assessmentById.get(candidate.candidateId) : undefined
            const must = item?.mustHaveTally
            const snippet = pickSlateEvidenceSnippet(item?.requirements || [])
            const disqualifierFlags = item?.requirements.filter(requirement => requirement.tier === 'disqualifier' && requirement.state !== 'unknown').length || 0
            return <div className="role-candidate-row-shell-v33-4" key={candidate.id}>
              <button className={`role-candidate-row-v33-4 ${candidate.id === selectedCandidateId ? 'selected' : ''}`} onClick={() => setSelectedCandidateId(candidate.id)} aria-pressed={candidate.id === selectedCandidateId}>
                <span className="role-candidate-identity-v33-4"><span className="role-candidate-avatar-v33-9">{candidateInitials(candidate.name)}</span><span className="role-candidate-identity-copy-v33-9"><b>{candidate.name}</b><small>{[candidate.headline, candidate.company, candidate.location].filter(Boolean).join(' · ') || 'Public profile details are limited'}</small><em>{candidate.source.replace('_', ' ')} source</em></span></span>
                <span className="role-candidate-coverage-v33-4">{must ? <><b>{must.supported}/{must.total} must-haves supported</b><span className="role-candidate-coverage-meter-v33-9"><i style={{ width: `${must.total ? Math.round((must.supported / must.total) * 100) : 0}%` }} /></span><small>{must.needsVerification} need verification · {must.unknown} unknown{must.contradicted ? ` · ${must.contradicted} contradicted` : ''}</small>{disqualifierFlags ? <em>{disqualifierFlags} disqualifier review flag{disqualifierFlags === 1 ? '' : 's'}</em> : null}{snippet ? <span className="role-candidate-evidence-snippet-v33-4"><i>{evidenceStateLabel(snippet.state)} · {snippet.requirementText}</i><small title={snippet.detail}>{snippet.detail}</small><em>{snippet.source}</em></span> : <span className="role-candidate-evidence-empty-v33-4">No source-linked evidence snippet yet.</span>}</> : <><b>{candidate.candidateId ? assessmentLoading ? 'Assessing evidence…' : 'Evidence pending' : 'No canonical evidence link'}</b><small>Missing evidence is not a negative finding.</small><span className="role-candidate-evidence-empty-v33-4">No source-linked evidence snippet yet.</span></>}</span>
                <span className={`role-candidate-decision-v33-4 decision-${candidate.fitDecision}`}>{decisionLabel(candidate)}</span>
              </button>
              {snippet?.sourceUrl && <a className="role-candidate-row-source-v33-4" href={snippet.sourceUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open evidence source for ${candidate.name}`}>Open {snippet.source} evidence ↗</a>}
            </div>
          })}
          {!filteredCandidates.length && <div className="role-candidate-empty-v33-4"><b>{role.candidates.length ? 'No candidates match this filter.' : 'No review slate yet.'}</b><span>{role.candidates.length ? 'Clear the filter to continue reviewing.' : 'Run the approved sourcing agent below, select discoveries, and create a review slate.'}</span><button className="btn" onClick={scrollToSourcingAgent}>Open sourcing agent</button></div>}
        </div>
      </main>

      <aside className="role-workbench-pane-v33-4 role-workbench-candidate-v33-4">
        {selectedCandidate ? <>
          <div className="role-workbench-pane-head-v33-4 role-candidate-drawer-head-v33-4">
            <div className="role-candidate-hero-v33-9"><span className="role-candidate-avatar-v33-9 large">{candidateInitials(selectedCandidate.name)}</span><span><span className="kicker">Candidate 360 · selected</span><h2>{selectedCandidate.name}</h2><p>{[selectedCandidate.headline, selectedCandidate.company, selectedCandidate.location].filter(Boolean).join(' · ') || 'Public profile details are limited'}</p></span></div>
            <div className="role-candidate-nav-v33-4"><button disabled={selectedIndex <= 0} onClick={() => moveSelection(-1)}>← J</button><span>{selectedIndex + 1}/{filteredCandidates.length}</span><button disabled={selectedIndex < 0 || selectedIndex >= filteredCandidates.length - 1} onClick={() => moveSelection(1)}>K →</button></div>
          </div>

          <div className="role-review-actions-v33-4">
            <button className={selectedCandidate.fitDecision === 'strong_fit' ? 'active yes' : 'yes'} onClick={() => chooseDecision('strong_fit')}><kbd>Y</kbd><b>Yes</b></button>
            <button className={selectedCandidate.fitDecision === 'possible_fit' ? 'active maybe' : 'maybe'} onClick={() => chooseDecision('possible_fit')}><kbd>M</kbd><b>Maybe</b></button>
            <button className={selectedCandidate.fitDecision === 'not_fit' ? 'active no' : 'no'} onClick={() => chooseDecision('not_fit')}><kbd>N</kbd><b>No</b></button>
          </div>
          <p className="role-decision-note-v33-4">These are explicit recruiter decisions. They can inform proposed calibration, but they do not alter source evidence or silently reject/shortlist anyone.</p>

          {rejectionCandidateId === selectedCandidate.id && <div className="role-rejection-reason-v33-4"><b>Why No?</b><p>Choose the recruiting reason first. Unknown or unverifiable evidence is not automatically a rejection reason.</p><div className="role-rejection-chips-v33-4" role="group" aria-label="Recruiter rejection reason">{NEGATIVE_REVIEW_REASONS.map(reason => <button type="button" key={reason.id} className={rejectionReasonCode === reason.id ? 'selected' : ''} aria-pressed={rejectionReasonCode === reason.id} onClick={() => setRejectionReasonCode(reason.id)}>{reason.label}</button>)}</div><label className="role-rejection-detail-label-v33-4">Optional detail{rejectionReasonCode === 'other' ? ' (required for Other)' : ''}<textarea className="textarea" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Add context that would help future calibration…" /></label><div><button onClick={() => { setRejectionCandidateId(''); setRejectionReasonCode(''); setRejectionReason('') }}>Cancel</button><button className="primary" onClick={confirmNo}>Record No</button></div></div>}

          <section className="role-candidate-summary-v33-4">
            <div><span>Decision</span><b>{decisionLabel(selectedCandidate)}</b></div><div><span>Evidence</span><b>{selectedAssessment?.claimCount ?? 0} claims</b></div><div><span>Contact</span><b>{selectedPublicContacts.length ? `${selectedPublicContacts.length} public signal${selectedPublicContacts.length === 1 ? '' : 's'}` : selectedCandidate.contactStatus.replace('_', ' ')}</b></div>
          </section>

          <section className="role-candidate-requirements-v33-4">
            <div className="role-workbench-section-head-v33-4"><div><b>Why this person is here</b><span>Observed admission evidence, not search-term inference</span></div></div>
            {selectedAssessment ? <>
              {selectedSupportedMustHaves.length ? <div className="role-inline-citations-v33-4">{selectedSupportedMustHaves.map((requirement, index) => <div key={requirement.requirementId}><span className="role-citation-marker-v33-4">✓</span><span><b>{requirement.requirementText}</b><small>{requirement.evidence[0]?.spanText || requirement.evidence[0]?.detail || requirement.rationale}</small><em>{requirement.evidence[0]?.source || 'Candidate Graph evidence'}</em></span>{requirement.evidence[0]?.sourceUrl && <a href={requirement.evidence[0].sourceUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open admission evidence ${index + 1}`}>↗</a>}</div>)}</div> : <div className="role-unknown-evidence-v33-4">No must-have has qualifying Candidate Graph evidence yet. This record should be treated as a discovery requiring review, not as a proven match.</div>}
              {!!selectedVerificationNeeds.length && <div className="role-recruiter-context-v33-4"><b>Still unverified</b><span>{selectedVerificationNeeds.map(requirement => requirement.requirementText).join(' · ')}</span></div>}
              {selectedCandidate.location && <div className="role-recruiter-context-v33-4"><b>Observed location</b><span>{selectedCandidate.location} · requested search area: {brief.intake.location}</span></div>}
            </> : <div className="role-unknown-evidence-v33-4">Evidence assessment is still loading. Search criteria are never copied into candidate facts.</div>}
          </section>

          <section className="role-candidate-requirements-v33-4">
            <div className="role-workbench-section-head-v33-4"><div><b>Requirement evidence</b><span>No opaque fit score</span></div><button onClick={() => setAssessmentNonce(value => value + 1)}>{assessmentLoading ? 'Refreshing…' : 'Refresh'}</button></div>
            {selectedAssessment?.requirements.map(requirement => <article key={requirement.requirementId} className={`role-requirement-v33-4 ${evidenceStateClass(requirement.state)} tier-${requirement.tier}`}>
              <div className="role-requirement-head-v33-4"><span><b>{requirement.requirementText}</b><small>{requirement.tier.replace('_', ' ')}</small></span><em>{evidenceStateLabel(requirement.state)}</em></div>
              <p>{requirement.rationale}</p>
              {!!requirement.evidence.length && <div className="role-inline-citations-v33-4">{requirement.evidence.map((evidence, index) => <div key={evidence.id}><span className="role-citation-marker-v33-4">[{index + 1}]</span><span><b>{evidence.source} · {evidence.evidenceClass.replace('_', ' ')}</b><small>{evidence.spanText || evidence.detail}</small><em>{evidence.sourceType.replace('_', ' ')} · {evidence.freshness}</em></span>{evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open evidence source ${index + 1}`}>↗</a>}</div>)}</div>}
              {!requirement.evidence.length && <div className="role-unknown-evidence-v33-4">No qualifying source-linked evidence recorded. Missing evidence is not a red X.</div>}
              {!!requirement.contradictions.length && <div className="role-contradictions-v33-4"><b>Contradictory evidence</b>{requirement.contradictions.map(item => <span key={item.id}>{item.detail}{item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">source ↗</a></>}</span>)}</div>}
              {!!requirement.recruiterContext.length && <div className="role-recruiter-context-v33-4"><b>Recruiter context only</b><span>{requirement.recruiterContext.join(' · ')}</span></div>}
            </article>)}
            {!selectedAssessment && <div className="role-candidate-no-assessment-v33-4"><b>{selectedCandidate.candidateId ? assessmentLoading ? 'Assessing Candidate Graph evidence…' : 'No evidence assessment available.' : 'This role record is not linked to a canonical Candidate Graph identity yet.'}</b><span>Candidate facts are never backfilled from search criteria.</span></div>}
          </section>

          <section className="role-candidate-links-v33-4">
            <div className="role-workbench-section-head-v33-4"><div><b>Public profiles + contact signals</b><span>Observed provenance only; no guessed LinkedIn or contact data</span></div></div>
            {!!selectedPublicProfiles.length && <div className="role-inline-citations-v33-4">{selectedPublicProfiles.map(profile => <div key={`${profile.source}:${profile.sourceProfileId}`}><span className="role-citation-marker-v33-4">↗</span><span><b>{sourceLabel(profile.source)}</b><small>{profile.displayName}{profile.headline ? ` · ${profile.headline}` : ''}</small><em>{profile.sourceProfileId}</em></span>{profile.profileUrl && <a href={profile.profileUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open ${sourceLabel(profile.source)} profile`}>Open</a>}</div>)}</div>}
            {!!selectedPublicContacts.length && <div className="role-inline-citations-v33-4">{selectedPublicContacts.map(contact => {
              const href = publicContactHref(contact.type, contact.value)
              return <div key={`${contact.type}:${contact.value}`}><span className="role-citation-marker-v33-4">•</span><span><b>{contact.type === 'public_email' ? 'Public email' : contact.type === 'website' ? 'Website' : 'Profile link'} · {sourceLabel(contact.source)}</b><small>{contact.value}</small><em>{contact.verified ? 'verified signal' : 'public signal · not independently verified'}</em></span>{href && <a href={href} target={contact.type === 'public_email' ? undefined : '_blank'} rel={contact.type === 'public_email' ? undefined : 'noreferrer noopener'}>Open</a>}</div>
            })}</div>}
            {!selectedPublicProfiles.length && !selectedPublicContacts.length && <div className="role-unknown-evidence-v33-4">No additional public profile or contact signal is linked to this Candidate Graph identity yet. SourcingOS will not invent a LinkedIn URL, email, or cross-source identity.</div>}
            <div>{selectedCandidate.sourceUrl && <a href={selectedCandidate.sourceUrl} target="_blank" rel="noreferrer noopener">Original source ↗</a>}{selectedCandidate.candidateId && <Link href={`/app/candidate/${encodeURIComponent(selectedCandidate.candidateId)}`}>Full Candidate Graph →</Link>}</div>
          </section>

          <section className="role-candidate-activity-v33-4"><div className="role-workbench-section-head-v33-4"><div><b>Activity</b><span>Actor + timestamp trail</span></div></div>{selectedActivity.length ? selectedActivity.map(item => <div key={item.id}><i /><span><b>Recruiter</b><small>{item.message}</small><em>{formatDate(item.createdAt)}</em></span></div>) : <p>No candidate-specific activity recorded yet.</p>}</section>
        </> : <div className="role-candidate-empty-drawer-v33-4"><span>◈</span><b>Select a candidate</b><p>Candidate 360, requirement evidence, provenance, and fast review controls stay in this pane.</p></div>}
      </aside>
    </div>

    {editingBrief && briefDraft && <div className="role-brief-modal-backdrop-v33-4" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setEditingBrief(false) }}>
      <div className="role-brief-modal-v33-4" role="dialog" aria-modal="true" aria-label="Edit Role Brief">
        <header><div><span className="kicker">New Role Brief version</span><h2>Edit the search contract</h2><p>Saving creates a draft. The approved brief and Search Plan do not change until you explicitly approve the draft.</p></div><button onClick={() => setEditingBrief(false)}>×</button></header>
        <div className="grid two"><label>Title<input className="input" value={briefDraft.title} onChange={event => updateBrief('title', event.target.value)} /></label><label>Location<input className="input" value={briefDraft.location} onChange={event => updateBrief('location', event.target.value)} /></label><label>Work mode<select value={briefDraft.workMode} onChange={event => updateBrief('workMode', event.target.value as RoleIntake['workMode'])}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label><label>Clearance / credential<input className="input" value={briefDraft.clearance} onChange={event => updateBrief('clearance', event.target.value)} /></label></div>
        <label>Must-haves<textarea className="textarea" value={list(briefDraft.mustHaves)} onChange={event => updateBrief('mustHaves', parseList(event.target.value))} /></label>
        <label>Preferred<textarea className="textarea" value={list(briefDraft.niceToHaves)} onChange={event => updateBrief('niceToHaves', parseList(event.target.value))} /></label>
        <label>Disqualifiers<textarea className="textarea" value={list(briefDraft.disqualifiers)} onChange={event => updateBrief('disqualifiers', parseList(event.target.value))} /></label>
        <label>Target companies<textarea className="textarea" value={list(briefDraft.targetCompanies)} onChange={event => updateBrief('targetCompanies', parseList(event.target.value))} /></label>
        <label>Hiring-manager context<textarea className="textarea" value={briefDraft.hiringManagerNotes} onChange={event => updateBrief('hiringManagerNotes', event.target.value)} /></label>
        <footer><button className="btn ghost" onClick={() => setEditingBrief(false)}>Cancel</button><button className="btn" onClick={saveBriefDraft}>Save as draft version</button></footer>
      </div>
    </div>}

    <footer className="role-workbench-trust-v33-4"><span>{message}</span><b>Missing evidence is not a red X.</b><span>Search criteria never become candidate facts · no silent merge · no auto-reject · no auto-outreach.</span></footer>
  </section>
}
