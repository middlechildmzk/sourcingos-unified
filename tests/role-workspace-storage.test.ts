import { describe, expect, it } from 'vitest'
import { mergeRoleWorkspaces, roleCandidateIdentityKey } from '@/lib/role-workspace-storage'
import type { RoleWorkspace } from '@/lib/role-workspace'

function workspace(overrides: Partial<RoleWorkspace> = {}): RoleWorkspace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'active',
    intake: {
      title: 'Cloud Engineer', location: 'Remote', workMode: 'remote', compensation: '', clearance: '',
      mustHaves: ['AWS'], niceToHaves: [], disqualifiers: [], targetCompanies: [], adjacentBackgrounds: [],
      hiringManagerNotes: '', rawDescription: 'Cloud Engineer',
    },
    searchLanes: [],
    candidates: [],
    activity: [],
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('role candidate handoff identity', () => {
  it('prefers a normalized source URL for duplicate protection', () => {
    expect(roleCandidateIdentityKey({
      name: 'Jordan Rivera',
      company: 'Acme',
      source: 'github',
      sourceUrl: ' HTTPS://GITHUB.COM/JRIVERA ',
    })).toBe('url:https://github.com/jrivera')
  })

  it('uses a canonical candidate id when no source URL exists', () => {
    expect(roleCandidateIdentityKey({
      candidateId: '11111111-1111-4111-8111-111111111111',
      name: 'Jordan Rivera',
      source: 'candidate_database',
    })).toBe('candidate:11111111-1111-4111-8111-111111111111')
  })

  it('falls back to normalized name, company, and source without claiming a merge', () => {
    expect(roleCandidateIdentityKey({
      name: ' Jordan Rivera ',
      company: ' Acme AI ',
      source: ' Network Import ',
    })).toBe('profile:jordan rivera|acme ai|network import')
  })
})

describe('durable role hydration merge', () => {
  it('keeps the newer workspace fields while preserving unique candidates from both copies', () => {
    const local = workspace({
      updatedAt: '2026-07-20T12:00:00.000Z',
      intake: { ...workspace().intake, title: 'Senior Cloud Engineer' },
      candidates: [{
        id: 'local-candidate', name: 'Alex Local', headline: '', company: 'Local Co', location: '', source: 'network',
        stage: 'needs_review', fitDecision: 'unreviewed', fitReasons: [], concerns: [], tags: [],
        contactStatus: 'unknown', evidenceStatus: 'unreviewed', addedAt: '2026-07-20T11:00:00.000Z', updatedAt: '2026-07-20T11:00:00.000Z',
      }],
    })
    const remote = workspace({
      updatedAt: '2026-07-20T11:30:00.000Z',
      candidates: [{
        id: 'remote-candidate', name: 'Riley Remote', headline: '', company: 'Remote Co', location: '', source: 'candidate_database',
        stage: 'shortlisted', fitDecision: 'strong_fit', fitReasons: ['AWS'], concerns: [], tags: ['AWS'],
        contactStatus: 'signals_found', evidenceStatus: 'reviewed', addedAt: '2026-07-20T10:30:00.000Z', updatedAt: '2026-07-20T11:30:00.000Z',
      }],
    })

    const [merged] = mergeRoleWorkspaces([local], [remote])
    expect(merged.intake.title).toBe('Senior Cloud Engineer')
    expect(merged.candidates.map(candidate => candidate.name).sort()).toEqual(['Alex Local', 'Riley Remote'])
  })

  it('deduplicates the same candidate and keeps the newest candidate state', () => {
    const older = {
      id: 'older', candidateId: '22222222-2222-4222-8222-222222222222', name: 'Jordan Rivera', headline: '', company: 'Acme', location: '', source: 'candidate_database',
      stage: 'needs_review' as const, fitDecision: 'unreviewed' as const, fitReasons: [], concerns: [], tags: [], contactStatus: 'unknown' as const,
      evidenceStatus: 'unreviewed' as const, addedAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z',
    }
    const newer = { ...older, id: 'newer', stage: 'shortlisted' as const, fitDecision: 'strong_fit' as const, updatedAt: '2026-07-20T12:00:00.000Z' }
    const [merged] = mergeRoleWorkspaces([workspace({ candidates: [newer] })], [workspace({ candidates: [older] })])
    expect(merged.candidates).toHaveLength(1)
    expect(merged.candidates[0].stage).toBe('shortlisted')
  })
})
