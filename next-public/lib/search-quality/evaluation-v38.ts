import { evaluateSearchRun, type SearchEvaluationMetrics, type SearchEvaluationRun } from '../search-evaluation'

export type SearchTrustViolationTypeV38 =
  | 'UNSUPPORTED_CLAIM'
  | 'UNKNOWN_AS_NEGATIVE'
  | 'REQUIREMENT_CORRUPTION'
  | 'SILENT_IDENTITY_MERGE'
  | 'LOCATION_INFERENCE'
  | 'CLEARANCE_INFERENCE'
  | 'CREDENTIAL_INFERENCE'
  | 'COMPANY_TO_CANDIDATE_EVIDENCE_LEAKAGE'
  | 'PROTECTED_ATTRIBUTE_RANKING'

export type SearchTrustViolationV38 = {
  type: SearchTrustViolationTypeV38
  candidateId?: string
  detail: string
}

export type SearchQualityEvaluationV38 = {
  version: 'v38'
  ranking: SearchEvaluationMetrics
  precisionAt5: number
  precisionAt10: number
  recallAt25: number
  recallAt50: number
  recallAt100: number
  ndcgAt10: number
  mrr: number
  duplicateRate: number
  sourceDiversity: number
  relevanceAdmissionRate: number
  falseWithholdRate: number | null
  overAdmissionRate: number | null
  unsupportedClaimRate: number | null
  hardTrustViolations: SearchTrustViolationV38[]
  hardTrustGatePass: boolean
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Number((Math.max(0, numerator) / denominator).toFixed(6)) : 0
}

export function evaluateSearchQualityV38(params: {
  run: SearchEvaluationRun
  rawDiscoveries: number
  relevanceAdmitted: number
  falseWithheld?: number
  relevantBeforeAdmission?: number
  overAdmitted?: number
  admittedJudged?: number
  trustViolations?: SearchTrustViolationV38[]
}): SearchQualityEvaluationV38 {
  const ranking = evaluateSearchRun(params.run, [5, 10, 25, 50, 100])
  const trustViolations = params.trustViolations || []
  return {
    version: 'v38',
    ranking,
    precisionAt5: ranking.precisionAtK[5] || 0,
    precisionAt10: ranking.precisionAtK[10] || 0,
    recallAt25: ranking.recallAtK[25] || 0,
    recallAt50: ranking.recallAtK[50] || 0,
    recallAt100: ranking.recallAtK[100] || 0,
    ndcgAt10: ranking.ndcgAtK[10] || 0,
    mrr: ranking.mrr,
    duplicateRate: ranking.duplicateRate,
    sourceDiversity: new Set(params.run.results.map(item => item.source).filter(Boolean)).size,
    relevanceAdmissionRate: ratio(params.relevanceAdmitted, params.rawDiscoveries),
    falseWithholdRate: typeof params.falseWithheld === 'number' && typeof params.relevantBeforeAdmission === 'number'
      ? ratio(params.falseWithheld, params.relevantBeforeAdmission)
      : null,
    overAdmissionRate: typeof params.overAdmitted === 'number' && typeof params.admittedJudged === 'number'
      ? ratio(params.overAdmitted, params.admittedJudged)
      : null,
    unsupportedClaimRate: ranking.unsupportedClaimRate,
    hardTrustViolations: trustViolations,
    hardTrustGatePass: trustViolations.length === 0,
  }
}

/**
 * Zero tolerance means zero: a search-quality release cannot trade a trust
 * violation for better recall/precision.
 */
export function assertSearchTrustGateV38(evaluation: SearchQualityEvaluationV38): void {
  if (!evaluation.hardTrustGatePass) {
    const kinds = Array.from(new Set(evaluation.hardTrustViolations.map(item => item.type))).join(', ')
    throw new Error(`V38 search trust gate failed: ${kinds || 'unknown trust violation'}`)
  }
}
