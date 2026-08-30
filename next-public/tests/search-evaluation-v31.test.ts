import { describe, expect, it } from 'vitest'
import { compareSearchRuns, evaluateSearchRun, type SearchEvaluationRun } from '@/lib/search-evaluation'

const qrels: SearchEvaluationRun['qrels'] = {
  'candidate-a': 3,
  'candidate-b': 2,
  'candidate-c': 1,
  'candidate-d': 0,
  'candidate-e': 0,
}

const baseline: SearchEvaluationRun = {
  id: 'plan-v1',
  roleId: 'synthetic-platform-role',
  planVersion: 1,
  qrels,
  results: [
    { candidateId: 'candidate-d', laneId: 'exact-title', source: 'github', isNovel: true, elapsedMs: 1000, claimsEvaluated: 3, unsupportedClaims: 1 },
    { candidateId: 'candidate-c', laneId: 'adjacent-title', source: 'github', isNovel: true, elapsedMs: 2200, claimsEvaluated: 2, unsupportedClaims: 0 },
    { candidateId: 'candidate-a', laneId: 'skill-cluster', source: 'github', isNovel: true, elapsedMs: 3600, claimsEvaluated: 4, unsupportedClaims: 1 },
    { candidateId: 'candidate-a', laneId: 'public-evidence', source: 'openalex', isNovel: false, elapsedMs: 3700, claimsEvaluated: 4, unsupportedClaims: 1 },
    { candidateId: 'candidate-e', laneId: 'exact-title', source: 'github', isNovel: true, elapsedMs: 4100, claimsEvaluated: 2, unsupportedClaims: 0 },
  ],
}

const calibrated: SearchEvaluationRun = {
  id: 'plan-v2',
  roleId: 'synthetic-platform-role',
  planVersion: 2,
  qrels,
  results: [
    { candidateId: 'candidate-a', laneId: 'skill-cluster', source: 'github', isNovel: true, elapsedMs: 800, claimsEvaluated: 4, unsupportedClaims: 0 },
    { candidateId: 'candidate-b', laneId: 'adjacent-title', source: 'github', isNovel: true, elapsedMs: 1600, claimsEvaluated: 3, unsupportedClaims: 0 },
    { candidateId: 'candidate-c', laneId: 'public-evidence', source: 'openalex', isNovel: true, elapsedMs: 2400, claimsEvaluated: 2, unsupportedClaims: 0 },
    { candidateId: 'candidate-d', laneId: 'exact-title', source: 'github', isNovel: false, elapsedMs: 3000, claimsEvaluated: 3, unsupportedClaims: 0 },
  ],
}

describe('V31 sourcing retrieval evaluation', () => {
  it('computes ranked retrieval metrics without classifying candidates', () => {
    const metrics = evaluateSearchRun(calibrated, [1, 3, 5])
    expect(metrics.precisionAtK[1]).toBe(1)
    expect(metrics.precisionAtK[3]).toBe(1)
    expect(metrics.recallAtK[3]).toBe(1)
    expect(metrics.mrr).toBe(1)
    expect(metrics.ndcgAtK[3]).toBeGreaterThan(0.99)
    expect(metrics.reviewedResultCount).toBe(4)
    expect(metrics.relevantResultCount).toBe(3)
  })

  it('measures duplicate and novelty behavior separately from relevance', () => {
    const metrics = evaluateSearchRun(baseline, [5])
    expect(metrics.duplicateRate).toBe(0.2)
    expect(metrics.novelResultRate).toBe(1)
    expect(metrics.laneContribution.find(item => item.laneId === 'skill-cluster')).toMatchObject({ discovered: 1, relevant: 1, unique: 0, uniqueRelevant: 0 })
    expect(metrics.sourceYield.find(item => item.source === 'github')?.relevant).toBeGreaterThan(0)
  })

  it('tracks unsupported-claim rate and time to the first strong candidate', () => {
    const before = evaluateSearchRun(baseline, [5])
    const after = evaluateSearchRun(calibrated, [5])
    expect(before.unsupportedClaimRate).toBeGreaterThan(0)
    expect(after.unsupportedClaimRate).toBe(0)
    expect(before.timeToFirstStrongCandidateMs).toBe(3600)
    expect(after.timeToFirstStrongCandidateMs).toBe(800)
  })

  it('compares calibrated search plans as metric deltas instead of saying AI improved by assertion', () => {
    const comparison = compareSearchRuns(baseline, calibrated, [3, 5])
    expect(comparison.precisionAtKDelta[3]).toBeGreaterThan(0)
    expect(comparison.ndcgAtKDelta[3]).toBeGreaterThan(0)
    expect(comparison.mrrDelta).toBeGreaterThanOrEqual(0)
    expect(comparison.unsupportedClaimRateDelta).toBeLessThan(0)
  })

  it('does not invent relevance labels for unreviewed results', () => {
    const run: SearchEvaluationRun = {
      id: 'unreviewed',
      roleId: 'synthetic-role',
      planVersion: 1,
      qrels: { 'reviewed-strong': 3 },
      results: [
        { candidateId: 'unreviewed-a', laneId: 'lane-a', isNovel: true },
        { candidateId: 'reviewed-strong', laneId: 'lane-b', isNovel: true },
      ],
    }
    const metrics = evaluateSearchRun(run, [2])
    expect(metrics.reviewedResultCount).toBe(1)
    expect(metrics.recruiterAcceptanceRate).toBe(1)
    expect(metrics.precisionAtK[2]).toBe(0.5)
  })
})
