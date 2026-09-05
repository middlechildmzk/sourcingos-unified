import { describe, expect, it } from 'vitest'
import { normalizeRoleWorkspace } from '@/lib/role-workspace-storage'

describe('role workspace storage compatibility', () => {
  it('normalizes a legacy role before candidate action controls render it', () => {
    const role = normalizeRoleWorkspace({
      id: 'legacy-role',
      title: 'Senior DevSecOps Engineer',
      candidates: [{ id: 'legacy-candidate', name: 'Jordan Rivera' }],
    })

    expect(role).not.toBeNull()
    expect(role?.intake.title).toBe('Senior DevSecOps Engineer')
    expect(role?.candidates).toHaveLength(1)
    expect(role?.candidates[0]).toMatchObject({
      name: 'Jordan Rivera',
      stage: 'needs_review',
      fitDecision: 'unreviewed',
      contactStatus: 'unknown',
      evidenceStatus: 'unreviewed',
      tags: [],
    })
    expect(role?.activity).toEqual([])
    expect(role?.searchLanes).toEqual([])
  })

  it('drops malformed role records instead of exposing them to the UI', () => {
    expect(normalizeRoleWorkspace(null)).toBeNull()
    expect(normalizeRoleWorkspace({ title: 'Missing ID' })).toBeNull()
  })
})
