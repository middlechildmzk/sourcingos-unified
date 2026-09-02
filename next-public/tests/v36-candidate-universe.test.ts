import { describe, expect, it } from 'vitest'
import {
  buildCandidateRoleHistoryV36,
  buildCandidateUniverseProjectionV36,
  buildEmploymentObservationsV36,
} from '../lib/candidate-universe-v36'

describe('V36 Candidate Universe employment truth', () => {
  it('treats an undated profile organization as an observation with unknown currentness', () => {
    const observations = buildEmploymentObservationsV36('cand-1', [{
      id: 'sp-1',
      candidate_id: 'cand-1',
      source: 'uploaded_resume',
      organization: 'Acme Corp',
      headline: 'Senior Engineer',
      created_at: '2026-09-01T00:00:00Z',
    }])

    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      companyName: 'Acme Corp',
      title: 'Senior Engineer',
      evidenceClass: 'profile_statement',
      currentState: 'unknown',
    })
  })

  it('keeps GitHub profile company separate from GitHub organization participation', () => {
    const observations = buildEmploymentObservationsV36('cand-1', [{
      id: 'sp-github',
      candidate_id: 'cand-1',
      source: 'github',
      organization: 'Self Reported Employer',
      raw: {
        organizations: [
          { login: 'open-source-foundation', name: 'Open Source Foundation', url: 'https://github.com/open-source-foundation' },
        ],
      },
      created_at: '2026-09-01T00:00:00Z',
    }])

    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        companyName: 'Self Reported Employer',
        evidenceClass: 'profile_statement',
        currentState: 'unknown',
      }),
      expect.objectContaining({
        companyName: 'Open Source Foundation',
        evidenceClass: 'github_org_participation',
        currentState: 'unknown',
      }),
    ]))
    expect(observations.find(item => item.evidenceClass === 'github_org_participation')?.explanation)
      .toContain('does not establish employment')
  })

  it('never turns GitHub organization participation into a current employer', () => {
    const observations = buildEmploymentObservationsV36('cand-1', [{
      id: 'sp-github',
      source: 'github',
      raw: { organizations: [{ login: 'acme' }] },
    }])

    expect(observations).toHaveLength(1)
    expect(observations[0].evidenceClass).toBe('github_org_participation')
    expect(observations[0].currentState).toBe('unknown')
  })

  it('preserves multiple concurrent-looking organization observations instead of auto-conflicting them', () => {
    const observations = buildEmploymentObservationsV36('cand-1', [
      { id: 'sp-1', source: 'uploaded_resume', organization: 'Consulting LLC' },
      { id: 'sp-2', source: 'public_profile', organization: 'Acme Corp' },
    ])

    expect(observations.map(item => item.companyName).sort()).toEqual(['Acme Corp', 'Consulting LLC'])
    expect(observations.every(item => item.currentState === 'unknown')).toBe(true)
  })
})

describe('V36 Candidate Universe cross-role reuse', () => {
  const roles = [
    {
      candidate_id: 'cand-1',
      role_id: 'role-a',
      stage: 'reviewed',
      fit_decision: 'no',
      fit_reasons: ['wrong seniority'],
      concerns: ['Too junior for this role'],
      added_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-02T00:00:00Z',
    },
  ]

  it('keeps a Role A rejection as contextual history only', () => {
    const history = buildCandidateRoleHistoryV36(roles)
    expect(history).toEqual([expect.objectContaining({
      roleId: 'role-a',
      fitDecision: 'no',
      fitReasons: ['wrong seniority'],
    })])
  })

  it('marks a known candidate as rediscovered for a different active role', () => {
    const projection = buildCandidateUniverseProjectionV36({
      candidateId: 'cand-1',
      profiles: [{ id: 'sp-1', candidate_id: 'cand-1', source: 'github' }],
      evidenceItems: [{ candidate_id: 'cand-1' }],
      roleCandidates: roles,
      activeRoleId: 'role-b',
    })

    expect(projection.rediscoveryState).toBe('rediscovered_from_other_role')
    expect(projection.roleCount).toBe(1)
    expect(projection.roleHistory[0].fitDecision).toBe('no')
    expect(projection).not.toHaveProperty('globalFitDecision')
    expect(projection.trustBoundary).toContain('never become a global candidate verdict')
  })

  it('marks a candidate already attached to the active role without duplicating identity', () => {
    const projection = buildCandidateUniverseProjectionV36({
      candidateId: 'cand-1',
      profiles: [{ id: 'sp-1', candidate_id: 'cand-1', source: 'github' }],
      evidenceItems: [],
      roleCandidates: roles,
      activeRoleId: 'role-a',
    })

    expect(projection.candidateId).toBe('cand-1')
    expect(projection.rediscoveryState).toBe('already_in_role')
    expect(projection.sourceProfileCount).toBe(1)
  })

  it('reports source and evidence coverage without using it as a fit score', () => {
    const projection = buildCandidateUniverseProjectionV36({
      candidateId: 'cand-1',
      profiles: [
        { id: 'sp-1', source: 'github' },
        { id: 'sp-2', source: 'stackoverflow' },
      ],
      evidenceItems: [{}, {}, {}],
      roleCandidates: [],
    })

    expect(projection.sourceProfileCount).toBe(2)
    expect(projection.evidenceItemCount).toBe(3)
    expect(projection.roleCount).toBe(0)
    expect(projection).not.toHaveProperty('score')
  })

  it('does not create clearance or skills from employer observations', () => {
    const projection = buildCandidateUniverseProjectionV36({
      candidateId: 'cand-defense',
      profiles: [{ id: 'sp-1', source: 'public_profile', organization: 'Defense Prime' }],
      evidenceItems: [],
      roleCandidates: [],
    })

    expect(projection.employmentObservations[0].companyName).toBe('Defense Prime')
    expect(JSON.stringify(projection)).not.toMatch(/clearance|has_skill|skills/i)
  })

  it('deduplicates repeated role history rows by role while preserving reasons', () => {
    const history = buildCandidateRoleHistoryV36([
      ...roles,
      {
        ...roles[0],
        fit_reasons: ['wrong location'],
        updated_at: '2026-03-03T00:00:00Z',
      },
    ])

    expect(history).toHaveLength(1)
    expect(history[0].fitReasons.sort()).toEqual(['wrong location', 'wrong seniority'])
    expect(history[0].lastSeenAt).toBe('2026-03-03T00:00:00Z')
  })
})
