import type { FitDecision, RoleCandidate, RoleStage, RoleWorkspace } from './role-workspace'

export type RoleCandidateReviewSummary = {
  supportedMustHaves: string[]
  unconfirmedMustHaves: string[]
  supportedNiceToHaves: string[]
  unconfirmedNiceToHaves: string[]
  concerns: string[]
  verifyNext: string[]
  summary: string
}

export type RoleFitDecisionResult = {
  workspace: RoleWorkspace
  changed: boolean
  reason: 'updated' | 'unchanged' | 'missing_candidate'
}

export type RoleStageResult = {
  workspace: RoleWorkspace
  changed: boolean
  reason: 'updated' | 'unchanged' | 'missing_candidate'
}

export type RoleReviewSignalKind = 'fit_reason' | 'concern'

export type RoleReviewSignalResult = {
  workspace: RoleWorkspace
  changed: boolean
  reason: 'added' | 'duplicate' | 'invalid' | 'missing_candidate'
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsPhrase(value: string, phrase: string): boolean {
  if (!value || !phrase) return false
  return ` ${value} `.includes(` ${phrase} `)
}

function supportedByReviewSignal(requirement: string, reviewSignals: string[]): boolean {
  const target = normalized(requirement)
  if (!target) return false
  return reviewSignals.some(signal => {
    const candidate = normalized(signal)
    return candidate === target || containsPhrase(candidate, target)
  })
}

export function recordRoleCandidateFitDecision(
  role: RoleWorkspace,
  candidateId: string,
  decision: FitDecision,
  now = new Date(),
  activityId = crypto.randomUUID(),
): RoleFitDecisionResult {
  const index = role.candidates.findIndex(candidate => candidate.candidateId === candidateId || candidate.id === candidateId)
  if (index < 0) return { workspace: role, changed: false, reason: 'missing_candidate' }

  const candidate = role.candidates[index]
  if (candidate.fitDecision === decision) {
    return { workspace: role, changed: false, reason: 'unchanged' }
  }

  const updatedAt = now.toISOString()
  const nextCandidate: RoleCandidate = {
    ...candidate,
    fitDecision: decision,
    updatedAt,
  }
  const nextCandidates = [...role.candidates]
  nextCandidates[index] = nextCandidate

  return {
    changed: true,
    reason: 'updated',
    workspace: {
      ...role,
      candidates: nextCandidates,
      activity: [
        ...role.activity,
        {
          id: activityId,
          type: 'candidate_reviewed',
          message: `Recorded ${decision.replaceAll('_', ' ')} for ${candidate.name}.`,
          createdAt: updatedAt,
        },
      ],
      updatedAt,
    },
  }
}

export function recordRoleCandidateStage(
  role: RoleWorkspace,
  candidateId: string,
  stage: RoleStage,
  now = new Date(),
  activityId = crypto.randomUUID(),
): RoleStageResult {
  const index = role.candidates.findIndex(candidate => candidate.candidateId === candidateId || candidate.id === candidateId)
  if (index < 0) return { workspace: role, changed: false, reason: 'missing_candidate' }

  const candidate = role.candidates[index]
  if (candidate.stage === stage) {
    return { workspace: role, changed: false, reason: 'unchanged' }
  }

  const updatedAt = now.toISOString()
  const previousStage = candidate.stage
  const nextCandidate: RoleCandidate = {
    ...candidate,
    stage,
    updatedAt,
  }
  const nextCandidates = [...role.candidates]
  nextCandidates[index] = nextCandidate

  return {
    changed: true,
    reason: 'updated',
    workspace: {
      ...role,
      candidates: nextCandidates,
      activity: [
        ...role.activity,
        {
          id: activityId,
          type: 'stage_changed',
          message: `Moved ${candidate.name} from ${previousStage.replaceAll('_', ' ')} to ${stage.replaceAll('_', ' ')}.`,
          createdAt: updatedAt,
        },
      ],
      updatedAt,
    },
  }
}

export function recordRoleCandidateReviewSignal(
  role: RoleWorkspace,
  candidateId: string,
  kind: RoleReviewSignalKind,
  text: string,
  now = new Date(),
  activityId = crypto.randomUUID(),
): RoleReviewSignalResult {
  const index = role.candidates.findIndex(candidate => candidate.candidateId === candidateId || candidate.id === candidateId)
  if (index < 0) return { workspace: role, changed: false, reason: 'missing_candidate' }

  const value = text.trim().replace(/\s+/g, ' ')
  if (value.length < 3 || value.length > 300) {
    return { workspace: role, changed: false, reason: 'invalid' }
  }

  const candidate = role.candidates[index]
  const current = kind === 'fit_reason' ? candidate.fitReasons : candidate.concerns
  const duplicate = current.some(item => item.trim().toLowerCase() === value.toLowerCase())
  if (duplicate) return { workspace: role, changed: false, reason: 'duplicate' }

  const updatedAt = now.toISOString()
  const nextCandidate: RoleCandidate = {
    ...candidate,
    ...(kind === 'fit_reason'
      ? { fitReasons: [...candidate.fitReasons, value] }
      : { concerns: [...candidate.concerns, value] }),
    updatedAt,
  }
  const nextCandidates = [...role.candidates]
  nextCandidates[index] = nextCandidate
  const label = kind === 'fit_reason' ? 'fit rationale' : 'concern'

  return {
    changed: true,
    reason: 'added',
    workspace: {
      ...role,
      candidates: nextCandidates,
      activity: [
        ...role.activity,
        {
          id: activityId,
          type: 'note_added',
          message: `Added ${label} for ${candidate.name}: ${value.slice(0, 120)}${value.length > 120 ? '…' : ''}`,
          createdAt: updatedAt,
        },
      ],
      updatedAt,
    },
  }
}

export function buildRoleCandidateReview(
  role: RoleWorkspace,
  candidate: RoleCandidate,
): RoleCandidateReviewSummary {
  const reviewSignals = unique([...candidate.tags, ...candidate.fitReasons])
  const supportedMustHaves = role.intake.mustHaves.filter(requirement => supportedByReviewSignal(requirement, reviewSignals))
  const unconfirmedMustHaves = role.intake.mustHaves.filter(requirement => !supportedMustHaves.includes(requirement))
  const supportedNiceToHaves = role.intake.niceToHaves.filter(requirement => supportedByReviewSignal(requirement, reviewSignals))
  const unconfirmedNiceToHaves = role.intake.niceToHaves.filter(requirement => !supportedNiceToHaves.includes(requirement))
  const concerns = unique(candidate.concerns)
  const verifyNext: string[] = []

  if (unconfirmedMustHaves.length) {
    verifyNext.push(`Verify ${unconfirmedMustHaves.slice(0, 3).join(', ')}${unconfirmedMustHaves.length > 3 ? ` and ${unconfirmedMustHaves.length - 3} more` : ''}.`)
  }
  if (candidate.evidenceStatus === 'unreviewed') {
    verifyNext.push('Review the underlying evidence before making a role-fit decision.')
  } else if (candidate.evidenceStatus === 'conflicting') {
    verifyNext.push('Resolve conflicting evidence before advancing or presenting this person.')
  } else if (candidate.evidenceStatus === 'stale') {
    verifyNext.push('Refresh stale evidence before relying on it for this role.')
  }
  if (candidate.contactStatus === 'unknown' || candidate.contactStatus === 'signals_found') {
    verifyNext.push('Verify any contact path and permission before outreach.')
  }
  if (role.intake.clearance && role.intake.clearance !== 'Not specified') {
    verifyNext.push(`Confirm ${role.intake.clearance} only through the appropriate authorized process.`)
  }
  if (concerns.length) {
    verifyNext.push('Resolve the recorded concerns or document why they do not block this role.')
  }
  if (candidate.fitDecision === 'unreviewed') {
    verifyNext.push('Record a recruiter-controlled fit decision in the role review queue.')
  }

  const totalMustHaves = role.intake.mustHaves.length
  const summary = totalMustHaves
    ? `Current role-review tags and reasons support ${supportedMustHaves.length} of ${totalMustHaves} must-have requirements. This is review coverage, not independent verification.`
    : 'No explicit must-have requirements are configured for this role yet.'

  return {
    supportedMustHaves,
    unconfirmedMustHaves,
    supportedNiceToHaves,
    unconfirmedNiceToHaves,
    concerns,
    verifyNext: unique(verifyNext),
    summary,
  }
}
