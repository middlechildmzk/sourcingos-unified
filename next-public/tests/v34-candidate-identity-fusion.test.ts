import { describe, expect, it } from 'vitest'
import { fuseCandidateIdentityV34 } from '@/lib/candidate-identity-fusion-v34'
import type { CandidateDbSnapshot } from '@/lib/candidate-db-v18'

const now = '2026-09-01T20:00:00.000Z'

function emptySnapshot(): CandidateDbSnapshot {
  return {
    candidates: [],
    sourceProfiles: [],
    evidenceItems: [],
    contactSignals: [],
    openToWorkSignals: [],
    matchReviews: [],
    importBatches: [],
  }
}

describe('V34 Candidate 360 identity fusion', () => {
  it('renders every source profile already linked to the same canonical candidate without performing a new merge', () => {
    const snapshot = emptySnapshot()
    snapshot.sourceProfiles.push(
      {
        id: 'sp-github', candidateId: 'c1', source: 'github', sourceProfileId: 'alice-gh',
        profileUrl: 'https://github.com/alice-gh', displayName: 'Alice Example', headline: 'Linux engineer',
        location: 'Fort Meade, MD', organization: 'Example Systems', status: 'confirmed', matchScore: 0,
        matchReasons: [], lastSeenAt: now, createdAt: now,
      },
      {
        id: 'sp-stack', candidateId: 'c1', source: 'stackoverflow', sourceProfileId: '12345',
        profileUrl: 'https://unix.stackexchange.com/users/12345/alice', displayName: 'Alice Example', headline: 'RHEL answerer',
        location: 'Maryland', status: 'confirmed', matchScore: 0, matchReasons: [], lastSeenAt: now, createdAt: now,
      },
    )

    const fusion = fuseCandidateIdentityV34(snapshot, 'c1')

    expect(fusion.fusedProfileCount).toBe(2)
    expect(fusion.profiles.map(profile => profile.source)).toEqual(expect.arrayContaining(['github', 'stackoverflow']))
    expect(fusion.sources).toEqual(expect.arrayContaining(['github', 'stackoverflow']))
  })

  it('normalizes persisted PDL email and social URL signals into Candidate 360 display types', () => {
    const snapshot = emptySnapshot()
    snapshot.sourceProfiles.push({
      id: 'sp-github', candidateId: 'c1', source: 'github', sourceProfileId: 'alice-gh',
      profileUrl: 'https://github.com/alice-gh', displayName: 'Alice Example', status: 'confirmed', matchScore: 0,
      matchReasons: [], lastSeenAt: now, createdAt: now,
    })
    snapshot.contactSignals.push(
      {
        id: 'contact-email', candidateId: 'c1', sourceProfileId: 'sp-github', type: 'email',
        value: 'Alice@Example.com', source: 'manual', confidence: 'medium', verified: false,
        permissionStatus: 'unknown', createdAt: now,
      },
      {
        id: 'contact-linkedin', candidateId: 'c1', sourceProfileId: 'sp-github', type: 'other',
        value: 'https://www.linkedin.com/in/alice-example/', source: 'manual', confidence: 'medium', verified: false,
        permissionStatus: 'unknown', createdAt: now,
      },
    )
    // Supabase contact rows can contain enrichment-provider source/type values
    // beyond the older in-memory preview union; mirror that persisted shape here.
    ;(snapshot.contactSignals as any[]).push(
      { id: 'pdl-email', candidateId: 'c1', sourceProfileId: 'sp-github', type: 'email', value: 'alice@example.com', source: 'people_data_labs', confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now },
      { id: 'pdl-linkedin', candidateId: 'c1', sourceProfileId: 'sp-github', type: 'social_url', value: 'https://www.linkedin.com/in/alice-example/', source: 'people_data_labs', confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now },
    )

    const fusion = fuseCandidateIdentityV34(snapshot, 'c1')

    expect(fusion.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'public_email', value: 'alice@example.com' }),
      expect.objectContaining({ type: 'profile_url', value: 'https://www.linkedin.com/in/alice-example/' }),
    ]))
  })

  it('can surface candidate-level enrichment even when a provider response lacks a sourceProfileId', () => {
    const snapshot = emptySnapshot()
    ;(snapshot.contactSignals as any[]).push({
      id: 'pdl-email', candidateId: 'c1', type: 'email', value: 'alice@example.com', source: 'people_data_labs',
      confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now,
    })

    const fusion = fuseCandidateIdentityV34(snapshot, 'c1')

    expect(fusion.contacts).toHaveLength(1)
    expect(fusion.contacts[0]).toMatchObject({ type: 'public_email', source: 'people_data_labs' })
  })

  it('does not surface arbitrary candidate-level manual contact rows as enrichment/public provenance', () => {
    const snapshot = emptySnapshot()
    snapshot.contactSignals.push({
      id: 'manual-email', candidateId: 'c1', type: 'email', value: 'private@example.com', source: 'manual',
      confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now,
    })

    expect(fuseCandidateIdentityV34(snapshot, 'c1').contacts).toEqual([])
  })

  it('excludes do-not-contact signals from the actionable Candidate 360 identity view', () => {
    const snapshot = emptySnapshot()
    ;(snapshot.contactSignals as any[]).push({
      id: 'blocked', candidateId: 'c1', type: 'email', value: 'blocked@example.com', source: 'people_data_labs',
      confidence: 'medium', verified: false, permissionStatus: 'do_not_contact', createdAt: now,
    })

    expect(fuseCandidateIdentityV34(snapshot, 'c1').contacts).toEqual([])
  })

  it('deduplicates the same contact value across source-linked and enrichment rows', () => {
    const snapshot = emptySnapshot()
    snapshot.sourceProfiles.push({
      id: 'sp-github', candidateId: 'c1', source: 'github', sourceProfileId: 'alice-gh',
      profileUrl: 'https://github.com/alice-gh', displayName: 'Alice Example', status: 'confirmed', matchScore: 0,
      matchReasons: [], lastSeenAt: now, createdAt: now,
    })
    ;(snapshot.contactSignals as any[]).push(
      { id: 'source-email', candidateId: 'c1', sourceProfileId: 'sp-github', type: 'public_email', value: 'alice@example.com', source: 'github', confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now },
      { id: 'pdl-email', candidateId: 'c1', type: 'email', value: 'ALICE@example.com', source: 'people_data_labs', confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: now },
    )

    expect(fuseCandidateIdentityV34(snapshot, 'c1').contacts).toHaveLength(1)
  })
})
