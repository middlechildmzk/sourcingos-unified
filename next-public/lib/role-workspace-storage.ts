import type { RoleCandidate, RoleWorkspace } from './role-workspace'

export const ROLE_WORKSPACE_STORAGE_KEY = 'sourcingos.v20.role-workspaces'
export const ROLE_WORKSPACE_CHANGED_EVENT = 'sourcingos:role-workspaces-changed'

export type RoleCandidateInput = {
  candidateId?: string
  name: string
  headline?: string
  company?: string
  location?: string
  source: string
  sourceUrl?: string
  contactStatus?: RoleCandidate['contactStatus']
  evidenceStatus?: RoleCandidate['evidenceStatus']
  tags?: string[]
}

function normalize(value: string | undefined): string {
  return String(value || '').trim()
}

export function readRoleWorkspaces(): RoleWorkspace[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ROLE_WORKSPACE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeRoleWorkspaces(roles: RoleWorkspace[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROLE_WORKSPACE_STORAGE_KEY, JSON.stringify(roles))
  window.dispatchEvent(new CustomEvent(ROLE_WORKSPACE_CHANGED_EVENT, { detail: { count: roles.length } }))
}

export function roleCandidateIdentityKey(input: RoleCandidateInput): string {
  const sourceUrl = normalize(input.sourceUrl).toLowerCase()
  if (sourceUrl) return `url:${sourceUrl}`
  if (input.candidateId) return `candidate:${input.candidateId}`
  return `profile:${normalize(input.name).toLowerCase()}|${normalize(input.company).toLowerCase()}|${normalize(input.source).toLowerCase()}`
}

export function addCandidateToRole(roleId: string, input: RoleCandidateInput, now = new Date()): {
  ok: boolean
  duplicate: boolean
  role?: RoleWorkspace
  candidate?: RoleCandidate
  message: string
} {
  const roles = readRoleWorkspaces()
  const roleIndex = roles.findIndex(role => role.id === roleId)
  if (roleIndex < 0) return { ok: false, duplicate: false, message: 'Role workspace not found in this browser.' }

  const role = roles[roleIndex]
  const identityKey = roleCandidateIdentityKey(input)
  const duplicate = role.candidates.find(candidate => roleCandidateIdentityKey({
    candidateId: candidate.candidateId,
    name: candidate.name,
    company: candidate.company,
    source: candidate.source,
    sourceUrl: candidate.sourceUrl,
  }) === identityKey)

  if (duplicate) {
    return { ok: true, duplicate: true, role, candidate: duplicate, message: `${duplicate.name} is already in ${role.intake.title}.` }
  }

  const timestamp = now.toISOString()
  const candidate: RoleCandidate = {
    id: crypto.randomUUID(),
    candidateId: input.candidateId,
    name: normalize(input.name) || 'Unconfirmed profile',
    headline: normalize(input.headline),
    company: normalize(input.company),
    location: normalize(input.location),
    source: normalize(input.source) || 'unknown',
    sourceUrl: normalize(input.sourceUrl) || undefined,
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: Array.from(new Set((input.tags || []).map(normalize).filter(Boolean))).slice(0, 12),
    contactStatus: input.contactStatus || 'unknown',
    evidenceStatus: input.evidenceStatus || 'unreviewed',
    addedAt: timestamp,
    updatedAt: timestamp,
  }

  const updatedRole: RoleWorkspace = {
    ...role,
    candidates: [candidate, ...role.candidates],
    activity: [{
      id: crypto.randomUUID(),
      type: 'candidate_added',
      message: `Added ${candidate.name} from ${candidate.source} to the review queue.`,
      createdAt: timestamp,
    }, ...role.activity],
    updatedAt: timestamp,
  }

  const updatedRoles = [...roles]
  updatedRoles[roleIndex] = updatedRole
  writeRoleWorkspaces(updatedRoles)

  return { ok: true, duplicate: false, role: updatedRole, candidate, message: `Added ${candidate.name} to ${updatedRole.intake.title}.` }
}
