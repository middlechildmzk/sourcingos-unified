export type SearchRelevanceGrade = 0 | 1 | 2 | 3

export type SearchEvaluationResultItem = {
  candidateId: string
  laneId?: string
  source?: string
  isNovel?: boolean
  claimsEvaluated?: number
  unsupportedClaims?: number
  elapsedMs?: number
}

export type SearchEvaluationRun = {
  id: string
  roleId: string
  planVersion: number
  results: SearchEvaluationResultItem[]
  qrels: Record<string, SearchRelevanceGrade>
}

export type LaneContribution = {
  laneId: string
  discovered: number
  relevant: number
  unique: number
  uniqueRelevant: number
}

export type SourceYield = {
  source: string
  discovered: number
  relevant: number
}

export type SearchEvaluationMetrics = {
  precisionAtK: Record<number, number>
  recallAtK: Record<number, number>
  ndcgAtK: Record<number, number>
  mrr: number
  duplicateRate: number
  novelResultRate: number
  recruiterAcceptanceRate: number
  strongFitRate: number
  unsupportedClaimRate: number | null
  timeToFirstStrongCandidateMs: number | null
  laneContribution: LaneContribution[]
  sourceYield: SourceYield[]
  reviewedResultCount: number
  relevantResultCount: number
  labeledRelevantUniverse: number
}

export type SearchEvaluationComparison = {
  baselineRunId: string
  candidateRunId: string
  precisionAtKDelta: Record<number, number>
  recallAtKDelta: Record<number, number>
  ndcgAtKDelta: Record<number, number>
  mrrDelta: number
  novelResultRateDelta: number
  recruiterAcceptanceRateDelta: number
  unsupportedClaimRateDelta: number | null
}

const DEFAULT_K = [5, 10]

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function relevance(run: SearchEvaluationRun, candidateId: string): SearchRelevanceGrade | undefined {
  return run.qrels[candidateId]
}

function isRelevant(grade: SearchRelevanceGrade | undefined): boolean {
  return typeof grade === 'number' && grade > 0
}

function isStrong(grade: SearchRelevanceGrade | undefined): boolean {
  return typeof grade === 'number' && grade >= 2
}

function uniqueRanking(results: SearchEvaluationResultItem[]): SearchEvaluationResultItem[] {
  const seen = new Set<string>()
  return results.filter(item => {
    const id = item.candidateId.trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function precisionAt(run: SearchEvaluationRun, ranked: SearchEvaluationResultItem[], k: number): number {
  if (k <= 0) return 0
  const relevantCount = ranked.slice(0, k).filter(item => isRelevant(relevance(run, item.candidateId))).length
  return round(relevantCount / k)
}

function recallAt(run: SearchEvaluationRun, ranked: SearchEvaluationResultItem[], k: number): number {
  const universe = Object.values(run.qrels).filter(isRelevant).length
  if (!universe) return 0
  const relevantCount = ranked.slice(0, k).filter(item => isRelevant(relevance(run, item.candidateId))).length
  return round(relevantCount / universe)
}

function dcg(grades: SearchRelevanceGrade[]): number {
  return grades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0)
}

function ndcgAt(run: SearchEvaluationRun, ranked: SearchEvaluationResultItem[], k: number): number {
  const observed = ranked.slice(0, k).map(item => relevance(run, item.candidateId) ?? 0)
  const ideal = Object.values(run.qrels).sort((a, b) => b - a).slice(0, k)
  const idealDcg = dcg(ideal)
  return idealDcg ? round(clamp01(dcg(observed) / idealDcg)) : 0
}

function reciprocalRank(run: SearchEvaluationRun, ranked: SearchEvaluationResultItem[]): number {
  const index = ranked.findIndex(item => isRelevant(relevance(run, item.candidateId)))
  return index < 0 ? 0 : round(1 / (index + 1))
}

function duplicateRate(results: SearchEvaluationResultItem[]): number {
  if (!results.length) return 0
  const ids = results.map(item => item.candidateId.trim()).filter(Boolean)
  if (!ids.length) return 0
  const duplicates = ids.length - new Set(ids).size
  return round(duplicates / ids.length)
}

function laneContribution(run: SearchEvaluationRun): LaneContribution[] {
  const byCandidate = new Map<string, Set<string>>()
  const byLane = new Map<string, Set<string>>()

  for (const item of run.results) {
    const candidateId = item.candidateId.trim()
    const laneId = item.laneId?.trim()
    if (!candidateId || !laneId) continue
    if (!byCandidate.has(candidateId)) byCandidate.set(candidateId, new Set())
    byCandidate.get(candidateId)!.add(laneId)
    if (!byLane.has(laneId)) byLane.set(laneId, new Set())
    byLane.get(laneId)!.add(candidateId)
  }

  return Array.from(byLane.entries()).map(([laneId, candidates]) => {
    const values = Array.from(candidates)
    const unique = values.filter(candidateId => (byCandidate.get(candidateId)?.size ?? 0) === 1)
    return {
      laneId,
      discovered: values.length,
      relevant: values.filter(candidateId => isRelevant(relevance(run, candidateId))).length,
      unique: unique.length,
      uniqueRelevant: unique.filter(candidateId => isRelevant(relevance(run, candidateId))).length,
    }
  }).sort((a, b) => b.uniqueRelevant - a.uniqueRelevant || b.relevant - a.relevant || a.laneId.localeCompare(b.laneId))
}

function sourceYield(run: SearchEvaluationRun): SourceYield[] {
  const bySource = new Map<string, Set<string>>()
  for (const item of run.results) {
    const candidateId = item.candidateId.trim()
    const source = item.source?.trim()
    if (!candidateId || !source) continue
    if (!bySource.has(source)) bySource.set(source, new Set())
    bySource.get(source)!.add(candidateId)
  }
  return Array.from(bySource.entries()).map(([source, candidates]) => ({
    source,
    discovered: candidates.size,
    relevant: Array.from(candidates).filter(candidateId => isRelevant(relevance(run, candidateId))).length,
  })).sort((a, b) => b.relevant - a.relevant || b.discovered - a.discovered || a.source.localeCompare(b.source))
}

function unsupportedClaimRate(ranked: SearchEvaluationResultItem[]): number | null {
  const claims = ranked.reduce((sum, item) => sum + Math.max(0, item.claimsEvaluated ?? 0), 0)
  if (!claims) return null
  const unsupported = ranked.reduce((sum, item) => sum + Math.max(0, item.unsupportedClaims ?? 0), 0)
  return round(clamp01(unsupported / claims))
}

export function evaluateSearchRun(run: SearchEvaluationRun, cutoffs: number[] = DEFAULT_K): SearchEvaluationMetrics {
  const ranked = uniqueRanking(run.results)
  const ks = Array.from(new Set(cutoffs.filter(k => Number.isInteger(k) && k > 0))).sort((a, b) => a - b)
  const labeled = ranked.filter(item => typeof relevance(run, item.candidateId) === 'number')
  const accepted = labeled.filter(item => isRelevant(relevance(run, item.candidateId)))
  const strong = labeled.filter(item => isStrong(relevance(run, item.candidateId)))
  const novel = ranked.filter(item => item.isNovel === true).length
  const firstStrong = ranked.find(item => isStrong(relevance(run, item.candidateId)) && typeof item.elapsedMs === 'number')

  return {
    precisionAtK: Object.fromEntries(ks.map(k => [k, precisionAt(run, ranked, k)])),
    recallAtK: Object.fromEntries(ks.map(k => [k, recallAt(run, ranked, k)])),
    ndcgAtK: Object.fromEntries(ks.map(k => [k, ndcgAt(run, ranked, k)])),
    mrr: reciprocalRank(run, ranked),
    duplicateRate: duplicateRate(run.results),
    novelResultRate: ranked.length ? round(novel / ranked.length) : 0,
    recruiterAcceptanceRate: labeled.length ? round(accepted.length / labeled.length) : 0,
    strongFitRate: labeled.length ? round(strong.length / labeled.length) : 0,
    unsupportedClaimRate: unsupportedClaimRate(ranked),
    timeToFirstStrongCandidateMs: firstStrong?.elapsedMs ?? null,
    laneContribution: laneContribution(run),
    sourceYield: sourceYield(run),
    reviewedResultCount: labeled.length,
    relevantResultCount: accepted.length,
    labeledRelevantUniverse: Object.values(run.qrels).filter(isRelevant).length,
  }
}

function metricDelta(candidate: Record<number, number>, baseline: Record<number, number>): Record<number, number> {
  const keys = Array.from(new Set([...Object.keys(candidate), ...Object.keys(baseline)].map(Number))).sort((a, b) => a - b)
  return Object.fromEntries(keys.map(key => [key, round((candidate[key] ?? 0) - (baseline[key] ?? 0))]))
}

export function compareSearchRuns(
  baseline: SearchEvaluationRun,
  candidate: SearchEvaluationRun,
  cutoffs: number[] = DEFAULT_K,
): SearchEvaluationComparison {
  const before = evaluateSearchRun(baseline, cutoffs)
  const after = evaluateSearchRun(candidate, cutoffs)
  const unsupportedDelta = before.unsupportedClaimRate === null || after.unsupportedClaimRate === null
    ? null
    : round(after.unsupportedClaimRate - before.unsupportedClaimRate)

  return {
    baselineRunId: baseline.id,
    candidateRunId: candidate.id,
    precisionAtKDelta: metricDelta(after.precisionAtK, before.precisionAtK),
    recallAtKDelta: metricDelta(after.recallAtK, before.recallAtK),
    ndcgAtKDelta: metricDelta(after.ndcgAtK, before.ndcgAtK),
    mrrDelta: round(after.mrr - before.mrr),
    novelResultRateDelta: round(after.novelResultRate - before.novelResultRate),
    recruiterAcceptanceRateDelta: round(after.recruiterAcceptanceRate - before.recruiterAcceptanceRate),
    unsupportedClaimRateDelta: unsupportedDelta,
  }
}
