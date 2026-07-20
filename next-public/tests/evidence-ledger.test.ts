import { describe, expect, it } from 'vitest'
import { buildEvidenceLedger, freshnessFor, type LegacyCandidateDbSnapshot } from '../lib/evidence-ledger'

const now = new Date('2026-07-20T12:00:00.000Z')

function snapshot(): LegacyCandidateDbSnapshot {
  return {
    candidates: [{ id: 'candidate-1', canonicalName: 'Jordan Rivera', headline: 'Senior DevSecOps Engineer', location: 'Minneapolis, MN' }],
    sourceProfiles: [{ id: 'source-1', candidateId: 'candidate-1', source: 'github', profileUrl: 'https://github.com/jordan-rivera' }],
    evidenceItems: [
      { id: 'evidence-url', sourceProfileId: 'source-1', source: 'github', label: 'Public URL', detail: 'https://github.com/jordan-rivera', confidence: 'high', url: 'https://github.com/jordan-rivera', createdAt: '2026-07-19T12:00:00.000Z' },
      { id: 'evidence-skill', sourceProfileId: 'source-1', source: 'github', label: 'Skill signal', detail: 'Kubernetes', confidence: 'medium', createdAt: '2026-07-19T12:00:00.000Z' },
    ],
    contactSignals: [
      { id: 'contact-1', sourceProfileId: 'source-1', type: 'email', value: 'jordan@example.com', source: 'github', confidence: 'medium', verified: false, permissionStatus: 'do_not_contact', createdAt: '2026-07-19T12:00:00.000Z' },
    ],
    openToWorkSignals: [
      { id: 'availability-1', sourceProfileId: 'source-1', source: 'github', label: 'Availability language', detail: 'Available for consulting', confidence: 'high', requiresReview: true, createdAt: '2026-06-01T12:00:00.000Z' },
    ],
    matchReviews: [
      { id: 'review-1', candidateId: 'candidate-1', sourceProfileIds: ['source-1'], proposedCanonicalName: 'Jordan Rivera', score: 55, reasons: ['Name overlap'], conflicts: ['Location differs across source profiles'], decision: 'pending', createdAt: '2026-07-19T12:00:00.000Z' },
    ],
  }
}

describe('V19 evidence ledger', () => {
  it('keeps facts, weak signals, stale evidence, and conflicts separate', () => {
    const ledger = buildEvidenceLedger(snapshot(), { now })

    expect(ledger.summary.total).toBe(5)
    expect(ledger.summary.verified).toBe(1)
    expect(ledger.summary.weak).toBe(2)
    expect(ledger.summary.stale).toBe(1)
    expect(ledger.summary.conflicting).toBe(1)
  })

  it('never converts contact or availability signals into verified facts', () => {
    const ledger = buildEvidenceLedger(snapshot(), { now })
    const contact = ledger.claims.find(claim => claim.id === 'contact:contact-1')
    const availability = ledger.claims.find(claim => claim.id === 'availability:availability-1')

    expect(contact?.evidenceClass).not.toBe('verified_fact')
    expect(contact?.permittedUse).toBe('blocked')
    expect(contact?.containsPii).toBe(true)
    expect(availability?.evidenceClass).toBe('stale')
    expect(availability?.permittedUse).toBe('review_only')
  })

  it('preserves identity conflicts and recruiter review state', () => {
    const ledger = buildEvidenceLedger(snapshot(), { now })
    const conflict = ledger.claims.find(claim => claim.evidenceClass === 'conflicting')

    expect(conflict?.conflictGroup).toBe('review-1')
    expect(conflict?.reviewerStatus).toBe('requires_review')
    expect(conflict?.notes.join(' ')).toMatch(/recruiter-controlled/i)
  })

  it('can scope the ledger to one candidate without cross-record leakage', () => {
    const input = snapshot()
    input.candidates.push({ id: 'candidate-2', canonicalName: 'Taylor Chen' })
    input.evidenceItems.push({ id: 'other', candidateId: 'candidate-2', source: 'manual', label: 'Profile summary text', detail: 'Second candidate', confidence: 'medium', createdAt: '2026-07-19T12:00:00.000Z' })

    const ledger = buildEvidenceLedger(input, { candidateId: 'candidate-1', now })
    expect(ledger.candidates).toHaveLength(1)
    expect(ledger.claims.every(claim => claim.candidateId === 'candidate-1')).toBe(true)
  })

  it('uses explicit freshness windows', () => {
    expect(freshnessFor('2026-07-19T12:00:00.000Z', 30, now)).toBe('fresh')
    expect(freshnessFor('2026-06-25T12:00:00.000Z', 30, now)).toBe('aging')
    expect(freshnessFor('2026-06-01T12:00:00.000Z', 30, now)).toBe('stale')
  })
})
