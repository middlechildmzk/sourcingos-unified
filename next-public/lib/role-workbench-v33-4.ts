import type { SearchAttempt } from './search-state-memory-v30'
import {
  buildSearchLanes,
  type RoleBriefInterpretationNote,
  type RoleBriefVersion,
  type RoleIntake,
  type RoleWorkspace,
} from './role-workspace'

export type WorkbenchLaneState = 'proposed' | 'planned' | 'searching' | 'assessing' | 'complete' | 'failed' | 'paused'

export type WorkbenchLaneProgress = {
  id: string
  label: string
  state: WorkbenchLaneState
  yield: number
  attempts: number
  uniqueToLane: number
  latestMessage?: string
}

export type WorkbenchEvidenceState = 'supported' | 'contradicted' | 'unknown' | 'needs_verification'

export type WorkbenchRequirementAssessment = {
  requirementId: string
  requirementText: string
  tier: 'must_have' | 'preferred' | 'disqualifier'
  state: WorkbenchEvidenceState
}

export type WorkbenchCandidateAssessment = {
  candidateId: string
  requirements: WorkbenchRequirementAssessment[]
}

export type SlateGap = {
  requirementText: string
  tier: WorkbenchRequirementAssessment['tier']
  supported: number
  contradicted: number
  needsVerification: number
  unknown: number
  total: number
}

export type SlateGapAnalysis = {
  candidateCount: number
  mostEvidenceConstrained?: SlateGap
  gaps: SlateGap[]
  summary: string
  nextMoves: string[]
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function nowIso(now: Date | string): string {
  return typeof now === 'string' ? now : now.toISOString()
}

function changedFields(before: RoleIntake, after: RoleIntake): string[] {
  const fields: Array<keyof RoleIntake> = [
    'title', 'location', 'workMode', 'compensation', 'clearance', 'mustHaves', 'niceToHaves',
    'disqualifiers', 'targetCompanies', 'adjacentBackgrounds', 'hiringManagerNotes',
  ]
  return fields.filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field])).map(String)
}

export function roleBriefInterpretations(intake: RoleIntake): RoleBriefInterpretationNote[] {
  const notes: RoleBriefInterpretationNote[] = []
  notes.push({
    id: 'source-truth',
    label: 'Source truth',
    category: 'trust',
    statement: 'Role and search criteria may retrieve a person, but they never become candidate facts without person-level evidence.',
  })
  if (intake.location && intake.location !== 'Not specified') {
    notes.push({
      id: 'location',
      label: 'Geography',
      category: 'location',
      statement: `Search geography is anchored to ${intake.location}. Any broader commuting-area interpretation must be recruiter-approved before it changes the search plan.`,
    })
  } else {
    notes.push({
      id: 'location-open',
      label: 'Geography',
      category: 'location',
      statement: 'No geographic constraint is confirmed yet. SourcingOS will not silently invent a commuting radius.',
    })
  }
  if (intake.workMode !== 'unknown') {
    notes.push({
      id: 'work-mode',
      label: 'Work mode',
      category: 'work_mode',
      statement: `${intake.workMode[0].toUpperCase()}${intake.workMode.slice(1)} is recruiter-provided role context and should constrain search strategy only as explicitly approved.`,
    })
  }
  if (intake.clearance && intake.clearance !== 'Not specified') {
    notes.push({
      id: 'clearance',
      label: 'Clearance / credential',
      category: 'clearance',
      verificationGated: true,
      statement: `${intake.clearance} is verification-gated. Public defense or GovCon breadcrumbs can support discovery, but they do not verify an active clearance.`,
    })
  }
  if (intake.disqualifiers.length) {
    notes.push({
      id: 'disqualifiers',
      label: 'Disqualifiers',
      category: 'scope',
      statement: `${intake.disqualifiers.length} recruiter-defined disqualifier${intake.disqualifiers.length === 1 ? '' : 's'} will be surfaced as review conflicts. They never auto-reject or silently hide a candidate.`,
    })
  }
  return notes
}

export function fallbackRoleBriefVersion(role: RoleWorkspace): RoleBriefVersion {
  return {
    id: `${role.id}-brief-1`,
    version: 1,
    status: 'approved',
    intake: role.intake,
    interpretations: roleBriefInterpretations(role.intake),
    changeSummary: ['Baseline role brief restored from the existing workspace.'],
    createdAt: role.createdAt,
    approvedAt: role.createdAt,
  }
}

export function roleBriefVersions(role: RoleWorkspace): RoleBriefVersion[] {
  const versions = role.roleBriefVersions?.length ? role.roleBriefVersions : [fallbackRoleBriefVersion(role)]
  return [...versions].sort((a, b) => a.version - b.version)
}

export function activeRoleBriefVersion(role: RoleWorkspace): RoleBriefVersion {
  const versions = roleBriefVersions(role)
  return versions.find(version => version.id === role.activeRoleBriefVersionId) || versions[versions.length - 1]
}

export function createRoleBriefRevision(role: RoleWorkspace, intake: RoleIntake, now: Date | string = new Date()): RoleWorkspace {
  const timestamp = nowIso(now)
  const versions = roleBriefVersions(role)
  const active = activeRoleBriefVersion(role)
  const changes = changedFields(active.intake, intake)
  if (!changes.length) return role
  const nextVersionNumber = Math.max(...versions.map(version => version.version), 0) + 1
  const version: RoleBriefVersion = {
    id: `${role.id}-brief-${nextVersionNumber}-${timestamp.replace(/\D/g, '').slice(0, 14)}`,
    version: nextVersionNumber,
    status: 'draft',
    intake,
    interpretations: roleBriefInterpretations(intake),
    changeSummary: changes.map(field => `Changed ${field}.`),
    createdAt: timestamp,
  }
  return {
    ...role,
    intake,
    searchLanes: buildSearchLanes(intake).map(lane => ({ ...lane, status: lane.status === 'approved' ? 'proposed' : lane.status })),
    roleBriefVersions: [...versions, version],
    activeRoleBriefVersionId: version.id,
    status: role.status === 'closed' ? role.status : 'calibrating',
    activity: [{
      id: crypto.randomUUID(),
      type: 'brief_version_created',
      message: `Created Role Brief v${nextVersionNumber} as a draft. Search-plan changes require recruiter approval.`,
      createdAt: timestamp,
    }, ...role.activity],
    updatedAt: timestamp,
  }
}

export function approveActiveRoleBrief(role: RoleWorkspace, now: Date | string = new Date()): RoleWorkspace {
  const timestamp = nowIso(now)
  const versions = roleBriefVersions(role)
  const active = activeRoleBriefVersion(role)
  if (active.status === 'approved') return role
  const updated = versions.map(version => {
    if (version.id === active.id) return { ...version, status: 'approved' as const, approvedAt: timestamp }
    if (version.status === 'approved') return { ...version, status: 'superseded' as const }
    return version
  })
  return {
    ...role,
    roleBriefVersions: updated,
    activeRoleBriefVersionId: active.id,
    activity: [{
      id: crypto.randomUUID(),
      type: 'brief_approved',
      message: `Approved Role Brief v${active.version}. Search hypotheses remain separately recruiter-controlled.`,
      createdAt: timestamp,
    }, ...role.activity],
    updatedAt: timestamp,
  }
}

export function searchLaneProgress(role: RoleWorkspace, attempts: SearchAttempt[]): WorkbenchLaneProgress[] {
  return role.searchLanes.map(lane => {
    const laneAttempts = attempts.filter(attempt => attempt.roleId === role.id && attempt.laneId === lane.id)
    const latest = [...laneAttempts].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0]
    const resultKeys = unique(laneAttempts.flatMap(attempt => attempt.resultKeys))
    let state: WorkbenchLaneState = lane.status === 'paused' ? 'paused' : lane.status === 'proposed' ? 'proposed' : 'planned'
    if (latest?.status === 'running') state = 'searching'
    else if (latest?.status === 'failed') state = 'failed'
    else if (latest?.status === 'partial') state = 'assessing'
    else if (latest?.status === 'completed') state = 'complete'
    return {
      id: lane.id,
      label: lane.label,
      state,
      yield: resultKeys.length,
      attempts: laneAttempts.length,
      uniqueToLane: resultKeys.length,
      latestMessage: latest?.message,
    }
  })
}

export function calibrationReviewAsk(role: RoleWorkspace, minimumReviewed = 3) {
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const remaining = Math.max(0, minimumReviewed - reviewed)
  return {
    reviewed,
    minimumReviewed,
    remaining,
    ready: remaining === 0,
    message: remaining
      ? `Review ${remaining} more candidate${remaining === 1 ? '' : 's'} before SourcingOS proposes a calibration revision.`
      : 'The role has enough recruiter decisions for SourcingOS to propose a calibration revision. Any search-plan change still requires approval.',
  }
}

export function slateGapAnalysis(candidates: WorkbenchCandidateAssessment[]): SlateGapAnalysis {
  const byRequirement = new Map<string, SlateGap>()
  for (const candidate of candidates) {
    for (const requirement of candidate.requirements) {
      const key = `${requirement.tier}:${requirement.requirementText.trim().toLowerCase()}`
      const gap = byRequirement.get(key) || {
        requirementText: requirement.requirementText,
        tier: requirement.tier,
        supported: 0,
        contradicted: 0,
        needsVerification: 0,
        unknown: 0,
        total: 0,
      }
      gap.total += 1
      if (requirement.state === 'supported') gap.supported += 1
      else if (requirement.state === 'contradicted') gap.contradicted += 1
      else if (requirement.state === 'needs_verification') gap.needsVerification += 1
      else gap.unknown += 1
      byRequirement.set(key, gap)
    }
  }

  const gaps = Array.from(byRequirement.values())
  const mustHaveGaps = gaps.filter(gap => gap.tier === 'must_have' && gap.total > 0)
  const mostEvidenceConstrained = [...mustHaveGaps].sort((a, b) => {
    const aResolved = a.supported / a.total
    const bResolved = b.supported / b.total
    if (aResolved !== bResolved) return aResolved - bResolved
    const aUnresolved = a.needsVerification + a.unknown
    const bUnresolved = b.needsVerification + b.unknown
    return bUnresolved - aUnresolved
  })[0]

  if (!candidates.length || !mostEvidenceConstrained) {
    return {
      candidateCount: candidates.length,
      gaps,
      summary: 'There is not enough canonical candidate evidence yet to identify a slate-level constraint.',
      nextMoves: ['Build or expand the review slate, then reassess the evidence distribution.'],
    }
  }

  const unresolved = mostEvidenceConstrained.needsVerification + mostEvidenceConstrained.unknown
  const summary = `${mostEvidenceConstrained.requirementText} is currently the most evidence-constrained must-have: ${mostEvidenceConstrained.supported}/${mostEvidenceConstrained.total} candidates have supporting evidence, ${mostEvidenceConstrained.needsVerification} need verification, ${mostEvidenceConstrained.unknown} remain unknown${mostEvidenceConstrained.contradicted ? `, and ${mostEvidenceConstrained.contradicted} show contradictory evidence` : ''}.`
  const nextMoves: string[] = []
  if (mostEvidenceConstrained.needsVerification) nextMoves.push('Keep the requirement verification-gated and review authoritative verification options before changing the search.')
  if (mostEvidenceConstrained.unknown) nextMoves.push('Increase evidence depth or add an approved source/search angle that can observe this requirement more directly.')
  if (mostEvidenceConstrained.contradicted) nextMoves.push('Inspect the contradictory evidence before deciding whether the requirement or search strategy should change.')
  if (!unresolved && !mostEvidenceConstrained.contradicted) nextMoves.push('The evidence is comparatively resolved; look at the next most constrained must-have before broadening the search.')
  nextMoves.push('No role criterion or candidate decision changes automatically from this analysis.')

  return { candidateCount: candidates.length, mostEvidenceConstrained, gaps, summary, nextMoves }
}
