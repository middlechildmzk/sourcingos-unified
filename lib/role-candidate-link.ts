import type { RoleActivity, RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'
import type { EntityKind, SourceResult } from '@/lib/source-types'

export const ROLE_CANDIDATE_SAVED_EVENT = 'sourcingos:canonical-candidate-saved'

export type CanonicalCandidateSavedDetail = {
  candidateId: string
  result: SourceResult
}

export type RoleCandidateLinkInput = {
  candidateId: string
  entityKind: EntityKind
  displayName: string
  headline?: string
  organization?: string
  location?: string
  source: string
  profileUrl?: string
  skills?: string[]
  contactSignalCount?: number
}

export type RoleCandidateLinkResult = {
  workspace: RoleWorkspace
  added: boolean
  reason: 'added' | 'existing' | 'not_person' | 'invalid'
  roleCandidateId?: string
}

function activityFor(input: RoleCandidateLinkInput, createdAt: string): RoleActivity {
  return {
    id: `candidate-added:${input.candidateId}`,
    type: 'candidate_added',
    message: `Added ${input.displayName} from ${input.source} to the role review queue.`,
    createdAt,
  }
}

export function sourceResultToRoleCandidateInput(candidateId: string, result: SourceResult): RoleCandidateLinkInput {
  return {
    candidateId,
    entityKind: result.entityKind ?? 'unknown',
    displayName: result.displayName,
    headline: result.headline,
    organization: result.organization,
    location: result.location,
    source: result.source,
    profileUrl: result.profileUrl,
    skills: result.skills,
    contactSignalCount: result.contactSignals.length,
  }
}

export function addCanonicalCandidateToRole(
  workspace: RoleWorkspace,
  input: RoleCandidateLinkInput,
  now = new Date(),
): RoleCandidateLinkResult {
  if (!input.candidateId.trim() || !input.displayName.trim()) {
    return { workspace, added: false, reason: 'invalid' }
  }
  if (input.entityKind !== 'person') {
    return { workspace, added: false, reason: 'not_person' }
  }

  const existing = workspace.candidates.find(candidate => candidate.candidateId === input.candidateId)
  if (existing) {
    return { workspace, added: false, reason: 'existing', roleCandidateId: existing.id }
  }

  const timestamp = now.toISOString()
  const candidate: RoleCandidate = {
    id: input.candidateId,
    candidateId: input.candidateId,
    name: input.displayName.trim(),
    headline: input.headline?.trim() || '',
    company: input.organization?.trim() || '',
    location: input.location?.trim() || '',
    source: input.source,
    sourceUrl: input.profileUrl,
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: Array.from(new Set((input.skills || []).map(skill => skill.trim()).filter(Boolean))).slice(0, 20),
    contactStatus: input.contactSignalCount ? 'signals_found' : 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: timestamp,
    updatedAt: timestamp,
  }

  const activity = activityFor(input, timestamp)
  const activityExists = workspace.activity.some(item => item.id === activity.id)

  return {
    workspace: {
      ...workspace,
      candidates: [candidate, ...workspace.candidates],
      activity: activityExists ? workspace.activity : [activity, ...workspace.activity],
      updatedAt: timestamp,
    },
    added: true,
    reason: 'added',
    roleCandidateId: candidate.id,
  }
}
