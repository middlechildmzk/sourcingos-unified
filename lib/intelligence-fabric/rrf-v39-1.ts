export type RetrievalLaneV39_1 = 'lexical' | 'structured' | 'graph' | 'vector'

export type RetrievalLaneResultV39_1 = {
  lane: RetrievalLaneV39_1
  hits: Array<{
    candidateId: string
    nativeScore?: number
  }>
}

export type FusedRetrievalHitV39_1 = {
  candidateId: string
  rrfScore: number
  componentRanks: Partial<Record<RetrievalLaneV39_1, number>>
  componentNativeScores: Partial<Record<RetrievalLaneV39_1, number>>
  identityMergePerformed: false
  qualificationScore: false
}

/**
 * Reciprocal Rank Fusion across canonical candidate IDs.
 *
 * This combines retrieval lanes only. It never resolves identities, converts a
 * retrieval score into qualification, or turns missing evidence into a negative.
 */
export function fuseRetrievalLanesV39_1(
  lanes: RetrievalLaneResultV39_1[],
  k = 60,
): FusedRetrievalHitV39_1[] {
  const safeK = Math.max(1, Math.trunc(k))
  const byCandidate = new Map<string, FusedRetrievalHitV39_1>()

  for (const lane of lanes) {
    const seenInLane = new Set<string>()
    lane.hits.forEach((hit, index) => {
      const candidateId = String(hit.candidateId || '').trim()
      if (!candidateId || seenInLane.has(candidateId)) return
      seenInLane.add(candidateId)
      const rank = index + 1
      const existing = byCandidate.get(candidateId) || {
        candidateId,
        rrfScore: 0,
        componentRanks: {},
        componentNativeScores: {},
        identityMergePerformed: false as const,
        qualificationScore: false as const,
      }
      existing.rrfScore += 1 / (safeK + rank)
      existing.componentRanks[lane.lane] = rank
      if (Number.isFinite(hit.nativeScore)) existing.componentNativeScores[lane.lane] = Number(hit.nativeScore)
      byCandidate.set(candidateId, existing)
    })
  }

  return Array.from(byCandidate.values())
    .map(hit => ({ ...hit, rrfScore: Number(hit.rrfScore.toFixed(12)) }))
    .sort((a, b) => b.rrfScore - a.rrfScore || a.candidateId.localeCompare(b.candidateId))
}
