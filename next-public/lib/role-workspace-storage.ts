import type { RoleActivity, RoleCandidate, RoleIntake, RoleWorkspace, SearchLane } from './role-workspace'
import { normalizeCalibrationState } from './calibration-intelligence'

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

const roleStatuses = new Set<RoleWorkspace['status']>(['draft', 'calibrating', 'active', 'paused', 'closed'])
const workModes = new Set<RoleIntake['workMode']>(['remote', 'hybrid', 'onsite', 'flexible', 'unknown'])
const laneSources = new Set<SearchLane['source']>(['candidate_database', 'network', 'github', 'research', 'healthcare', 'resume_xray', 'web_xray'])
const laneStatuses = new Set<SearchLane['status']>(['proposed', 'approved', 'paused'])
const candidateStages = new Set<RoleCandidate['stage']>(['discovered', 'needs_review', 'shortlisted', 'contact_research', 'ready_for_outreach', 'outreach_drafted', 'contacted', 'responded', 'interested', 'submitted', 'interviewing', 'offer', 'closed', 'archived'])
const fitDecisions = new Set<RoleCandidate['fitDecision']>(['unreviewed', 'strong_fit', 'possible_fit', 'not_fit'])
const contactStatuses = new Set<RoleCandidate['contactStatus']>(['unknown', 'signals_found', 'verified', 'blocked'])
const evidenceStatuses = new Set<RoleCandidate['evidenceStatus']>(['unreviewed', 'reviewed', 'conflicting', 'stale'])
const activityTypes = new Set<RoleActivity['type']>(['role_created', 'intake_updated', 'lane_approved', 'candidate_added', 'candidate_reviewed', 'stage_changed', 'note_added'])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function normalize(value: unknown): string {
  return String(value || '').trim()
}

function textArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(normalize).filter(Boolean))).slice(0, max)
}

function validIso(value: unknown, fallback: string): string {
  const text = normalize(value)
  return Number.isFinite(Date.parse(text)) ? text : fallback
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const text = normalize(value) as T
  return allowed.has(text) ? text : fallback
}

function timestamp(value: unknown): number {
  const parsed = Date.parse(normalize(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeIntake(value: unknown, legacy: Record<string, unknown>): RoleIntake {
  const intake = record(value) || {}
  return {
    title: normalize(intake.title || legacy.title) || 'Untitled role',
    location: normalize(intake.location || legacy.location) || 'Not specified',
    workMode: enumValue(intake.workMode || intake.work_mode, workModes, 'unknown'),
    compensation: normalize(intake.compensation) || 'Not specified',
    clearance: normalize(intake.clearance) || 'Not specified',
    mustHaves: textArray(intake.mustHaves || intake.must_haves),
    niceToHaves: textArray(intake.niceToHaves || intake.nice_to_haves),
    disqualifiers: textArray(intake.disqualifiers),
    targetCompanies: textArray(intake.targetCompanies || intake.target_companies),
    adjacentBackgrounds: textArray(intake.adjacentBackgrounds || intake.adjacent_backgrounds),
    hiringManagerNotes: normalize(intake.hiringManagerNotes || intake.hiring_manager_notes),
    rawDescription: normalize(intake.rawDescription || intake.raw_description || legacy.rawDescription || legacy.raw_description),
  }
}

function normalizeLane(value: unknown, roleId: string, index: number): SearchLane | null {
  const lane = record(value)
  if (!lane) return null
  const label = normalize(lane.label)
  const query = normalize(lane.query)
  if (!label && !query) return null
  return {
    id: normalize(lane.id) || `${roleId}-lane-${index}`,
    label: label || 'Search lane',
    purpose: normalize(lane.purpose),
    query,
    source: enumValue(lane.source, laneSources, 'web_xray'),
    status: enumValue(lane.status, laneStatuses, 'proposed'),
  }
}

function normalizeCandidate(value: unknown, roleId: string, index: number, fallbackTime: string): RoleCandidate | null {
  const candidate = record(value)
  if (!candidate) return null
  const name = normalize(candidate.name || candidate.canonicalName || candidate.canonical_name)
  if (!name) return null
  const addedAt = validIso(candidate.addedAt || candidate.added_at, fallbackTime)
  return {
    id: normalize(candidate.id) || `${roleId}-candidate-${index}`,
    candidateId: normalize(candidate.candidateId || candidate.candidate_id) || undefined,
    name,
    headline: normalize(candidate.headline),
    company: normalize(candidate.company || candidate.currentCompany || candidate.current_company),
    location: normalize(candidate.location),
    source: normalize(candidate.source) || 'unknown',
    sourceUrl: normalize(candidate.sourceUrl || candidate.source_url) || undefined,
    stage: enumValue(candidate.stage, candidateStages, 'needs_review'),
    fitDecision: enumValue(candidate.fitDecision || candidate.fit_decision, fitDecisions, 'unreviewed'),
    fitReasons: textArray(candidate.fitReasons || candidate.fit_reasons),
    concerns: textArray(candidate.concerns),
    tags: textArray(candidate.tags, 20),
    contactStatus: enumValue(candidate.contactStatus || candidate.contact_status, contactStatuses, 'unknown'),
    evidenceStatus: enumValue(candidate.evidenceStatus || candidate.evidence_status, evidenceStatuses, 'unreviewed'),
    addedAt,
    updatedAt: validIso(candidate.updatedAt || candidate.updated_at, addedAt),
  }
}

function normalizeActivity(value: unknown, roleId: string, index: number, fallbackTime: string): RoleActivity | null {
  const activity = record(value)
  if (!activity) return null
  const message = normalize(activity.message)
  if (!message) return null
  return {
    id: normalize(activity.id) || `${roleId}-activity-${index}`,
    type: enumValue(activity.type, activityTypes, 'note_added'),
    message,
    createdAt: validIso(activity.createdAt || activity.created_at, fallbackTime),
  }
}

export function normalizeRoleWorkspace(value: unknown): RoleWorkspace | null {
  const role = record(value)
  if (!role) return null
  const id = normalize(role.id)
  if (!id) return null
  const now = new Date().toISOString()
  const createdAt = validIso(role.createdAt || role.created_at, now)
  const updatedAt = validIso(role.updatedAt || role.updated_at, createdAt)
  const lanes = Array.isArray(role.searchLanes || role.search_lanes) ? role.searchLanes || role.search_lanes : []
  const candidates = Array.isArray(role.candidates) ? role.candidates : []
  const activity = Array.isArray(role.activity) ? role.activity : []
  return {
    id,
    status: enumValue(role.status, roleStatuses, 'calibrating'),
    intake: normalizeIntake(role.intake, role),
    searchLanes: (lanes as unknown[]).map((lane, index) => normalizeLane(lane, id, index)).filter((lane): lane is SearchLane => Boolean(lane)),
    candidates: candidates.map((candidate, index) => normalizeCandidate(candidate, id, index, createdAt)).filter((candidate): candidate is RoleCandidate => Boolean(candidate)),
    activity: activity.map((event, index) => normalizeActivity(event, id, index, createdAt)).filter((event): event is RoleActivity => Boolean(event)),
    calibration: role.calibration ? normalizeCalibrationState(role.calibration) : undefined,
    createdAt,
    updatedAt,
  }
}

function compactActivity(activity: RoleWorkspace['activity'] | undefined): RoleWorkspace['activity'] {
  const seenIntakeUpdates = new Set<string>()
  return [...(Array.isArray(activity) ? activity : [])]
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
    .filter(event => {
      if (event.type !== 'intake_updated') return true
      const key = `${event.type}|${event.message}`
      if (seenIntakeUpdates.has(key)) return false
      seenIntakeUpdates.add(key)
      return true
    })
    .slice(0, 2000)
}

export function readRoleWorkspaces(): RoleWorkspace[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ROLE_WORKSPACE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeRoleWorkspace).filter((role): role is RoleWorkspace => Boolean(role))
  } catch {
    return []
  }
}

export function writeRoleWorkspaces(roles: RoleWorkspace[]): void {
  if (typeof window === 'undefined') return
  const compacted = roles
    .map(normalizeRoleWorkspace)
    .filter((role): role is RoleWorkspace => Boolean(role))
    .map(role => ({ ...role, activity: compactActivity(role.activity) }))
  roles.splice(0, roles.length, ...compacted)
  window.localStorage.setItem(ROLE_WORKSPACE_STORAGE_KEY, JSON.stringify(compacted))
  window.dispatchEvent(new CustomEvent(ROLE_WORKSPACE_CHANGED_EVENT, { detail: { count: compacted.length } }))
}

export function roleCandidateIdentityKey(input: RoleCandidateInput): string {
  const sourceUrl = normalize(input.sourceUrl).toLowerCase()
  if (sourceUrl) return `url:${sourceUrl}`
  if (input.candidateId) return `candidate:${input.candidateId}`
  return `profile:${normalize(input.name).toLowerCase()}|${normalize(input.company).toLowerCase()}|${normalize(input.source).toLowerCase()}`
}

function mergeLanes(local: SearchLane[] = [], remote: SearchLane[] = []): SearchLane[] {
  const lanes = new Map<string, SearchLane>()
  for (const lane of remote) lanes.set(lane.id, lane)
  for (const lane of local) lanes.set(lane.id, lane)
  return Array.from(lanes.values())
}

function mergeCandidates(local: RoleCandidate[] = [], remote: RoleCandidate[] = []): RoleCandidate[] {
  const candidates = new Map<string, RoleCandidate>()
  for (const candidate of remote) candidates.set(roleCandidateIdentityKey(candidate), candidate)
  for (const candidate of local) {
    const key = roleCandidateIdentityKey(candidate)
    const existing = candidates.get(key)
    candidates.set(key, !existing || timestamp(candidate.updatedAt) >= timestamp(existing.updatedAt) ? candidate : existing)
  }
  return Array.from(candidates.values()).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
}

function mergeCalibration(
  preferred: RoleWorkspace['calibration'],
  secondary: RoleWorkspace['calibration']
): RoleWorkspace['calibration'] {
  if (!preferred) return secondary
  if (!secondary) return preferred
  const insights = new Map(secondary.insights.map(insight => [insight.id, insight]))
  for (const insight of preferred.insights) {
    const other = insights.get(insight.id)
    if (!other || timestamp(insight.updatedAt) >= timestamp(other.updatedAt)) insights.set(insight.id, insight)
  }
  const events = new Map(secondary.events.map(event => [event.id, event]))
  for (const event of preferred.events) events.set(event.id, event)
  return {
    insights: Array.from(insights.values()).sort((a, b) => a.id.localeCompare(b.id)),
    events: Array.from(events.values()).sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt)).slice(-500),
    updatedAt: timestamp(preferred.updatedAt) >= timestamp(secondary.updatedAt) ? preferred.updatedAt : secondary.updatedAt,
  }
}

export function mergeRoleWorkspaces(local: RoleWorkspace[], remote: RoleWorkspace[]): RoleWorkspace[] {
  const roles = new Map<string, RoleWorkspace>()
  for (const value of remote) {
    const workspace = normalizeRoleWorkspace(value)
    if (workspace) roles.set(workspace.id, workspace)
  }
  for (const value of local) {
    const workspace = normalizeRoleWorkspace(value)
    if (!workspace) continue
    const server = roles.get(workspace.id)
    if (!server) {
      roles.set(workspace.id, { ...workspace, activity: compactActivity(workspace.activity) })
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
      calibration: mergeCalibration(preferred.calibration, secondary.calibration),
      activity: compactActivity(Array.from(activity.values())),
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

  if (duplicate) return { ok: true, duplicate: true, role, candidate: duplicate, message: `${duplicate.name} is already in ${role.intake.title}.` }

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
    activity: [{ id: crypto.randomUUID(), type: 'candidate_added', message: `Added ${candidate.name} from ${candidate.source} to the review queue.`, createdAt: timestampValue }, ...role.activity],
    updatedAt: timestampValue,
  }

  const updatedRoles = [...roles]
  updatedRoles[roleIndex] = updatedRole
  writeRoleWorkspaces(updatedRoles)
  return { ok: true, duplicate: false, role: updatedRole, candidate, message: `Added ${candidate.name} to ${updatedRole.intake.title}.` }
}
