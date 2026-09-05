import { describe, expect, it } from 'vitest'
import {
  clearSearchIntelligenceActivityEventV35,
  deriveRoleSearchIntelligenceFromActivityV35,
  searchIntelligenceActivityEventV35,
} from '@/lib/entity-intelligence/search-approval-events-v35'
import { reconcileRoleWorkspaceCalibration } from '@/lib/role-calibration-reconciliation'
import type { RoleWorkspace } from '@/lib/role-workspace'

function workspace(activity: RoleWorkspace['activity']): RoleWorkspace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'calibrating',
    intake: {
      title: 'RHEL administrator',
      location: 'Annapolis Junction, MD',
      workMode: 'onsite',
      compensation: 'Not specified',
      clearance: 'Secret or higher',
      mustHaves: ['RHEL', '5+ years relevant experience'],
      niceToHaves: [],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: 'RHEL administrator near Annapolis Junction, MD with Secret or higher',
    },
    searchLanes: [],
    candidates: [],
    activity,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  }
}

describe('V35.3 recruiter-approved search intelligence durability', () => {
  it('replays approvals and removals even when persisted activity arrives newest-first', () => {
    const approveAnsible = searchIntelligenceActivityEventV35('entity:technology:ansible', 'Ansible', true, new Date('2026-09-02T00:01:00Z'))
    const approveFortMeade = searchIntelligenceActivityEventV35('loc:installation:fort-meade-md', 'Fort Meade, MD', true, new Date('2026-09-02T00:02:00Z'))
    const removeAnsible = searchIntelligenceActivityEventV35('entity:technology:ansible', 'Ansible', false, new Date('2026-09-02T00:03:00Z'))

    const state = deriveRoleSearchIntelligenceFromActivityV35([removeAnsible, approveFortMeade, approveAnsible])
    expect(state?.approvedEntityIds).not.toContain('entity:technology:ansible')
    expect(state?.approvedLocationExpansionIds).toEqual(['loc:installation:fort-meade-md'])
  })

  it('clear event removes all prior approvals', () => {
    const events = [
      searchIntelligenceActivityEventV35('entity:technology:ansible', 'Ansible', true, new Date('2026-09-02T00:01:00Z')),
      searchIntelligenceActivityEventV35('loc:installation:fort-meade-md', 'Fort Meade, MD', true, new Date('2026-09-02T00:02:00Z')),
      clearSearchIntelligenceActivityEventV35(new Date('2026-09-02T00:03:00Z')),
    ]
    expect(deriveRoleSearchIntelligenceFromActivityV35(events)).toBeUndefined()
  })

  it('workspace reconciliation restores search intelligence without changing recruiter intake truth', () => {
    const original = workspace([
      searchIntelligenceActivityEventV35('entity:credential:rhce', 'RHCE', true, new Date('2026-09-02T00:01:00Z')),
      searchIntelligenceActivityEventV35('loc:installation:fort-meade-md', 'Fort Meade, MD', true, new Date('2026-09-02T00:02:00Z')),
    ])
    const intakeSnapshot = JSON.parse(JSON.stringify(original.intake))
    const hydrated = reconcileRoleWorkspaceCalibration(original, '2026-09-02T00:05:00.000Z')

    expect(hydrated.searchIntelligence?.approvedEntityIds).toContain('entity:credential:rhce')
    expect(hydrated.searchIntelligence?.approvedLocationExpansionIds).toContain('loc:installation:fort-meade-md')
    expect(hydrated.intake).toEqual(intakeSnapshot)
  })
})
