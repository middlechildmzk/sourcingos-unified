import type { RoleWorkspace } from './role-workspace'

export const ROLE_BACKUP_FORMAT = 'sourcingos-role-workspaces'
export const ROLE_BACKUP_VERSION = 1

export type RoleWorkspaceBackup = {
  format: typeof ROLE_BACKUP_FORMAT
  version: typeof ROLE_BACKUP_VERSION
  exportedAt: string
  roleCount: number
  candidateCount: number
  checksum: string
  roles: RoleWorkspace[]
}

export type RoleImportPlan = {
  valid: boolean
  errors: string[]
  warnings: string[]
  incomingCount: number
  currentCount: number
  newRoles: number
  replacedRoles: number
  unchangedRoles: number
  candidateCount: number
  result: RoleWorkspace[]
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function checksumText(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function roleWorkspaceChecksum(roles: RoleWorkspace[]): string {
  return checksumText(stableJson(roles))
}

export function createRoleWorkspaceBackup(roles: RoleWorkspace[], now = new Date()): RoleWorkspaceBackup {
  return {
    format: ROLE_BACKUP_FORMAT,
    version: ROLE_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    roleCount: roles.length,
    candidateCount: roles.reduce((sum, role) => sum + role.candidates.length, 0),
    checksum: roleWorkspaceChecksum(roles),
    roles,
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  return Number.isFinite(new Date(value).getTime())
}

function validateRole(value: unknown, index: number): string[] {
  if (!value || typeof value !== 'object') return [`Role ${index + 1} is not an object.`]
  const role = value as Partial<RoleWorkspace>
  const errors: string[] = []
  if (typeof role.id !== 'string' || !role.id.trim()) errors.push(`Role ${index + 1} is missing an id.`)
  if (!role.intake || typeof role.intake !== 'object' || typeof role.intake.title !== 'string' || !role.intake.title.trim()) errors.push(`Role ${index + 1} is missing an intake title.`)
  if (!Array.isArray(role.searchLanes)) errors.push(`Role ${index + 1} search lanes are invalid.`)
  if (!Array.isArray(role.candidates)) errors.push(`Role ${index + 1} candidates are invalid.`)
  if (!Array.isArray(role.activity)) errors.push(`Role ${index + 1} activity is invalid.`)
  if (!isIsoDate(role.createdAt)) errors.push(`Role ${index + 1} createdAt is invalid.`)
  if (!isIsoDate(role.updatedAt)) errors.push(`Role ${index + 1} updatedAt is invalid.`)
  return errors
}

export function parseRoleWorkspaceBackup(text: string): { backup?: RoleWorkspaceBackup; errors: string[]; warnings: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { errors: ['Backup is not valid JSON.'], warnings: [] }
  }

  if (!parsed || typeof parsed !== 'object') return { errors: ['Backup root must be an object.'], warnings: [] }
  const backup = parsed as Partial<RoleWorkspaceBackup>
  const errors: string[] = []
  const warnings: string[] = []

  if (backup.format !== ROLE_BACKUP_FORMAT) errors.push('Backup format is not recognized as a SourcingOS role workspace export.')
  if (backup.version !== ROLE_BACKUP_VERSION) errors.push(`Backup version ${String(backup.version)} is not supported.`)
  if (!Array.isArray(backup.roles)) errors.push('Backup roles must be an array.')
  if (!isIsoDate(backup.exportedAt)) warnings.push('Export timestamp is missing or invalid.')

  const roles = Array.isArray(backup.roles) ? backup.roles : []
  roles.forEach((role, index) => errors.push(...validateRole(role, index)))

  const ids = roles.map(role => role.id)
  if (new Set(ids).size !== ids.length) errors.push('Backup contains duplicate role ids.')

  const calculated = roleWorkspaceChecksum(roles)
  if (backup.checksum && backup.checksum !== calculated) errors.push('Backup checksum does not match its role data.')
  if (!backup.checksum) warnings.push('Backup has no checksum. It can be reviewed, but integrity is not confirmed.')
  if (backup.roleCount !== undefined && backup.roleCount !== roles.length) warnings.push('Recorded role count does not match the backup contents.')

  if (errors.length) return { errors, warnings }

  return {
    backup: {
      format: ROLE_BACKUP_FORMAT,
      version: ROLE_BACKUP_VERSION,
      exportedAt: backup.exportedAt || new Date(0).toISOString(),
      roleCount: roles.length,
      candidateCount: roles.reduce((sum, role) => sum + role.candidates.length, 0),
      checksum: calculated,
      roles,
    },
    errors,
    warnings,
  }
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function planRoleWorkspaceImport(current: RoleWorkspace[], text: string): RoleImportPlan {
  const parsed = parseRoleWorkspaceBackup(text)
  if (!parsed.backup) {
    return {
      valid: false,
      errors: parsed.errors,
      warnings: parsed.warnings,
      incomingCount: 0,
      currentCount: current.length,
      newRoles: 0,
      replacedRoles: 0,
      unchangedRoles: 0,
      candidateCount: 0,
      result: current,
    }
  }

  const currentById = new Map(current.map(role => [role.id, role]))
  let newRoles = 0
  let replacedRoles = 0
  let unchangedRoles = 0
  const result = [...current]

  for (const incoming of parsed.backup.roles) {
    const existing = currentById.get(incoming.id)
    if (!existing) {
      result.push(incoming)
      newRoles += 1
      continue
    }
    const existingChecksum = roleWorkspaceChecksum([existing])
    const incomingChecksum = roleWorkspaceChecksum([incoming])
    if (existingChecksum === incomingChecksum) {
      unchangedRoles += 1
      continue
    }
    if (timestamp(incoming.updatedAt) > timestamp(existing.updatedAt)) {
      const index = result.findIndex(role => role.id === incoming.id)
      result[index] = incoming
      replacedRoles += 1
    } else {
      unchangedRoles += 1
    }
  }

  result.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))

  return {
    valid: true,
    errors: [],
    warnings: [
      ...parsed.warnings,
      ...(parsed.backup.roles.some(role => currentById.has(role.id)) ? ['Existing role ids are never duplicated. A newer incoming role replaces an older local copy; otherwise the local copy is kept.'] : []),
    ],
    incomingCount: parsed.backup.roles.length,
    currentCount: current.length,
    newRoles,
    replacedRoles,
    unchangedRoles,
    candidateCount: parsed.backup.candidateCount,
    result,
  }
}
