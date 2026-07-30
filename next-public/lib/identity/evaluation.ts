import { resolveCandidateIdentity } from './resolver'
import type { DecisionClass, ResolveIdentityInput } from './resolver-types'

export type EvaluationLabel =
  | 'exact_source_reuse'
  | 'deterministic_attach'
  | 'review'
  | 'create_new_candidate'
  | 'do_not_link'

export type LabeledIdentityCase = {
  id: string
  description: string
  input: ResolveIdentityInput
  expected: EvaluationLabel
  cohort?: string
}

export type IdentityEvaluationReport = {
  total: number
  correct: number
  accuracy: number
  exactSourcePrecision: number | null
  deterministicAttachPrecision: number | null
  reviewProposalRecall: number | null
  falsePositiveCaseIds: string[]
  falseNegativeCaseIds: string[]
  decisionClassConfusionMatrix: Record<EvaluationLabel, Record<EvaluationLabel, number>>
  scoreDistributions: Record<EvaluationLabel, number[]>
  cohortAccuracy: Record<string, { total: number; correct: number; accuracy: number }>
  disclaimer: string
}

const LABELS: EvaluationLabel[] = [
  'exact_source_reuse',
  'deterministic_attach',
  'review',
  'create_new_candidate',
  'do_not_link',
]

function emptyCounts(): Record<EvaluationLabel, number> {
  return {
    exact_source_reuse: 0,
    deterministic_attach: 0,
    review: 0,
    create_new_candidate: 0,
    do_not_link: 0,
  }
}

export function evaluationLabel(decision: DecisionClass): EvaluationLabel {
  if (decision === 'high_priority_review' || decision === 'standard_review') return 'review'
  return decision
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null
}

export function evaluateIdentityResolver(cases: LabeledIdentityCase[]): IdentityEvaluationReport {
  const matrix: Record<EvaluationLabel, Record<EvaluationLabel, number>> = {
    exact_source_reuse: emptyCounts(),
    deterministic_attach: emptyCounts(),
    review: emptyCounts(),
    create_new_candidate: emptyCounts(),
    do_not_link: emptyCounts(),
  }
  const scores: Record<EvaluationLabel, number[]> = {
    exact_source_reuse: [],
    deterministic_attach: [],
    review: [],
    create_new_candidate: [],
    do_not_link: [],
  }
  const cohorts = new Map<string, { total: number; correct: number }>()
  const falsePositiveCaseIds: string[] = []
  const falseNegativeCaseIds: string[] = []

  let correct = 0
  let exactPredicted = 0
  let exactCorrect = 0
  let deterministicPredicted = 0
  let deterministicCorrect = 0
  let expectedReview = 0
  let predictedReviewWhenExpected = 0

  for (const fixture of cases) {
    const resolution = resolveCandidateIdentity(fixture.input)
    const predicted = evaluationLabel(resolution.decisionClass)
    matrix[fixture.expected][predicted] += 1
    if (resolution.score !== null) scores[predicted].push(resolution.score)

    const isCorrect = predicted === fixture.expected
    if (isCorrect) correct += 1

    if (predicted === 'exact_source_reuse') {
      exactPredicted += 1
      if (fixture.expected === 'exact_source_reuse') exactCorrect += 1
    }
    if (predicted === 'deterministic_attach') {
      deterministicPredicted += 1
      if (fixture.expected === 'deterministic_attach') deterministicCorrect += 1
    }
    if (fixture.expected === 'review') {
      expectedReview += 1
      if (predicted === 'review') predictedReviewWhenExpected += 1
    }

    const predictedLink = predicted === 'exact_source_reuse' || predicted === 'deterministic_attach'
    const expectedLink = fixture.expected === 'exact_source_reuse' || fixture.expected === 'deterministic_attach'
    if (predictedLink && !expectedLink) falsePositiveCaseIds.push(fixture.id)
    if (!predictedLink && expectedLink) falseNegativeCaseIds.push(fixture.id)

    const cohort = fixture.cohort ?? 'uncategorized'
    const summary = cohorts.get(cohort) ?? { total: 0, correct: 0 }
    summary.total += 1
    if (isCorrect) summary.correct += 1
    cohorts.set(cohort, summary)
  }

  const sortedScores: Record<EvaluationLabel, number[]> = {
    exact_source_reuse: [...scores.exact_source_reuse].sort((a, b) => a - b),
    deterministic_attach: [...scores.deterministic_attach].sort((a, b) => a - b),
    review: [...scores.review].sort((a, b) => a - b),
    create_new_candidate: [...scores.create_new_candidate].sort((a, b) => a - b),
    do_not_link: [...scores.do_not_link].sort((a, b) => a - b),
  }

  return {
    total: cases.length,
    correct,
    accuracy: cases.length ? correct / cases.length : 0,
    exactSourcePrecision: ratio(exactCorrect, exactPredicted),
    deterministicAttachPrecision: ratio(deterministicCorrect, deterministicPredicted),
    reviewProposalRecall: ratio(predictedReviewWhenExpected, expectedReview),
    falsePositiveCaseIds,
    falseNegativeCaseIds,
    decisionClassConfusionMatrix: matrix,
    scoreDistributions: sortedScores,
    cohortAccuracy: Object.fromEntries([...cohorts.entries()].map(([cohort, value]) => [
      cohort,
      { ...value, accuracy: value.total ? value.correct / value.total : 0 },
    ])),
    disclaimer: 'Fixture results validate contracts only. Thresholds require calibration against real recruiter-reviewed SourcingOS decisions before production use.',
  }
}
