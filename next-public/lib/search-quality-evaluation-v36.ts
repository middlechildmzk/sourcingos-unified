import {
  compareSearchRuns,
  evaluateSearchRun,
  type SearchEvaluationComparison,
  type SearchEvaluationMetrics,
  type SearchEvaluationResultItem,
  type SearchEvaluationRun,
  type SearchRelevanceGrade,
} from '@/lib/search-evaluation'

export type AdmissionLabelV36 = 'should_admit' | 'should_withhold' | 'unlabeled'

export type SearchTrustViolationKindV36 =
  | 'fabricated_clearance_or_credential'
  | 'recruiter_requirement_corruption'
  | 'search_inference_became_candidate_fact'
  | 'silent_cross_source_identity_merge'
  | 'unsupported_high_confidence_requirement_claim'
  | 'protected_trait_or_proxy_ranking'
  | 'company_prestige_ranking'

export type SearchTrustViolationV36 = {
  kind: SearchTrustViolationKindV36
  candidateId?: string
  detail: string
}

export type SearchQualityResultItemV36 = SearchEvaluationResultItem & {
  admitted?: boolean
  reviewed?: boolean
  admissionLabel?: AdmissionLabelV36
}

export type SearchQualityRunV36 = Omit<SearchEvaluationRun, 'results'> & {
  results: SearchQualityResultItemV36[]
  trustViolations?: SearchTrustViolationV36[]
  benchmarkCaseId?: string
}

export type AdmissionMetricsV36 = {
  labeledForAdmissionCount: number
  shouldAdmitCount: number
  shouldWithholdCount: number
  admittedCount: number
  admittedLabeledCount: number
  correctAdmissions: number
  falseWithholds: number
  overAdmissions: number
  admissionPrecision: number | null
  admissionRecall: number | null
  falseWithholdRate: number | null
  overAdmissionRate: number | null
}

export type StageFunnelV36 = {
  rawDiscoveryCount: number
  uniqueRetrievedCount: number
  admittedCount: number
  reviewedCount: number
  labeledRelevantRetrievedCount: number
  labeledRelevantAdmittedCount: number
}

export type SearchQualityMetricsV36 = {
  retrievalAndRanking: SearchEvaluationMetrics
  admission: AdmissionMetricsV36
  funnel: StageFunnelV36
  hardTrustViolationCount: number
  trustViolationsByKind: Record<SearchTrustViolationKindV36, number>
}

export type SearchQualityComparisonV36 = {
  core: SearchEvaluationComparison
  falseWithholdRateDelta: number | null
  admissionPrecisionDelta: number | null
  admissionRecallDelta: number | null
  overAdmissionRateDelta: number | null
  hardTrustViolationDelta: number
}

export type SearchQualityReleasePolicyV36 = {
  precisionAt10MaxDrop: number
  recallAt100MaxDrop: number
  falseWithholdRateMaxIncrease: number
  unsupportedClaimRateMaxIncrease: number
  duplicateRateMaxIncrease: number
  requireZeroHardTrustViolations: true
}

export const DEFAULT_SEARCH_QUALITY_RELEASE_POLICY_V36: SearchQualityReleasePolicyV36 = {
  precisionAt10MaxDrop: 0.05,
  recallAt100MaxDrop: 0.05,
  falseWithholdRateMaxIncrease: 0.05,
  unsupportedClaimRateMaxIncrease: 0,
  duplicateRateMaxIncrease: 0.05,
  requireZeroHardTrustViolations: true,
}

export type SearchQualityGateFailureV36 = {
  gate:
    | 'hard_trust_violation'
    | 'precision_at_10_regression'
    | 'recall_at_100_regression'
    | 'false_withhold_regression'
    | 'unsupported_claim_regression'
    | 'duplicate_rate_regression'
  observed: number
  allowed: number
  explanation: string
}

export type SearchQualityReleaseDecisionV36 = {
  pass: boolean
  failures: SearchQualityGateFailureV36[]
  comparison: SearchQualityComparisonV36
  baseline: SearchQualityMetricsV36
  candidate: SearchQualityMetricsV36
}

export type SearchQualityBenchmarkInvariantV36 =
  | 'preserve_recruiter_requirements'
  | 'zero_clearance_fabrication'
  | 'zero_search_inference_fact_leakage'
  | 'zero_silent_identity_merge'
  | 'zero_unsupported_high_confidence_claims'
  | 'zero_protected_proxy_ranking'
  | 'zero_company_prestige_ranking'
  | 'measure_false_withhold'

export type SearchQualityBenchmarkCaseV36 = {
  id: string
  roleFamily: string
  recruiterRequest: string
  qrels: Record<string, SearchRelevanceGrade>
  admissionLabels: Record<string, Exclude<AdmissionLabelV36, 'unlabeled'>>
  invariants: SearchQualityBenchmarkInvariantV36[]
  notes?: string[]
}

const TRUST_KINDS: SearchTrustViolationKindV36[] = [
  'fabricated_clearance_or_credential',
  'recruiter_requirement_corruption',
  'search_inference_became_candidate_fact',
  'silent_cross_source_identity_merge',
  'unsupported_high_confidence_requirement_claim',
  'protected_trait_or_proxy_ranking',
  'company_prestige_ranking',
]

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function delta(candidate: number | null, baseline: number | null): number | null {
  if (candidate === null || baseline === null) return null
  return round(candidate - baseline)
}

function uniqueResults(results: SearchQualityResultItemV36[]): SearchQualityResultItemV36[] {
  const seen = new Set<string>()
  return results.filter(item => {
    const id = item.candidateId.trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function isRelevant(grade: SearchRelevanceGrade | undefined): boolean {
  return typeof grade === 'number' && grade > 0
}

function evaluateAdmissionV36(results: SearchQualityResultItemV36[]): AdmissionMetricsV36 {
  const unique = uniqueResults(results)
  const labeled = unique.filter(item => item.admissionLabel && item.admissionLabel !== 'unlabeled')
  const shouldAdmit = labeled.filter(item => item.admissionLabel === 'should_admit')
  const shouldWithhold = labeled.filter(item => item.admissionLabel === 'should_withhold')
  const admitted = unique.filter(item => item.admitted === true)
  const admittedLabeled = admitted.filter(item => item.admissionLabel && item.admissionLabel !== 'unlabeled')
  const correctAdmissions = admittedLabeled.filter(item => item.admissionLabel === 'should_admit')
  const falseWithholds = shouldAdmit.filter(item => item.admitted !== true)
  const overAdmissions = shouldWithhold.filter(item => item.admitted === true)

  return {
    labeledForAdmissionCount: labeled.length,
    shouldAdmitCount: shouldAdmit.length,
    shouldWithholdCount: shouldWithhold.length,
    admittedCount: admitted.length,
    admittedLabeledCount: admittedLabeled.length,
    correctAdmissions: correctAdmissions.length,
    falseWithholds: falseWithholds.length,
    overAdmissions: overAdmissions.length,
    admissionPrecision: admittedLabeled.length ? round(correctAdmissions.length / admittedLabeled.length) : null,
    admissionRecall: shouldAdmit.length ? round(correctAdmissions.length / shouldAdmit.length) : null,
    falseWithholdRate: shouldAdmit.length ? round(falseWithholds.length / shouldAdmit.length) : null,
    overAdmissionRate: shouldWithhold.length ? round(overAdmissions.length / shouldWithhold.length) : null,
  }
}

function evaluateFunnelV36(run: SearchQualityRunV36): StageFunnelV36 {
  const unique = uniqueResults(run.results)
  const admitted = unique.filter(item => item.admitted === true)
  const reviewed = unique.filter(item => item.reviewed === true)
  return {
    rawDiscoveryCount: run.results.length,
    uniqueRetrievedCount: unique.length,
    admittedCount: admitted.length,
    reviewedCount: reviewed.length,
    labeledRelevantRetrievedCount: unique.filter(item => isRelevant(run.qrels[item.candidateId])).length,
    labeledRelevantAdmittedCount: admitted.filter(item => isRelevant(run.qrels[item.candidateId])).length,
  }
}

function trustViolationCounts(run: SearchQualityRunV36): Record<SearchTrustViolationKindV36, number> {
  const counts = Object.fromEntries(TRUST_KINDS.map(kind => [kind, 0])) as Record<SearchTrustViolationKindV36, number>
  for (const violation of run.trustViolations || []) counts[violation.kind] += 1
  return counts
}

function toCoreRun(run: SearchQualityRunV36): SearchEvaluationRun {
  return {
    id: run.id,
    roleId: run.roleId,
    planVersion: run.planVersion,
    results: run.results.map(({ admitted: _admitted, reviewed: _reviewed, admissionLabel: _admissionLabel, ...item }) => item),
    qrels: run.qrels,
  }
}

export function evaluateSearchQualityV36(
  run: SearchQualityRunV36,
  cutoffs: number[] = [5, 10, 100],
): SearchQualityMetricsV36 {
  const counts = trustViolationCounts(run)
  return {
    retrievalAndRanking: evaluateSearchRun(toCoreRun(run), cutoffs),
    admission: evaluateAdmissionV36(run.results),
    funnel: evaluateFunnelV36(run),
    hardTrustViolationCount: Object.values(counts).reduce((sum, value) => sum + value, 0),
    trustViolationsByKind: counts,
  }
}

export function compareSearchQualityV36(
  baseline: SearchQualityRunV36,
  candidate: SearchQualityRunV36,
  cutoffs: number[] = [5, 10, 100],
): SearchQualityComparisonV36 {
  const before = evaluateSearchQualityV36(baseline, cutoffs)
  const after = evaluateSearchQualityV36(candidate, cutoffs)
  return {
    core: compareSearchRuns(toCoreRun(baseline), toCoreRun(candidate), cutoffs),
    falseWithholdRateDelta: delta(after.admission.falseWithholdRate, before.admission.falseWithholdRate),
    admissionPrecisionDelta: delta(after.admission.admissionPrecision, before.admission.admissionPrecision),
    admissionRecallDelta: delta(after.admission.admissionRecall, before.admission.admissionRecall),
    overAdmissionRateDelta: delta(after.admission.overAdmissionRate, before.admission.overAdmissionRate),
    hardTrustViolationDelta: after.hardTrustViolationCount - before.hardTrustViolationCount,
  }
}

function rateOrZero(value: number | null): number {
  return value ?? 0
}

export function evaluateSearchQualityReleaseV36(
  baselineRun: SearchQualityRunV36,
  candidateRun: SearchQualityRunV36,
  policy: SearchQualityReleasePolicyV36 = DEFAULT_SEARCH_QUALITY_RELEASE_POLICY_V36,
): SearchQualityReleaseDecisionV36 {
  const baseline = evaluateSearchQualityV36(baselineRun)
  const candidate = evaluateSearchQualityV36(candidateRun)
  const comparison = compareSearchQualityV36(baselineRun, candidateRun)
  const failures: SearchQualityGateFailureV36[] = []

  if (policy.requireZeroHardTrustViolations && candidate.hardTrustViolationCount > 0) {
    failures.push({
      gate: 'hard_trust_violation',
      observed: candidate.hardTrustViolationCount,
      allowed: 0,
      explanation: 'Hard trust violations are zero-tolerance release blockers.',
    })
  }

  const precisionDrop = (baseline.retrievalAndRanking.precisionAtK[10] ?? 0) - (candidate.retrievalAndRanking.precisionAtK[10] ?? 0)
  if (precisionDrop > policy.precisionAt10MaxDrop) {
    failures.push({
      gate: 'precision_at_10_regression',
      observed: round(precisionDrop),
      allowed: policy.precisionAt10MaxDrop,
      explanation: 'Top-10 recruiter review precision degraded beyond the permitted regression budget.',
    })
  }

  const recallDrop = (baseline.retrievalAndRanking.recallAtK[100] ?? 0) - (candidate.retrievalAndRanking.recallAtK[100] ?? 0)
  if (recallDrop > policy.recallAt100MaxDrop) {
    failures.push({
      gate: 'recall_at_100_regression',
      observed: round(recallDrop),
      allowed: policy.recallAt100MaxDrop,
      explanation: 'Pooled relevant-candidate recall degraded beyond the permitted regression budget.',
    })
  }

  const falseWithholdIncrease = rateOrZero(candidate.admission.falseWithholdRate) - rateOrZero(baseline.admission.falseWithholdRate)
  if (falseWithholdIncrease > policy.falseWithholdRateMaxIncrease) {
    failures.push({
      gate: 'false_withhold_regression',
      observed: round(falseWithholdIncrease),
      allowed: policy.falseWithholdRateMaxIncrease,
      explanation: 'The candidate system withheld too many independently-labeled review-worthy people.',
    })
  }

  const unsupportedIncrease = rateOrZero(candidate.retrievalAndRanking.unsupportedClaimRate) - rateOrZero(baseline.retrievalAndRanking.unsupportedClaimRate)
  if (unsupportedIncrease > policy.unsupportedClaimRateMaxIncrease) {
    failures.push({
      gate: 'unsupported_claim_regression',
      observed: round(unsupportedIncrease),
      allowed: policy.unsupportedClaimRateMaxIncrease,
      explanation: 'Unsupported candidate claims increased. Search quality cannot improve by weakening evidence truth.',
    })
  }

  const duplicateIncrease = candidate.retrievalAndRanking.duplicateRate - baseline.retrievalAndRanking.duplicateRate
  if (duplicateIncrease > policy.duplicateRateMaxIncrease) {
    failures.push({
      gate: 'duplicate_rate_regression',
      observed: round(duplicateIncrease),
      allowed: policy.duplicateRateMaxIncrease,
      explanation: 'Duplicate candidate exposure increased beyond the permitted budget.',
    })
  }

  return { pass: failures.length === 0, failures, comparison, baseline, candidate }
}

export const NORTH_STAR_RHEL_BENCHMARK_V36: SearchQualityBenchmarkCaseV36 = {
  id: 'north-star-rhel-annapolis-secret-plus',
  roleFamily: 'infrastructure',
  recruiterRequest: 'find me a RHEL administrator with 5+ years of linux experience local to Annapolis Junction, MD or greater Washington DC with a secret clearance or higher (ts/sci)',
  qrels: {},
  admissionLabels: {},
  invariants: [
    'preserve_recruiter_requirements',
    'zero_clearance_fabrication',
    'zero_search_inference_fact_leakage',
    'zero_silent_identity_merge',
    'zero_unsupported_high_confidence_claims',
    'zero_protected_proxy_ranking',
    'zero_company_prestige_ranking',
    'measure_false_withhold',
  ],
  notes: [
    'Secret is the clearance floor. TS/SCI is acceptable higher context and never rewrites the requirement.',
    'Annapolis Junction remains the primary geography and Washington, DC remains an explicitly stated alternate market.',
    'RHEL-related technologies may aid discovery and never satisfy RHEL, tenure, location, or clearance without independent evidence.',
    'Quantified tenure and clearance may remain verification-gated while strong RHEL/Linux evidence still permits first-review admission.',
  ],
}
