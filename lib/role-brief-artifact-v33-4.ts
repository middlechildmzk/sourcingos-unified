import { buildSearchLanes, type RoleBriefVersion, type RoleIntake, type RoleWorkspace } from './role-workspace'
import { activeRoleBriefVersion, roleBriefInterpretations, roleBriefVersions } from './role-workbench-v33-4'

function iso(now: Date | string): string {
  return typeof now === 'string' ? now : now.toISOString()
}

function changedFields(before: RoleIntake, after: RoleIntake): string[] {
  const fields: Array<keyof RoleIntake> = [
    'title', 'location', 'workMode', 'compensation', 'clearance', 'mustHaves', 'niceToHaves',
    'disqualifiers', 'targetCompanies', 'adjacentBackgrounds', 'hiringManagerNotes',
  ]
  return fields.filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field])).map(String)
}

function eventId(roleId: string, type: string, timestamp: string): string {
  return `${roleId}-${type}-${timestamp.replace(/\D/g, '').slice(0, 17)}`
}

export function initializeApprovedRoleBrief(role: RoleWorkspace, now: Date | string = role.createdAt): RoleWorkspace {
  if (role.roleBriefVersions?.length) return role
  const timestamp = iso(now)
  const version: RoleBriefVersion = {
    id: `${role.id}-brief-1`,
    version: 1,
    status: 'approved',
    intake: role.intake,
    interpretations: roleBriefInterpretations(role.intake),
    changeSummary: ['Initial recruiter-approved Role Brief.'],
    createdAt: timestamp,
    approvedAt: timestamp,
  }
  return { ...role, roleBriefVersions: [version], activeRoleBriefVersionId: version.id }
}

/**
 * Stages an editable Role Brief revision without changing the approved intake or
 * executable Search Plan. This is the blocking human approval boundary.
 */
export function stageRoleBriefRevision(role: RoleWorkspace, intake: RoleIntake, now: Date | string = new Date()): RoleWorkspace {
  const timestamp = iso(now)
  const initialized = initializeApprovedRoleBrief(role)
  const versions = roleBriefVersions(initialized)
  const approved = [...versions].reverse().find(version => version.status === 'approved') || activeRoleBriefVersion(initialized)
  const changes = changedFields(approved.intake, intake)
  if (!changes.length) return initialized
  const nextVersion = Math.max(...versions.map(version => version.version), 0) + 1
  const draft: RoleBriefVersion = {
    id: `${role.id}-brief-${nextVersion}-${timestamp.replace(/\D/g, '').slice(0, 14)}`,
    version: nextVersion,
    status: 'draft',
    intake,
    interpretations: roleBriefInterpretations(intake),
    changeSummary: changes.map(field => `Changed ${field}.`),
    createdAt: timestamp,
  }
  return {
    ...initialized,
    roleBriefVersions: [...versions.filter(version => version.status !== 'draft'), draft],
    activeRoleBriefVersionId: draft.id,
    activity: [{
      id: eventId(role.id, 'brief-draft', timestamp),
      type: 'brief_version_created',
      message: `Created Role Brief v${nextVersion} as a draft. The approved intake and Search Plan have not changed.`,
      createdAt: timestamp,
    }, ...initialized.activity],
    updatedAt: timestamp,
  }
}

/**
 * Applies the staged brief only after explicit recruiter approval. Search lanes
 * are regenerated as proposed so a new brief cannot silently authorize spend.
 */
export function approveStagedRoleBrief(role: RoleWorkspace, now: Date | string = new Date()): RoleWorkspace {
  const timestamp = iso(now)
  const initialized = initializeApprovedRoleBrief(role)
  const versions = roleBriefVersions(initialized)
  const active = activeRoleBriefVersion(initialized)
  if (active.status !== 'draft') return initialized
  const updated = versions.map(version => {
    if (version.id === active.id) return { ...version, status: 'approved' as const, approvedAt: timestamp }
    if (version.status === 'approved') return { ...version, status: 'superseded' as const }
    return version
  })
  const searchLanes = buildSearchLanes(active.intake).map(lane => ({ ...lane, status: 'proposed' as const }))
  return {
    ...initialized,
    intake: active.intake,
    searchLanes,
    roleBriefVersions: updated,
    activeRoleBriefVersionId: active.id,
    status: initialized.status === 'closed' ? initialized.status : 'calibrating',
    activity: [{
      id: eventId(role.id, 'brief-approved', timestamp),
      type: 'brief_approved',
      message: `Approved Role Brief v${active.version}. Search hypotheses were regenerated as proposed and still require explicit recruiter approval.`,
      createdAt: timestamp,
    }, ...initialized.activity],
    updatedAt: timestamp,
  }
}
