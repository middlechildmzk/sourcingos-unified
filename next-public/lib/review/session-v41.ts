import type { RequirementAssessment, RequirementState } from '@/lib/requirement-assessment-v32'
import type { FitDecision, RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'

export const REVIEW_SESSION_MAX_CANDIDATES_V41 = 25
export const REVIEW_SESSION_STORAGE_PREFIX_V41 = 'sourcingos.v41.review-session'

export type ReviewDecisionV41 = 'evidence_fit' | 'not_fit' | 'needs_verification'

export type ReviewSessionSnapshotV41 = {
  roleId: string
  candidateIds: string[]
  createdAt: string
}

export type ReviewDecisionMutationV41 = {
  candidateId: string
  previousFitDecision: FitDecision
  previousEvidenceStatus: RoleCandidate['evidenceStatus']
  decision: ReviewDecisionV41
}

export function reviewSessionStorageKeyV41(roleId: string): string {
  return `${REVIEW_SESSION_STORAGE_PREFIX_V41}:${roleId}`
}

export function createReviewSessionSnapshotV41(
  role: RoleWorkspace,
  now = new Date(),
  maxCandidates = REVIEW_SESSION_MAX_CANDIDATES_V41,
): ReviewSessionSnapshotV41 {
  const limit = Math.max(1, Math.min(REVIEW_SESSION_MAX_CANDIDATES_V41, Math.trunc(maxCandidates || REVIEW_SESSION_MAX_CANDIDATES_V41)))
  return {
    roleId: role.id,
    candidateIds: role.candidates
      .filter(candidate => candidate.fitDecision === 'unreviewed')
      .slice(0, limit)
      .map(candidate => candidate.id),
    createdAt: now.toISOString(),
  }
}

export function validReviewSessionSnapshotV41(value: unknown, role: RoleWorkspace): ReviewSessionSnapshotV41 | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<ReviewSessionSnapshotV41>
  if (row.roleId !== role.id || !Array.isArray(row.candidateIds)) return null
  const validIds = new Set(role.candidates.map(candidate => candidate.id))
  const candidateIds = row.candidateIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)).slice(0, REVIEW_SESSION_MAX_CANDIDATES_V41)
  if (!candidateIds.length) return null
  return {
    roleId: role.id,
    candidateIds,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
  }
}

export function firstUndecidedReviewIndexV41(role: RoleWorkspace, snapshot: ReviewSessionSnapshotV41): number {
  const byId = new Map(role.candidates.map(candidate => [candidate.id, candidate]))
  const index = snapshot.candidateIds.findIndex(id => byId.get(id)?.fitDecision === 'unreviewed')
  return index >= 0 ? index : Math.max(0, snapshot.candidateIds.length - 1)
}

export function fitDecisionForReviewDecisionV41(decision: ReviewDecisionV41): FitDecision {
  if (decision === 'evidence_fit') return 'strong_fit'
  if (decision === 'not_fit') return 'not_fit'
  return 'possible_fit'
}

export function displayRequirementStateV41(assessment: RequirementAssessment): RequirementState {
  if (assessment.kind === 'clearance' && assessment.state === 'supported') return 'needs_verification'
  return assessment.state
}

export function requirementStateLabelV41(assessment: RequirementAssessment): string {
  if (assessment.kind === 'clearance') return 'Unverified clearance breadcrumb'
  const state = displayRequirementStateV41(assessment)
  if (state === 'supported') return 'Supported'
  if (state === 'contradicted') return 'Contradicted'
  if (state === 'needs_verification') return 'Needs verification'
  return 'Unknown'
}

export function applyReviewDecisionV41(
  role: RoleWorkspace,
  candidateId: string,
  decision: ReviewDecisionV41,
  now = new Date(),
): { role: RoleWorkspace; mutation: ReviewDecisionMutationV41 | null } {
  const candidate = role.candidates.find(item => item.id === candidateId)
  if (!candidate) return { role, mutation: null }

  const nextFitDecision = fitDecisionForReviewDecisionV41(decision)
  const nextEvidenceStatus: RoleCandidate['evidenceStatus'] = decision === 'needs_verification'
    ? 'unreviewed'
    : candidate.evidenceStatus === 'conflicting'
      ? 'conflicting'
      : 'reviewed'

  const mutation: ReviewDecisionMutationV41 = {
    candidateId,
    previousFitDecision: candidate.fitDecision,
    previousEvidenceStatus: candidate.evidenceStatus,
    decision,
  }
  const updatedAt = now.toISOString()
  const decisionLabel = decision === 'evidence_fit' ? 'Evidence fit' : decision === 'not_fit' ? 'Not a fit' : 'Needs verification'

  return {
    mutation,
    role: {
      ...role,
      updatedAt,
      candidates: role.candidates.map(item => item.id === candidateId ? {
        ...item,
        fitDecision: nextFitDecision,
        evidenceStatus: nextEvidenceStatus,
        stage: item.stage,
        updatedAt,
      } : item),
      activity: [{
        id: crypto.randomUUID(),
        type: 'candidate_reviewed' as const,
        message: `${decisionLabel}: ${candidate.name}.`,
        createdAt: updatedAt,
      }, ...role.activity].slice(0, 200),
    },
  }
}

export function undoReviewDecisionV41(
  role: RoleWorkspace,
  mutation: ReviewDecisionMutationV41,
  now = new Date(),
): RoleWorkspace {
  const updatedAt = now.toISOString()
  return {
    ...role,
    updatedAt,
    candidates: role.candidates.map(candidate => candidate.id === mutation.candidateId ? {
      ...candidate,
      fitDecision: mutation.previousFitDecision,
      evidenceStatus: mutation.previousEvidenceStatus,
      updatedAt,
    } : candidate),
    activity: [{
      id: crypto.randomUUID(),
      type: 'candidate_reviewed' as const,
      message: `Undid review decision for ${role.candidates.find(candidate => candidate.id === mutation.candidateId)?.name || 'candidate'}.`,
      createdAt: updatedAt,
    }, ...role.activity].slice(0, 200),
  }
}
