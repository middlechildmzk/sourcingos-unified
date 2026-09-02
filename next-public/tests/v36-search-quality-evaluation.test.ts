import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEARCH_QUALITY_RELEASE_POLICY_V36,
  NORTH_STAR_RHEL_BENCHMARK_V36,
  compareSearchQualityV36,
  evaluateSearchQualityReleaseV36,
  evaluateSearchQualityV36,
  type SearchQualityRunV36,
} from '@/lib/search-quality-evaluation-v36'

function run(overrides: Partial<SearchQualityRunV36> = {}): SearchQualityRunV36 {
  const results = Array.from({ length: 10 }, (_, index) => ({
    candidateId: `c${index + 1}`,
    laneId: index < 5 ? 'exact' : 'capability',
    source: index < 6 ? 'stackoverflow' : 'github',
    isNovel: index >= 6,
    claimsEvaluated: 2,
    unsupportedClaims: 0,
    elapsedMs: (index + 1) * 100,
    admitted: index < 5,
    reviewed: index < 3,
    admissionLabel: index < 5 ? 'should_admit' as const : 'should_withhold' as const,
  }))
  return {
    id: 'run-a',
    roleId: 'role-rhel',
    planVersion: 36,
    results,
    qrels: {
      c1: 3,
      c2: 3,
      c3: 2,
      c4: 2,
      c5: 1,
      c6: 0,
      c7: 0,
      c8: 0,
      c9: 0,
      c10: 0,
    },
    trustViolations: [],
    ...overrides,
  }
}

describe('V36 search quality evaluation harness', () => {
  it('separates retrieval, admission, and review stages', () => {
    const metrics = evaluateSearchQualityV36(run())
    expect(metrics.funnel).toEqual({
      rawDiscoveryCount: 10,
      uniqueRetrievedCount: 10,
      admittedCount: 5,
      reviewedCount: 3,
      labeledRelevantRetrievedCount: 5,
      labeledRelevantAdmittedCount: 5,
    })
    expect(metrics.retrievalAndRanking.precisionAtK[10]).toBe(0.5)
    expect(metrics.admission.admissionPrecision).toBe(1)
    expect(metrics.admission.admissionRecall).toBe(1)
    expect(metrics.admission.falseWithholdRate).toBe(0)
    expect(metrics.admission.overAdmissionRate).toBe(0)
  })

  it('measures false withholding when review-worthy candidates were retrieved but suppressed', () => {
    const candidate = run()
    candidate.results = candidate.results.map(item => item.candidateId === 'c5' ? { ...item, admitted: false } : item)
    const metrics = evaluateSearchQualityV36(candidate)
    expect(metrics.admission.shouldAdmitCount).toBe(5)
    expect(metrics.admission.falseWithholds).toBe(1)
    expect(metrics.admission.falseWithholdRate).toBe(0.2)
    expect(metrics.admission.admissionRecall).toBe(0.8)
    expect(metrics.retrievalAndRanking.recallAtK[100]).toBe(1)
  })

  it('measures over-admission separately from false withholding', () => {
    const candidate = run()
    candidate.results = candidate.results.map(item => item.candidateId === 'c6' ? { ...item, admitted: true } : item)
    const metrics = evaluateSearchQualityV36(candidate)
    expect(metrics.admission.overAdmissions).toBe(1)
    expect(metrics.admission.overAdmissionRate).toBe(0.2)
    expect(metrics.admission.falseWithholdRate).toBe(0)
    expect(metrics.admission.admissionPrecision).toBeCloseTo(5 / 6)
  })

  it('returns null admission rates when the benchmark has no admission labels instead of inventing quality', () => {
    const unlabeled = run({
      results: [{ candidateId: 'unknown', admitted: true, reviewed: true }],
      qrels: {},
    })
    const metrics = evaluateSearchQualityV36(unlabeled)
    expect(metrics.admission.labeledForAdmissionCount).toBe(0)
    expect(metrics.admission.admissionPrecision).toBeNull()
    expect(metrics.admission.admissionRecall).toBeNull()
    expect(metrics.admission.falseWithholdRate).toBeNull()
    expect(metrics.admission.overAdmissionRate).toBeNull()
  })

  it('deduplicates candidates before measuring admission and stage counts', () => {
    const duplicated = run()
    duplicated.results = [
      duplicated.results[0],
      { ...duplicated.results[0], laneId: 'evidence', source: 'github' },
      ...duplicated.results.slice(1),
    ]
    const metrics = evaluateSearchQualityV36(duplicated)
    expect(metrics.funnel.rawDiscoveryCount).toBe(11)
    expect(metrics.funnel.uniqueRetrievedCount).toBe(10)
    expect(metrics.admission.shouldAdmitCount).toBe(5)
    expect(metrics.retrievalAndRanking.duplicateRate).toBeCloseTo(1 / 11, 6)
  })

  it('counts each hard trust violation by explicit kind', () => {
    const candidate = run({
      trustViolations: [
        { kind: 'fabricated_clearance_or_credential', candidateId: 'c1', detail: 'Secret inferred from employer.' },
        { kind: 'search_inference_became_candidate_fact', candidateId: 'c2', detail: 'Ansible expansion became RHEL evidence.' },
      ],
    })
    const metrics = evaluateSearchQualityV36(candidate)
    expect(metrics.hardTrustViolationCount).toBe(2)
    expect(metrics.trustViolationsByKind.fabricated_clearance_or_credential).toBe(1)
    expect(metrics.trustViolationsByKind.search_inference_became_candidate_fact).toBe(1)
  })

  it('blocks release on any hard trust violation even if ranking quality improved', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({
      id: 'candidate',
      trustViolations: [{
        kind: 'fabricated_clearance_or_credential',
        candidateId: 'c1',
        detail: 'Clearance was inferred rather than observed.',
      }],
    })
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate)
    expect(decision.pass).toBe(false)
    expect(decision.failures.map(failure => failure.gate)).toContain('hard_trust_violation')
  })

  it('blocks a false-withhold regression even when retrieval recall is unchanged', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({ id: 'candidate' })
    candidate.results = candidate.results.map(item =>
      ['c3', 'c4'].includes(item.candidateId) ? { ...item, admitted: false } : item,
    )
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate)
    expect(decision.candidate.retrievalAndRanking.recallAtK[100]).toBe(
      decision.baseline.retrievalAndRanking.recallAtK[100],
    )
    expect(decision.candidate.admission.falseWithholdRate).toBe(0.4)
    expect(decision.pass).toBe(false)
    expect(decision.failures.map(failure => failure.gate)).toContain('false_withhold_regression')
  })

  it('blocks top-10 precision regressions beyond the release budget', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({
      id: 'candidate',
      qrels: {
        c1: 3,
        c2: 0,
        c3: 0,
        c4: 0,
        c5: 0,
        c6: 3,
        c7: 2,
        c8: 2,
        c9: 1,
        c10: 0,
      },
    })
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate)
    expect(decision.pass).toBe(false)
    expect(decision.failures.map(failure => failure.gate)).toContain('precision_at_10_regression')
  })

  it('blocks pooled recall regressions independently of top-10 precision', () => {
    const qrels = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`pool-${index + 1}`, 1 as const]))
    const baselineResults = Array.from({ length: 20 }, (_, index) => ({ candidateId: `pool-${index + 1}` }))
    const candidateResults = baselineResults.slice(0, 10)
    const baseline = run({ id: 'baseline', results: baselineResults, qrels })
    const candidate = run({ id: 'candidate', results: candidateResults, qrels })
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate)
    expect(decision.baseline.retrievalAndRanking.recallAtK[100]).toBe(1)
    expect(decision.candidate.retrievalAndRanking.recallAtK[100]).toBe(0.5)
    expect(decision.failures.map(failure => failure.gate)).toContain('recall_at_100_regression')
  })

  it('blocks unsupported-claim regressions rather than trading truth for recall', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({ id: 'candidate' })
    candidate.results = candidate.results.map((item, index) => index === 0 ? { ...item, unsupportedClaims: 1 } : item)
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate)
    expect(decision.pass).toBe(false)
    expect(decision.failures.map(failure => failure.gate)).toContain('unsupported_claim_regression')
  })

  it('allows small ranking movement inside an explicit regression budget when all trust gates stay clean', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({ id: 'candidate' })
    const decision = evaluateSearchQualityReleaseV36(baseline, candidate, {
      ...DEFAULT_SEARCH_QUALITY_RELEASE_POLICY_V36,
      precisionAt10MaxDrop: 0.1,
    })
    expect(decision.pass).toBe(true)
    expect(decision.failures).toEqual([])
  })

  it('compares admission quality separately from retrieval/ranking metrics', () => {
    const baseline = run({ id: 'baseline' })
    const candidate = run({ id: 'candidate' })
    candidate.results = candidate.results.map(item => item.candidateId === 'c5' ? { ...item, admitted: false } : item)
    const comparison = compareSearchQualityV36(baseline, candidate)
    expect(comparison.core.precisionAtKDelta[10]).toBe(0)
    expect(comparison.core.recallAtKDelta[100]).toBe(0)
    expect(comparison.falseWithholdRateDelta).toBe(0.2)
    expect(comparison.admissionRecallDelta).toBe(-0.2)
  })

  it('pins the RHEL acceptance query as the permanent north-star quality case', () => {
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.recruiterRequest).toBe(
      'find me a RHEL administrator with 5+ years of linux experience local to Annapolis Junction, MD or greater Washington DC with a secret clearance or higher (ts/sci)',
    )
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.invariants).toContain('preserve_recruiter_requirements')
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.invariants).toContain('zero_clearance_fabrication')
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.invariants).toContain('zero_search_inference_fact_leakage')
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.invariants).toContain('measure_false_withhold')
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.notes?.join(' ')).toContain('Secret is the clearance floor')
    expect(NORTH_STAR_RHEL_BENCHMARK_V36.notes?.join(' ')).toContain('first-review admission')
  })
})
