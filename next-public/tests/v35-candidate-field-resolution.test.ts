import { describe, expect, it } from 'vitest'
import type { CandidateDbSnapshot } from '@/lib/candidate-db-v18'
import { resolveCandidate360FieldsV35 } from '@/lib/candidate-field-resolution-v35'
import { buildEvidenceLedger } from '@/lib/evidence-ledger'

const NOW = new Date('2026-09-01T18:00:00.000Z')

function baseSnapshot(): CandidateDbSnapshot {
  return {
    candidates: [{
      id: 'candidate-1',
      canonicalName: 'Jane Smith',
      headline: 'Senior Systems Administrator',
      location: 'Baltimore, MD',
      currentCompany: 'Acme',
      currentTitle: 'Senior Systems Administrator',
      summary: '',
      skills: [],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      sourceProfileIds: [],
      evidenceItemIds: [],
      contactSignalIds: [],
      openToWorkSignalIds: [],
      mergeStatus: 'confirmed',
    }],
    sourceProfiles: [],
    evidenceItems: [],
    contactSignals: [],
    openToWorkSignals: [],
    matchReviews: [],
    importBatches: [],
  }
}

function resolve(snapshot: CandidateDbSnapshot) {
  const ledger = buildEvidenceLedger(snapshot, { now: NOW })
  return resolveCandidate360FieldsV35(snapshot, ledger, 'candidate-1', { now: NOW })
}

describe('V35 Candidate 360 field resolution shadow projection', () => {
  it('keeps legacy candidate scalars as a safe compatibility fallback', () => {
    const result = resolve(baseSnapshot())

    expect(result.name.value).toBe('Jane Smith')
    expect(result.currentCompany.value).toBe('Acme')
    expect(result.location.value).toBe('Baltimore, MD')
    expect(result.shadowOnly).toBe(true)
    expect(result.resolverVersion).toBe('v35.0-shadow')
  })

  it('does not let a source handle replace a grounded professional name', () => {
    const snapshot = baseSnapshot()
    snapshot.sourceProfiles.push({
      id: 'profile-1',
      candidateId: 'candidate-1',
      source: 'github',
      sourceProfileId: 'janesmith-dev',
      profileUrl: 'https://github.com/janesmith-dev',
      displayName: 'janesmith-dev',
      status: 'confirmed',
      matchScore: 90,
      matchReasons: ['recruiter confirmed'],
      lastSeenAt: '2026-09-01T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    })

    const result = resolve(snapshot)
    expect(result.name.value).toBe('Jane Smith')
    expect(result.name.alternatives.some(item => item.value === 'janesmith-dev')).toBe(true)
  })

  it('allows two independent recent source types to outvote a stale legacy company while preserving the conflict', () => {
    const snapshot = baseSnapshot()
    snapshot.candidates[0].updatedAt = '2026-01-01T00:00:00.000Z'
    snapshot.sourceProfiles.push(
      {
        id: 'profile-github',
        candidateId: 'candidate-1',
        source: 'github',
        sourceProfileId: 'jane-gh',
        displayName: 'Jane Smith',
        organization: 'BetaCorp',
        status: 'confirmed',
        matchScore: 90,
        matchReasons: [],
        lastSeenAt: '2026-08-31T00:00:00.000Z',
        createdAt: '2026-08-31T00:00:00.000Z',
      },
      {
        id: 'profile-stack',
        candidateId: 'candidate-1',
        source: 'stackoverflow',
        sourceProfileId: 'jane-stack',
        displayName: 'Jane Smith',
        organization: 'BetaCorp',
        status: 'confirmed',
        matchScore: 90,
        matchReasons: [],
        lastSeenAt: '2026-08-30T00:00:00.000Z',
        createdAt: '2026-08-30T00:00:00.000Z',
      },
    )

    const result = resolve(snapshot)
    expect(result.currentCompany.value).toBe('BetaCorp')
    expect(result.currentCompany.state).toBe('resolved_with_conflict')
    expect(result.currentCompany.sourceCount).toBe(2)
    expect(result.currentCompany.alternatives.some(item => item.value === 'Acme')).toBe(true)
  })

  it('requires review when a fresh linked profile conflicts closely with the legacy company', () => {
    const snapshot = baseSnapshot()
    snapshot.sourceProfiles.push({
      id: 'profile-1',
      candidateId: 'candidate-1',
      source: 'github',
      sourceProfileId: 'jane-gh',
      displayName: 'Jane Smith',
      organization: 'BetaCorp',
      status: 'confirmed',
      matchScore: 90,
      matchReasons: [],
      lastSeenAt: '2026-09-01T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    })

    const result = resolve(snapshot)
    expect(result.currentCompany.value).toBe('Acme')
    expect(result.currentCompany.state).toBe('needs_review')
    expect(result.reviewCount).toBeGreaterThan(0)
  })

  it('treats compatible city and metropolitan-area locations as the same normalized place', () => {
    const snapshot = baseSnapshot()
    snapshot.sourceProfiles.push({
      id: 'profile-1',
      candidateId: 'candidate-1',
      source: 'stackoverflow',
      sourceProfileId: 'jane-stack',
      displayName: 'Jane Smith',
      location: 'Baltimore Metropolitan Area',
      status: 'confirmed',
      matchScore: 90,
      matchReasons: [],
      lastSeenAt: '2026-09-01T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    })

    const result = resolve(snapshot)
    expect(result.location.conflicts).toHaveLength(0)
    expect(result.location.state).toBe('resolved')
  })

  it('never resolves a do-not-contact email into the actionable Candidate 360 contact view', () => {
    const snapshot = baseSnapshot()
    snapshot.contactSignals.push({
      id: 'contact-1',
      candidateId: 'candidate-1',
      type: 'email',
      value: 'jane@acme.com',
      source: 'manual',
      confidence: 'high',
      verified: false,
      permissionStatus: 'do_not_contact',
      createdAt: '2026-08-31T00:00:00.000Z',
    })

    const result = resolve(snapshot)
    expect(result.primaryWorkEmail).toBeUndefined()
  })

  it('deduplicates one normalized email for display while retaining multi-source corroboration', () => {
    const snapshot = baseSnapshot()
    snapshot.contactSignals.push(
      {
        id: 'contact-1',
        candidateId: 'candidate-1',
        type: 'email',
        value: 'Jane@Acme.com',
        source: 'uploaded_resume',
        confidence: 'high',
        verified: false,
        permissionStatus: 'candidate_provided',
        createdAt: '2026-08-31T00:00:00.000Z',
      },
      {
        id: 'contact-2',
        candidateId: 'candidate-1',
        type: 'email',
        value: 'jane@acme.com',
        source: 'github',
        confidence: 'medium',
        verified: false,
        permissionStatus: 'unknown',
        createdAt: '2026-08-30T00:00:00.000Z',
      },
    )

    const result = resolve(snapshot)
    expect(result.primaryWorkEmail?.value).toBe('jane@acme.com')
    expect(result.primaryWorkEmail?.sourceCount).toBe(2)
    expect(result.primaryWorkEmail?.permissionStatus).toBe('candidate_provided')
  })

  it('marks an old contact observation stale rather than silently treating it as current', () => {
    const snapshot = baseSnapshot()
    snapshot.contactSignals.push({
      id: 'contact-old',
      candidateId: 'candidate-1',
      type: 'email',
      value: 'jane@oldco.com',
      source: 'uploaded_resume',
      confidence: 'high',
      verified: false,
      permissionStatus: 'candidate_provided',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const result = resolve(snapshot)
    expect(result.primaryWorkEmail?.state).toBe('stale')
    expect(result.primaryWorkEmail?.freshness).toBe('stale')
  })
})
