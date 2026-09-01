import { compareSourceProfiles } from './candidate-graph'
import type { AgenticConnectorKey } from './agentic-search-v30'
import type { RoleCandidate, RoleIntake } from './role-workspace'
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

export type ReviewSlateEvidenceCheck = {
  discovery: ReviewSlateDiscovery
  admitted: boolean
  matchedSignals: string[]
  locationState: 'compatible' | 'unknown' | 'outside_search_area' | 'not_constrained'
  explanation: string
}

const SIGNAL_STOP_WORDS = new Set([
  'and', 'the', 'with', 'for', 'from', 'years', 'year', 'experience', 'experienced',
  'administrator', 'admin', 'engineer', 'engineering', 'developer', 'senior', 'junior',
  'required', 'preferred', 'recent', 'hands', 'ownership', 'role', 'area',
])

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').split(/\s+/).filter(word => word.length > 2 && !SIGNAL_STOP_WORDS.has(word))
}

function observableRoleSignals(intake: RoleIntake): string[] {
  const words = normalizedWords([intake.title, ...intake.mustHaves, ...intake.niceToHaves].join(' '))
  if (/\brhel\b|red\s+hat/i.test(intake.title)) words.push('rhel', 'linux', 'red hat')
  if (/\b(?:administrator|admin|sysadmin)\b/i.test(intake.title)) words.push('sysadmin', 'systems administration')
  return Array.from(new Set(words)).slice(0, 30)
}

function locationState(intake: RoleIntake, discovery: ReviewSlateDiscovery): ReviewSlateEvidenceCheck['locationState'] {
  const requested = intake.location?.trim()
  if (!requested || requested === 'Not specified') return 'not_constrained'
  const observed = discovery.location?.trim()
  if (!observed) return 'unknown'
  const requestedText = requested.toLowerCase()
  const observedText = observed.toLowerCase()
  if (/washington\s*(?:dc|d\.c\.)|district of columbia|\bdmv\b/i.test(requestedText)) {
    return /washington\s*(?:dc|d\.c\.)|district of columbia|\bdmv\b|northern virginia|\bnova\b|arlington|alexandria|fairfax|reston|herndon|mclean|maryland|bethesda|rockville|silver spring|fort meade|annapolis junction/i.test(observedText)
      ? 'compatible'
      : 'outside_search_area'
  }
  const requestedWords = normalizedWords(requestedText)
  return requestedWords.some(word => observedText.includes(word)) ? 'compatible' : 'outside_search_area'
}

/**
 * Builds a small first review batch from observed source facts only. Records
 * outside the floor remain visible in the discovery pass for recruiter review;
 * they are not rejected and no candidate-fit conclusion is created.
 */
export function evidenceBearingFirstReviewBatch(
  discoveries: ReviewSlateDiscovery[],
  intake: RoleIntake,
  limit = 12,
): { batch: ReviewSlateDiscovery[]; checks: ReviewSlateEvidenceCheck[] } {
  const roleSignals = observableRoleSignals(intake)
  const checks = saveEligibleReviewSlateDiscoveries(discoveries).map(discovery => {
    const observed = [
      discovery.headline,
      discovery.organization,
      ...(discovery.sourceResult?.skills || []),
      ...discovery.evidence.flatMap(item => [item.label, item.value]),
    ].filter(Boolean).join(' ').toLowerCase()
    const matchedSignals = roleSignals.filter(signal => observed.includes(signal)).slice(0, 6)
    const geography = locationState(intake, discovery)
    const admitted = matchedSignals.length > 0 && geography !== 'outside_search_area'
    const explanation = !matchedSignals.length
      ? 'Held outside the first batch: no observed role-relevant skill or work evidence.'
      : geography === 'outside_search_area'
        ? 'Held outside the first batch: the observed location is outside the requested search area.'
        : geography === 'unknown'
          ? `First-batch evidence: ${matchedSignals.join(', ')}. Location remains unknown and needs recruiter verification.`
          : `First-batch evidence: ${matchedSignals.join(', ')}${geography === 'compatible' ? '; observed location is compatible.' : '.'}`
    return { discovery, admitted, matchedSignals, locationState: geography, explanation }
  })

  const ordered = checks.filter(check => check.admitted).sort((left, right) => {
    const geography = Number(right.locationState === 'compatible') - Number(left.locationState === 'compatible')
    if (geography) return geography
    const signals = right.matchedSignals.length - left.matchedSignals.length
    if (signals) return signals
    return right.discovery.profileQuality - left.discovery.profileQuality
  })
  return { batch: ordered.slice(0, Math.max(1, limit)).map(check => check.discovery), checks }
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
