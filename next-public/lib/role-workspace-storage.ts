import type { RoleCandidate, RoleWorkspace, SearchLane } from './role-workspace'

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

function timestamp(value: string | undefined): number {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
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

function mergeLanes(local: SearchLane[], remote: SearchLane[]): SearchLane[] {
  const lanes = new Map<string, SearchLane>()
  for (const lane of remote) lanes.set(lane.id, lane)
  for (const lane of local) lanes.set(lane.id, lane)
  return Array.from(lanes.values())
}

function mergeCandidates(local: RoleCandidate[], remote: RoleCandidate[]): RoleCandidate[] {
  const candidates = new Map<string, RoleCandidate>()
  for (const candidate of remote) {
    candidates.set(roleCandidateIdentityKey(candidate), candidate)
  }
  for (const candidate of local) {
    const key = roleCandidateIdentityKey(candidate)
    const existing = candidates.get(key)
    candidates.set(key, !existing || timestamp(candidate.updatedAt) >= timestamp(existing.updatedAt) ? candidate : existing)
  }
  return Array.from(candidates.values()).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
}

export function mergeRoleWorkspaces(local: RoleWorkspace[], remote: RoleWorkspace[]): RoleWorkspace[] {
  const roles = new Map<string, RoleWorkspace>()
  for (const workspace of remote) roles.set(workspace.id, workspace)
  for (const workspace of local) {
    const server = roles.get(workspace.id)
    if (!server) {
      roles.set(workspace.id, workspace)
      continue
    }
    const localIsNewer = timestamp(workspace.updatedAt) >= timestamp(server.updatedAt)
    const preferred = localIsNewer ? workspace : server
    const secondary = localIsNewer ? server : workspace
    const activity = new Map(secondary.activity.map(event => [event.id, event]))
    for (const event of preferred.activity) activity.set(event.id, event)
    roles.set(workspace.id, {
      ...preferred,
      searchLanes: mergeLanes(workspace.searchLanes, server.searchLanes),
      candidates: mergeCandidates(workspace.candidates, server.candidates),
      activity: Array.from(activity.values()).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)),
      createdAt: timestamp(workspace.createdAt) <= timestamp(server.createdAt) ? workspace.createdAt : server.createdAt,
      updatedAt: timestamp(workspace.updatedAt) >= timestamp(server.updatedAt) ? workspace.updatedAt : server.updatedAt,
    })
  }
  return Array.from(roles.values()).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
}

export function hydrateRoleWorkspaces(remote: RoleWorkspace[]): RoleWorkspace[] {
  const merged = mergeRoleWorkspaces(readRoleWorkspaces(), remote)
  writeRoleWorkspaces(merged)
  return merged
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

  const timestampValue = now.toISOString()
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
    addedAt: timestampValue,
    updatedAt: timestampValue,
  }

  const updatedRole: RoleWorkspace = {
    ...role,
    candidates: [candidate, ...role.candidates],
    activity: [{
      id: crypto.randomUUID(),
      type: 'candidate_added',
      message: `Added ${candidate.name} from ${candidate.source} to the review queue.`,
      createdAt: timestampValue,
    }, ...role.activity],
    updatedAt: timestampValue,
  }

  const updatedRoles = [...roles]
  updatedRoles[roleIndex] = updatedRole
  writeRoleWorkspaces(updatedRoles)

  return { ok: true, duplicate: false, role: updatedRole, candidate, message: `Added ${candidate.name} to ${updatedRole.intake.title}.` }
}
