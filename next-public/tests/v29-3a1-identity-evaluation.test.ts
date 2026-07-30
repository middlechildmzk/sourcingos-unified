import { describe, expect, it } from 'vitest'
import { evaluateIdentityResolver } from '../lib/identity/evaluation'
import { IDENTITY_EVALUATION_CASES } from './fixtures/identity-evaluation-v29-3a1'

describe('V29.3A1 labeled resolver evaluation', () => {
  const report = evaluateIdentityResolver(IDENTITY_EVALUATION_CASES)

  it('covers international, collision, conflict, and non-person cohorts', () => {
    expect(report.total).toBeGreaterThanOrEqual(24)
    expect(report.cohortAccuracy).toHaveProperty('international_common_name')
    expect(report.cohortAccuracy).toHaveProperty('conflict')
    expect(report.cohortAccuracy).toHaveProperty('tenant_isolation')
    expect(report.cohortAccuracy).toHaveProperty('non_person')
  })

  it('permits no labeled false-positive links', () => {
    expect(report.falsePositiveCaseIds).toEqual([])
  })

  it('keeps exact and deterministic precision perfect on contract fixtures', () => {
    expect(report.exactSourcePrecision).toBe(1)
    expect(report.deterministicAttachPrecision).toBe(1)
  })

  it('recalls all review-required collision fixtures', () => {
    expect(report.reviewProposalRecall).toBe(1)
  })

  it('emits a confusion matrix, score distributions, and calibration disclaimer', () => {
    expect(report.decisionClassConfusionMatrix.review.review).toBeGreaterThan(0)
    expect(report.scoreDistributions.review.length).toBeGreaterThan(0)
    expect(report.disclaimer).toContain('real recruiter-reviewed SourcingOS decisions')
  })
})
