import { describe, expect, it } from 'vitest'
import {
  createRoleWorkspaceBackup,
  parseRoleWorkspaceBackup,
  planRoleWorkspaceImport,
  roleWorkspaceChecksum,
} from '@/lib/role-workspace-backup'
import type { RoleWorkspace } from '@/lib/role-workspace'

function role(id: string, title: string, updatedAt: string, candidates = 0): RoleWorkspace {
  return {
    id,
    status: 'active',
    intake: {
      title,
      location: 'Minneapolis, MN',
      workMode: 'hybrid',
      compensation: 'Not specified',
      clearance: 'Not specified',
      mustHaves: ['Program Management'],
      niceToHaves: [],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: `${title} role description`,
    },
    searchLanes: [],
    candidates: Array.from({ length: candidates }, (_, index) => ({
      id: `candidate-${id}-${index}`,
      name: `Candidate ${index + 1}`,
      headline: '',
      company: '',
      location: '',
      source: 'manual research',
      stage: 'needs_review',
      fitDecision: 'unreviewed',
      fitReasons: [],
      concerns: [],
      tags: [],
      contactStatus: 'unknown',
      evidenceStatus: 'unreviewed',
      addedAt: updatedAt,
      updatedAt,
    })),
    activity: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt,
  }
}

describe('role workspace backup', () => {
  it('creates a versioned backup with deterministic checksum and counts', () => {
    const roles = [role('role-a', 'Program Director', '2026-07-20T10:00:00.000Z', 2)]
    const backup = createRoleWorkspaceBackup(roles, new Date('2026-07-20T12:00:00.000Z'))
    expect(backup.format).toBe('sourcingos-role-workspaces')
    expect(backup.version).toBe(1)
    expect(backup.roleCount).toBe(1)
    expect(backup.candidateCount).toBe(2)
    expect(backup.checksum).toBe(roleWorkspaceChecksum(roles))
  })

  it('rejects a backup whose role data no longer matches its checksum', () => {
    const backup = createRoleWorkspaceBackup([role('role-a', 'Program Director', '2026-07-20T10:00:00.000Z')])
    const tampered = JSON.parse(JSON.stringify(backup))
    tampered.roles[0].intake.title = 'Tampered title'
    const parsed = parseRoleWorkspaceBackup(JSON.stringify(tampered))
    expect(parsed.backup).toBeUndefined()
    expect(parsed.errors).toContain('Backup checksum does not match its role data.')
  })

  it('dry-runs an additive restore without changing the current array', () => {
    const current = [role('role-a', 'Current Role', '2026-07-20T10:00:00.000Z')]
    const incoming = createRoleWorkspaceBackup([role('role-b', 'New Role', '2026-07-20T11:00:00.000Z')])
    const plan = planRoleWorkspaceImport(current, JSON.stringify(incoming))
    expect(plan.valid).toBe(true)
    expect(plan.newRoles).toBe(1)
    expect(plan.replacedRoles).toBe(0)
    expect(plan.result).toHaveLength(2)
    expect(current).toHaveLength(1)
  })

  it('replaces an older local copy only when the matching backup role is newer', () => {
    const current = [role('role-a', 'Old Title', '2026-07-20T10:00:00.000Z')]
    const incoming = createRoleWorkspaceBackup([role('role-a', 'New Title', '2026-07-20T11:00:00.000Z')])
    const plan = planRoleWorkspaceImport(current, JSON.stringify(incoming))
    expect(plan.replacedRoles).toBe(1)
    expect(plan.result[0].intake.title).toBe('New Title')
  })

  it('keeps a newer local copy when the matching backup role is older', () => {
    const current = [role('role-a', 'Newer Local', '2026-07-20T12:00:00.000Z')]
    const incoming = createRoleWorkspaceBackup([role('role-a', 'Older Backup', '2026-07-20T11:00:00.000Z')])
    const plan = planRoleWorkspaceImport(current, JSON.stringify(incoming))
    expect(plan.replacedRoles).toBe(0)
    expect(plan.unchangedRoles).toBe(1)
    expect(plan.result[0].intake.title).toBe('Newer Local')
  })

  it('rejects duplicate role ids inside one backup', () => {
    const roles = [
      role('role-a', 'First', '2026-07-20T10:00:00.000Z'),
      role('role-a', 'Second', '2026-07-20T11:00:00.000Z'),
    ]
    const backup = createRoleWorkspaceBackup(roles)
    const parsed = parseRoleWorkspaceBackup(JSON.stringify(backup))
    expect(parsed.backup).toBeUndefined()
    expect(parsed.errors).toContain('Backup contains duplicate role ids.')
  })
})
