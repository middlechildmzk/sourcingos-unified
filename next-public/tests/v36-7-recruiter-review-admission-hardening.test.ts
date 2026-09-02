import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evidenceBearingFirstReviewBatch,
  type ReviewSlateDiscovery,
} from '@/lib/agent-review-slate-v33-3'
import { fuseCandidateIdentityV34 } from '@/lib/candidate-identity-fusion-v34'
import type { RoleIntake } from '@/lib/role-workspace'
import type { SourceResult } from '@/lib/source-types'

const intake: RoleIntake = {
  title: 'RHEL Administrator',
  location: 'Annapolis Junction, MD',
  workMode: 'onsite',
  compensation: 'Not specified',
  clearance: 'Secret or higher',
  mustHaves: ['5+ years Linux experience', 'RHEL'],
  niceToHaves: ['Ansible', 'SELinux'],
  disqualifiers: [],
  targetCompanies: [],
  adjacentBackgrounds: [],
  hiringManagerNotes: '',
  rawDescription: 'find me a RHEL administrator with 5+ years of linux experience local to Annapolis Junction, MD or greater Washington DC with a secret clearance or higher',
}

function sourceResult(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:test-user',
    source: 'github',
    sourceProfileId: 'test-user',
    entityKind: 'person',
    displayName: 'Test User',
    headline: 'Linux Systems Administrator',
    location: 'Arlington, VA',
    organization: 'Example Co',
    profileUrl: 'https://github.com/test-user',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    skills: ['RHEL', 'Linux', 'Ansible'],
    evidence: [{
      id: 'ev-1', label: 'Linux evidence', detail: 'RHEL Linux administration', source: 'github', confidence: 'high',
      url: 'https://github.com/test-user', observedAt: '2026-09-02T00:00:00.000Z',
    }],
    contactSignals: [{
      type: 'website', value: 'https://example.com', source: 'github', verified: false,
      note: 'Observed on public profile.',
    }],
    identitySignals: [{ type: 'source_url', value: 'https://github.com/test-user', weight: 1, source: 'github' }],
    refreshedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  }
}

function discovery(overrides: Partial<ReviewSlateDiscovery> = {}): ReviewSlateDiscovery {
  const result = overrides.sourceResult || sourceResult()
  return {
    sourceKey: 'github',
    sourceId: result.sourceProfileId,
    sourceUrl: result.profileUrl,
    displayName: result.displayName,
    headline: result.headline,
    organization: result.organization,
    location: result.location,
    evidence: [{ kind: 'profile', label: 'Observed capability', value: result.skills.join(' ') }],
    identityConfidence: 0.9,
    profileQuality: 0.85,
    saveEligible: true,
    sourceResult: result,
    ...overrides,
  }
}

const approvedLocations = ['Annapolis Junction, MD', 'Washington, DC']

describe('V36.7 three-state first-review admission', () => {
  it('surfaces a DC-area RHEL person with unverified tenure/Secret as Promising — Verify', () => {
    const candidate = discovery()
    const result = evidenceBearingFirstReviewBatch([candidate], intake, 12, { approvedLocations })
    expect(result.batch).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({
      admitted: true,
      reviewState: 'promising_verify',
      locationState: 'compatible',
    })
    expect(result.checks[0].unverifiedRequirements).toContain('5+ years Linux experience')
    expect(result.checks[0].unverifiedRequirements).toContain('Clearance: Secret or higher')
    expect(result.checks[0].explanation).toContain('Promising — verify')
  })

  it('does not withhold a role-relevant person merely because location is not observed', () => {
    const candidate = discovery({ location: undefined, sourceResult: sourceResult({ location: undefined }) })
    const result = evidenceBearingFirstReviewBatch([candidate], intake, 12, { approvedLocations })
    expect(result.checks[0].reviewState).toBe('promising_verify')
    expect(result.checks[0].locationState).toBe('unknown')
    expect(result.checks[0].admitted).toBe(true)
    expect(result.checks[0].unverifiedRequirements).toContain('Candidate location')
  })

  it('uses the complete approved geography instead of only the canonical role anchor', () => {
    const arlington = discovery({ location: 'Arlington, VA', sourceResult: sourceResult({ location: 'Arlington, VA' }) })
    const result = evidenceBearingFirstReviewBatch([arlington], intake, 12, { approvedLocations })
    expect(result.checks[0].locationState).toBe('compatible')
    expect(result.checks[0].admitted).toBe(true)
  })

  it('holds a clearly outside-market person but never labels that as recruiter rejection', () => {
    const seattle = discovery({ location: 'Seattle, WA', sourceResult: sourceResult({ location: 'Seattle, WA' }) })
    const result = evidenceBearingFirstReviewBatch([seattle], intake, 12, { approvedLocations })
    expect(result.batch).toHaveLength(0)
    expect(result.checks[0].reviewState).toBe('held')
    expect(result.checks[0].holdReasons).toContain('observed location outside approved search geography')
    expect(result.checks[0].explanation).toContain('not rejected')
  })

  it('holds non-role-relevant public records while keeping them inspectable', () => {
    const unrelated = discovery({
      headline: 'Frontend Designer',
      evidence: [{ kind: 'profile', label: 'Observed capability', value: 'Figma design systems' }],
      sourceResult: sourceResult({ headline: 'Frontend Designer', skills: ['Figma'], evidence: [] }),
    })
    const result = evidenceBearingFirstReviewBatch([unrelated], intake, 12, { approvedLocations })
    expect(result.checks[0].reviewState).toBe('held')
    expect(result.checks[0].holdReasons).toContain('insufficient role-relevant public evidence')
  })

  it('reports a recruiter-visible funnel instead of only a binary batch count', () => {
    const ready = discovery({ sourceId: 'ready', location: 'Columbia, MD', sourceResult: sourceResult({ sourceProfileId: 'ready', location: 'Columbia, MD' }) })
    const unknownLocation = discovery({ sourceId: 'verify', location: undefined, sourceResult: sourceResult({ sourceProfileId: 'verify', location: undefined }) })
    const held = discovery({ sourceId: 'held', location: 'Seattle, WA', sourceResult: sourceResult({ sourceProfileId: 'held', location: 'Seattle, WA' }) })
    const result = evidenceBearingFirstReviewBatch([ready, unknownLocation, held], intake, 12, { approvedLocations })
    expect(result.summary.discoveredPeople).toBe(3)
    expect(result.summary.promisingVerify).toBeGreaterThanOrEqual(2)
    expect(result.summary.held).toBe(1)
    expect(result.summary.admitted).toBe(2)
  })
})

describe('V36.7 recruiter-facing UI contracts', () => {
  const entityUi = readFileSync(join(process.cwd(), 'components/RoleEntityIntelligenceV35.tsx'), 'utf8')
  const sourcingUi = readFileSync(join(process.cwd(), 'components/RoleSourcingAgentV33_3.tsx'), 'utf8')

  it('makes related/adjacent activation persistent and visible', () => {
    expect(entityUi).toContain('Active Search Expansion')
    expect(entityUi).toContain('added to Active Search Expansion')
    expect(entityUi).toContain('click to remove')
    expect(entityUi).toContain('setApprovedSearchEntityV35')
  })

  it('passes full approved geography into admission and shows the funnel', () => {
    expect(sourcingUi).toContain('approvedExecutionLocationsV35')
    expect(sourcingUi).toContain('{ approvedLocations')
    expect(sourcingUi).toContain('Review Ready')
    expect(sourcingUi).toContain('Promising · Verify')
    expect(sourcingUi).toContain('Held · inspectable')
    expect(sourcingUi).toContain('heldByReason')
  })

  it('renders recruiter-grade source cards with location, avatars, profile and contact states', () => {
    expect(sourcingUi).toContain('avatarUrl')
    expect(sourcingUi).toContain('Location not observed')
    expect(sourcingUi).toContain('Contact not observed')
    expect(sourcingUi).toContain('Open {sourceLabel(discovery.sourceKey)} profile')
    expect(sourcingUi).toContain("contact.type === 'public_email'")
  })
})

describe('V36.7 Candidate 360 identity presentation', () => {
  it('preserves a source-provided avatar as presentation metadata without making it identity authority', () => {
    const snapshot = {
      candidates: [],
      sourceProfiles: [{
        id: 'sp-1', candidateId: 'cand-1', source: 'github', sourceProfileId: 'test-user', profileUrl: 'https://github.com/test-user',
        displayName: 'Test User', headline: 'Linux Systems Administrator', location: 'Arlington, VA', organization: 'Example Co',
        raw: { avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' }, status: 'confirmed', matchScore: 1, matchReasons: [],
        lastSeenAt: '2026-09-02T00:00:00.000Z', createdAt: '2026-09-02T00:00:00.000Z',
      }],
      evidenceItems: [],
      contactSignals: [{
        id: 'contact-1', candidateId: 'cand-1', sourceProfileId: 'sp-1', type: 'public_email', value: 'test@example.com', source: 'github',
        confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: '2026-09-02T00:00:00.000Z',
      }],
      openToWorkSignals: [], matchReviews: [], importBatches: [],
    }
    const identity = fuseCandidateIdentityV34(snapshot as any, 'cand-1')
    expect(identity.profiles[0].avatarUrl).toBe('https://avatars.githubusercontent.com/u/1?v=4')
    expect(identity.contacts[0].value).toBe('test@example.com')
  })
})
