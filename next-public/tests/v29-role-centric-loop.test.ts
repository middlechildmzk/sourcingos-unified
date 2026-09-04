import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addCanonicalCandidateToRole, sourceResultToRoleCandidateInput } from '../lib/role-candidate-link'
import { buildTodayInbox } from '../lib/today-inbox'
import type { RoleWorkspace } from '../lib/role-workspace'
import type { SourceResult } from '../lib/source-types'

const NOW = new Date('2026-07-29T15:00:00.000Z')

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function workspace(): RoleWorkspace {
  return {
    id: 'role-1',
    status: 'active',
    intake: {
      title: 'Platform Engineer',
      location: 'Remote US',
      workMode: 'remote',
      compensation: 'Not specified',
      clearance: 'Not specified',
      mustHaves: ['Kubernetes', 'Terraform'],
      niceToHaves: [],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: '',
    },
    searchLanes: [],
    candidates: [],
    activity: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }
}

function sourceResult(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:ada',
    source: 'github',
    sourceProfileId: 'ada',
    entityKind: 'person',
    displayName: 'Ada Engineer',
    headline: 'Platform Engineer',
    organization: 'Example Cloud',
    location: 'Remote US',
    profileUrl: 'https://github.com/ada',
    skills: ['Kubernetes', 'Terraform', 'Kubernetes'],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: NOW.toISOString(),
    ...overrides,
  }
}

describe('V29 role-centric sourcing loop', () => {
  it('adds one canonical person to the role review queue', () => {
    const input = sourceResultToRoleCandidateInput('candidate-1', sourceResult())
    const linked = addCanonicalCandidateToRole(workspace(), input, NOW)

    expect(linked.added).toBe(true)
    expect(linked.reason).toBe('added')
    expect(linked.workspace.candidates).toHaveLength(1)
    expect(linked.workspace.candidates[0]).toMatchObject({
      id: 'candidate-1',
      candidateId: 'candidate-1',
      name: 'Ada Engineer',
      stage: 'needs_review',
      fitDecision: 'unreviewed',
      evidenceStatus: 'unreviewed',
    })
    expect(linked.workspace.candidates[0].tags).toEqual(['Kubernetes', 'Terraform'])
    expect(linked.workspace.activity).toHaveLength(1)
  })

  it('creates one Today candidate decision for the newly linked role candidate', () => {
    const linked = addCanonicalCandidateToRole(
      workspace(),
      sourceResultToRoleCandidateInput('candidate-1', sourceResult()),
      NOW,
    )
    const inbox = buildTodayInbox([linked.workspace], NOW)
    const decision = inbox.find(item => item.kind === 'candidate_decision')

    expect(decision).toBeDefined()
    expect(decision?.href).toContain('/app/roles/role-1')
    expect(decision?.title).toBe('1 candidate waiting for a fit decision')
    expect(decision?.evidence).toContain('Ada Engineer')
  })

  it('is idempotent across repeated saves and does not duplicate activity', () => {
    const input = sourceResultToRoleCandidateInput('candidate-1', sourceResult())
    const first = addCanonicalCandidateToRole(workspace(), input, NOW)
    const second = addCanonicalCandidateToRole(first.workspace, input, new Date('2026-07-29T16:00:00.000Z'))

    expect(second.added).toBe(false)
    expect(second.reason).toBe('existing')
    expect(second.workspace).toEqual(first.workspace)
    expect(second.workspace.candidates).toHaveLength(1)
    expect(second.workspace.activity).toHaveLength(1)
  })

  it('fails closed for artifacts, organizations, search lanes, and unknown subjects', () => {
    for (const entityKind of ['artifact', 'organization', 'search_lane', 'unknown'] as const) {
      const input = sourceResultToRoleCandidateInput('candidate-1', sourceResult({ entityKind }))
      const linked = addCanonicalCandidateToRole(workspace(), input, NOW)
      expect(linked.added).toBe(false)
      expect(linked.reason).toBe('not_person')
      expect(linked.workspace.candidates).toEqual([])
      expect(linked.workspace.activity).toEqual([])
    }
  })

  it('rejects missing canonical IDs or names without changing the workspace', () => {
    const base = workspace()
    const invalidId = addCanonicalCandidateToRole(base, {
      candidateId: ' ', entityKind: 'person', displayName: 'Ada', source: 'github',
    }, NOW)
    const invalidName = addCanonicalCandidateToRole(base, {
      candidateId: 'candidate-1', entityKind: 'person', displayName: ' ', source: 'github',
    }, NOW)

    expect(invalidId.reason).toBe('invalid')
    expect(invalidName.reason).toBe('invalid')
    expect(invalidId.workspace).toBe(base)
    expect(invalidName.workspace).toBe(base)
  })

  it('redirects legacy Candidate Search into canonical Search while preserving role and lane context', () => {
    const actions = read('components/RoleSearchActions.tsx')
    const page = read('app/app/candidate-search/page.tsx')

    expect(actions).toContain('/app/candidate-search?roleId=')
    expect(actions).toContain('&laneId=')
    expect(page).toContain('const sp = (await searchParams)')
    expect(page).toContain("params.set('roleId', sp.roleId.trim())")
    expect(page).toContain("params.set('laneId', sp.laneId.trim())")
    expect(page).toContain("new URLSearchParams({ from: 'candidate-search' })")
    expect(page).toContain('redirect(`/app/search?${params.toString()}`)')
    expect(page).not.toContain('<RoleScopedCandidateSearch')
  })

  it('dispatches one canonical save event and carries the exact role into Candidate 360', () => {
    const drawer = read('components/CandidateDrawer.tsx')
    const candidatePage = read('app/app/candidate/[id]/page.tsx')
    const candidate360 = read('components/Candidate360Client.tsx')

    expect(drawer).toContain('ROLE_CANDIDATE_SAVED_EVENT')
    expect(drawer).toContain('window.dispatchEvent(new CustomEvent')
    expect(drawer.match(/if \(!canSaveCandidate\)/g)).toHaveLength(1)
    expect(drawer).toContain('?roleId=')
    expect(candidatePage).toContain('const sp = (await searchParams)')
    expect(candidatePage).toContain('sp.roleId')
    expect(candidate360).toContain('Back to role queue')
    expect(candidate360).toContain('?tab=candidates')
  })
})
