import { compareSourceProfiles } from './candidate-graph'
import type { AgenticConnectorKey } from './agentic-search-v30'
import type { RoleCandidate } from './role-workspace'
import type { SourceResult } from './source-types'

export type ReviewSlateDiscovery = {
  sourceKey: AgenticConnectorKey
  sourceId: string
  sourceUrl?: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
  saveEligible?: boolean
  sourceResult?: SourceResult
}

export type SavedSlateDiscovery = {
  discovery: ReviewSlateDiscovery
  candidateId: string
  candidateUrl: string
  reused: boolean
}

export type IdentityReviewPreview = {
  leftKey: string
  rightKey: string
  reasons: string[]
}

export function reviewSlateDiscoveryKey(discovery: Pick<ReviewSlateDiscovery, 'sourceKey' | 'sourceId'>): string {
  return `${discovery.sourceKey}:${discovery.sourceId}`
}

export function mergeReviewSlateDiscoveries(
  current: ReviewSlateDiscovery[],
  incoming: ReviewSlateDiscovery[]
): ReviewSlateDiscovery[] {
  const byKey = new Map(current.map(item => [reviewSlateDiscoveryKey(item), item]))
  for (const item of incoming) byKey.set(reviewSlateDiscoveryKey(item), item)
  return Array.from(byKey.values())
}

export function saveEligibleReviewSlateDiscoveries(discoveries: ReviewSlateDiscovery[]): ReviewSlateDiscovery[] {
  return discoveries.filter(item => Boolean(item.saveEligible && item.sourceResult?.entityKind === 'person'))
}

export function previewDeterministicIdentityReviews(discoveries: ReviewSlateDiscovery[]): IdentityReviewPreview[] {
  const sourceBacked = saveEligibleReviewSlateDiscoveries(discoveries).filter(item => item.sourceResult)
  const previews: IdentityReviewPreview[] = []
  for (let leftIndex = 0; leftIndex < sourceBacked.length; leftIndex += 1) {
    const left = sourceBacked[leftIndex]
    if (!left.sourceResult) continue
    for (let rightIndex = leftIndex + 1; rightIndex < sourceBacked.length; rightIndex += 1) {
      const right = sourceBacked[rightIndex]
      if (!right.sourceResult || left.sourceResult.source === right.sourceResult.source) continue
      const comparison = compareSourceProfiles(left.sourceResult, right.sourceResult)
      if (!comparison.deterministicAnchor || comparison.blocked) continue
      previews.push({
        leftKey: reviewSlateDiscoveryKey(left),
        rightKey: reviewSlateDiscoveryKey(right),
        reasons: comparison.reasons,
      })
    }
  }
  return previews
}

export function buildRoleReviewSlateCandidates(
  saved: SavedSlateDiscovery[],
  existingCandidateIds: Iterable<string>,
  now = new Date().toISOString(),
  idFactory: () => string = () => crypto.randomUUID()
): RoleCandidate[] {
  const existing = new Set(existingCandidateIds)
  const emitted = new Set<string>()
  const candidates: RoleCandidate[] = []

  for (const item of saved) {
    if (!item.candidateId || existing.has(item.candidateId) || emitted.has(item.candidateId)) continue
    const result = item.discovery
    candidates.push({
      id: idFactory(),
      candidateId: item.candidateId,
      name: result.displayName,
      headline: result.headline || '',
      company: result.organization || '',
      location: result.location || '',
      source: 'candidate_database',
      sourceUrl: result.sourceUrl,
      stage: 'needs_review',
      fitDecision: 'unreviewed',
      fitReasons: [],
      concerns: [],
      tags: result.sourceResult?.skills.slice(0, 12) || [],
      contactStatus: result.sourceResult?.contactSignals.length ? 'signals_found' : 'unknown',
      evidenceStatus: 'unreviewed',
      addedAt: now,
      updatedAt: now,
    })
    emitted.add(item.candidateId)
  }

  return candidates
}
