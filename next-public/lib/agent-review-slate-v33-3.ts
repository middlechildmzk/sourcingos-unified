import { compareSourceProfiles } from './candidate-graph'
import type { AgenticConnectorKey } from './agentic-search-v30'
import { requirementToRetrievalCapability } from './explicit-role-requirements-v33-6'
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

export type ReviewAdmissionStateV36_7 = 'review_ready' | 'promising_verify' | 'held'

export type ReviewSlateEvidenceCheck = {
  discovery: ReviewSlateDiscovery
  /** Backward-compatible admission bit. review_ready + promising_verify are admitted. */
  admitted: boolean
  reviewState: ReviewAdmissionStateV36_7
  matchedSignals: string[]
  matchedMustHaves: string[]
  matchedTitleSignals: string[]
  missingMustHaves: string[]
  unverifiedRequirements: string[]
  holdReasons: string[]
  locationState: 'compatible' | 'unknown' | 'outside_search_area' | 'not_constrained'
  explanation: string
}

export type FirstReviewBatchSummaryV36_7 = {
  discoveredPeople: number
  reviewReady: number
  promisingVerify: number
  held: number
  admitted: number
  heldByReason: Record<string, number>
}

export type FirstReviewBatchOptionsV36_7 = {
  /** Full recruiter-approved search geography: anchor + explicit alternates + approved expansions. */
  approvedLocations?: string[]
}

const SIGNAL_STOP_WORDS = new Set([
  'and', 'the', 'with', 'for', 'from', 'years', 'year', 'experience', 'experienced',
  'administrator', 'admin', 'engineer', 'engineering', 'developer', 'senior', 'junior',
  'required', 'preferred', 'recent', 'hands', 'ownership', 'role', 'area',
])

const NON_OBSERVABLE_REQUIREMENTS = new Set(['relevant', 'professional', 'overall', 'work', 'industry', 'total'])

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').split(/\s+/).filter(word => word.length > 2 && !SIGNAL_STOP_WORDS.has(word))
}

function observableRoleSignals(intake: RoleIntake): string[] {
  const words = normalizedWords([intake.title, ...intake.mustHaves, ...intake.niceToHaves].join(' '))
  if (/\brhel\b|red\s+hat/i.test(intake.title)) words.push('rhel', 'linux', 'red hat')
  if (/\b(?:administrator|admin|sysadmin)\b/i.test(intake.title)) words.push('sysadmin', 'systems administration')
  return Array.from(new Set(words)).slice(0, 30)
}

/**
 * Evidence-equivalent aliases are deliberately narrow and capability-specific.
 * They expand common observed spellings, not conceptual adjacency.
 */
function requirementProofAliases(requirement: string): string[] {
  const capability = requirementToRetrievalCapability(requirement).toLowerCase().trim()
  if (!capability || NON_OBSERVABLE_REQUIREMENTS.has(capability)) return []
  if (/\brhel\b|red\s+hat\s+enterprise\s+linux/.test(capability)) return ['rhel', 'red hat enterprise linux', 'red hat']
  if (/^red\s+hat$/.test(capability)) return ['red hat', 'rhel']
  if (/^linux$/.test(capability)) return ['linux', 'rhel', 'red hat enterprise linux', 'red hat']
  if (/^unix$/.test(capability)) return ['unix']
  if (/^emr(?:\s+|\/)?ehr$/.test(capability)) return ['emr/ehr', 'emr', 'ehr', 'electronic medical record', 'electronic health record']
  if (/^nist\s+rmf$/.test(capability)) return ['nist rmf', 'risk management framework', 'rmf']
  if (/^llm$/.test(capability)) return ['llm', 'large language model', 'large language models']
  if (/^hugging\s+face$/.test(capability)) return ['hugging face', 'huggingface']
  if (/^kubernetes$/.test(capability)) return ['kubernetes', 'k8s']
  if (/^ci(?:\s+|\/)?cd$/.test(capability)) return ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment']
  if (/^rest\s+api$/.test(capability)) return ['rest api', 'restful api', 'restful services']
  return [capability]
}

function quantifiedExperienceRequirement(requirement: string): boolean {
  return /^\s*(?:at\s+least\s+|minimum\s+of\s+)?\d{1,2}\s*(?:\+|\s+or\s+more)?\s*(?:years?|yrs?)\b/i.test(requirement)
}

function observedDiscoveryText(discovery: ReviewSlateDiscovery): string {
  return [
    discovery.headline,
    discovery.organization,
    ...(discovery.sourceResult?.skills || []),
    ...discovery.evidence.flatMap(item => [item.label, item.value]),
    ...(discovery.sourceResult?.evidence || []).flatMap(item => [item.label, item.detail]),
  ].filter(Boolean).join(' ').toLowerCase()
}

function normalizedLocationText(value: string): string {
  return value.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
}

const FORT_MEADE_MARKET = /annapolis\s+junction|fort\s+meade|laurel|jessup|columbia|hanover|odenton|severn|savage|elkridge/i
const DMV_MARKET = /washington\s*(?:dc|d\s+c)|district of columbia|\bdmv\b|northern virginia|\bnova\b|arlington|alexandria|fairfax|reston|herndon|mclean|mc lean|tysons|chantilly|sterling|maryland|bethesda|rockville|silver spring|fort meade|annapolis junction|laurel|columbia/i

function marketCompatible(requested: string, observed: string): boolean {
  const requestedText = normalizedLocationText(requested)
  const observedText = normalizedLocationText(observed)
  if (!requestedText || !observedText) return false
  if (FORT_MEADE_MARKET.test(requestedText) && FORT_MEADE_MARKET.test(observedText)) return true
  if (DMV_MARKET.test(requestedText) && DMV_MARKET.test(observedText)) return true
  const requestedWords = normalizedWords(requestedText)
  return requestedWords.some(word => observedText.includes(word))
}

function locationState(
  intake: RoleIntake,
  discovery: ReviewSlateDiscovery,
  approvedLocations: string[] = [],
): ReviewSlateEvidenceCheck['locationState'] {
  const fallback = intake.location?.trim() && intake.location !== 'Not specified' ? [intake.location.trim()] : []
  const requestedMarkets = Array.from(new Set([...approvedLocations, ...fallback].map(item => item.trim()).filter(Boolean)))
  if (!requestedMarkets.length) return 'not_constrained'
  const observed = discovery.location?.trim() || discovery.sourceResult?.location?.trim()
  if (!observed) return 'unknown'
  return requestedMarkets.some(requested => marketCompatible(requested, observed)) ? 'compatible' : 'outside_search_area'
}

function requirementLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function summaryFromChecks(checks: ReviewSlateEvidenceCheck[]): FirstReviewBatchSummaryV36_7 {
  const heldByReason: Record<string, number> = {}
  for (const check of checks.filter(item => item.reviewState === 'held')) {
    for (const reason of check.holdReasons.length ? check.holdReasons : ['held']) heldByReason[reason] = (heldByReason[reason] || 0) + 1
  }
  const reviewReady = checks.filter(item => item.reviewState === 'review_ready').length
  const promisingVerify = checks.filter(item => item.reviewState === 'promising_verify').length
  const held = checks.filter(item => item.reviewState === 'held').length
  return {
    discoveredPeople: checks.length,
    reviewReady,
    promisingVerify,
    held,
    admitted: reviewReady + promisingVerify,
    heldByReason,
  }
}

/**
 * V36.7 first-review admission deliberately separates relevance from proof.
 *
 * - Review Ready: role-relevant observed evidence + no missing observable must-have
 *   + compatible/not-constrained geography.
 * - Promising — Verify: role-relevant evidence exists, but one or more public-source
 *   fields are incomplete (including location, quantified tenure, clearance, or an
 *   observable must-have). These records ARE shown to the recruiter.
 * - Held: no meaningful role evidence or observed geography is demonstrably outside
 *   every recruiter-approved search market.
 *
 * Unknown is never treated as rejection. Clearance remains verification-gated.
 */
export function evidenceBearingFirstReviewBatch(
  discoveries: ReviewSlateDiscovery[],
  intake: RoleIntake,
  limit = 12,
  options: FirstReviewBatchOptionsV36_7 = {},
): { batch: ReviewSlateDiscovery[]; checks: ReviewSlateEvidenceCheck[]; summary: FirstReviewBatchSummaryV36_7 } {
  const roleSignals = observableRoleSignals(intake)
  const gateableMustHaves = intake.mustHaves
    .map(requirement => ({
      requirement: requirementLabel(requirement),
      aliases: requirementProofAliases(requirement),
      verificationGated: quantifiedExperienceRequirement(requirement),
    }))
    .filter(item => item.requirement && item.aliases.length)
  const nonObservableMustHaves = intake.mustHaves
    .map(requirementLabel)
    .filter(requirement => requirement && !requirementProofAliases(requirement).length)

  const checks = saveEligibleReviewSlateDiscoveries(discoveries).map(discovery => {
    const observed = observedDiscoveryText(discovery)
    const matchedTitleSignals = roleSignals.filter(signal => observed.includes(signal)).slice(0, 6)
    const matchedGateable = gateableMustHaves.filter(item => item.aliases.some(alias => observed.includes(alias)))
    const matchedMustHaves = matchedGateable.filter(item => !item.verificationGated).map(item => item.requirement)
    const matchedCapabilitySignals = matchedGateable
      .filter(item => item.verificationGated)
      .map(item => `${requirementToRetrievalCapability(item.requirement)} capability evidence`)
    const missingGateable = gateableMustHaves.filter(item => !matchedGateable.includes(item))
    const missingMustHaves = missingGateable.map(item => item.requirement)
    const missingObservableNonVerification = missingGateable.filter(item => !item.verificationGated).map(item => item.requirement)
    const matchedSignals = Array.from(new Set([...matchedMustHaves, ...matchedCapabilitySignals, ...matchedTitleSignals])).slice(0, 8)
    const geography = locationState(intake, discovery, options.approvedLocations)
    const roleRelevant = matchedGateable.length > 0 || matchedTitleSignals.length > 0

    const holdReasons: string[] = []
    if (!roleRelevant) holdReasons.push('insufficient role-relevant public evidence')
    if (geography === 'outside_search_area') holdReasons.push('observed location outside approved search geography')

    let reviewState: ReviewAdmissionStateV36_7
    if (holdReasons.length) reviewState = 'held'
    else if (
      missingObservableNonVerification.length > 0
      || geography === 'unknown'
      || nonObservableMustHaves.length > 0
      || matchedGateable.some(item => item.verificationGated)
      || (intake.clearance && intake.clearance !== 'Not specified')
    ) reviewState = 'promising_verify'
    else reviewState = 'review_ready'

    const admitted = reviewState !== 'held'
    const unverifiedRequirements = Array.from(new Set([
      ...nonObservableMustHaves,
      ...missingMustHaves,
      ...matchedGateable.filter(item => item.verificationGated).map(item => item.requirement),
      ...(geography === 'unknown' ? ['Candidate location'] : []),
      ...(intake.clearance && intake.clearance !== 'Not specified' ? [`Clearance: ${intake.clearance}`] : []),
    ]))

    const explanation = reviewState === 'held'
      ? `Held for recruiter inspection — not rejected: ${holdReasons.join('; ')}.`
      : reviewState === 'promising_verify'
        ? `Promising — verify. Observed role signals: ${matchedSignals.join(', ') || 'role-relevant source evidence'}.${geography === 'compatible' ? ' Observed location is compatible with recruiter-approved geography.' : geography === 'unknown' ? ' Location not observed.' : ''}${unverifiedRequirements.length ? ` Verify next: ${unverifiedRequirements.join(', ')}.` : ''}`
        : `Review Ready. Observed role signals: ${matchedSignals.join(', ')}.${geography === 'compatible' ? ' Observed location is compatible with recruiter-approved geography.' : ''}`

    return {
      discovery,
      admitted,
      reviewState,
      matchedSignals,
      matchedMustHaves,
      matchedTitleSignals,
      missingMustHaves,
      unverifiedRequirements,
      holdReasons,
      locationState: geography,
      explanation,
    }
  })

  const priority: Record<ReviewAdmissionStateV36_7, number> = { review_ready: 0, promising_verify: 1, held: 2 }
  const ordered = checks.filter(check => check.admitted).sort((left, right) => {
    const state = priority[left.reviewState] - priority[right.reviewState]
    if (state) return state
    const geography = Number(right.locationState === 'compatible') - Number(left.locationState === 'compatible')
    if (geography) return geography
    const mustHaves = right.matchedMustHaves.length - left.matchedMustHaves.length
    if (mustHaves) return mustHaves
    const signals = right.matchedSignals.length - left.matchedSignals.length
    if (signals) return signals
    return right.discovery.profileQuality - left.discovery.profileQuality
  })

  return {
    batch: ordered.slice(0, Math.max(1, limit)).map(check => check.discovery),
    checks,
    summary: summaryFromChecks(checks),
  }
}

export function reviewSlateDiscoveryKey(discovery: Pick<ReviewSlateDiscovery, 'sourceKey' | 'sourceId'>): string {
  return `${discovery.sourceKey}:${discovery.sourceId}`
}

export function mergeReviewSlateDiscoveries(current: ReviewSlateDiscovery[], incoming: ReviewSlateDiscovery[]): ReviewSlateDiscovery[] {
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

function displayNameForCandidate(discovery: ReviewSlateDiscovery): string {
  const name = discovery.displayName.trim()
  if (name && name.toLowerCase() !== discovery.sourceId.trim().toLowerCase()) return name
  if (discovery.sourceKey === 'github') return `GitHub @${discovery.sourceId}`
  if (discovery.sourceKey === 'stackoverflow') return `Stack Overflow user ${discovery.sourceId}`
  if (discovery.sourceKey === 'devto') return `DEV @${discovery.sourceId}`
  if (discovery.sourceKey === 'huggingface') return `Hugging Face @${discovery.sourceId}`
  return name || `${discovery.sourceKey} ${discovery.sourceId}`
}

export function buildRoleReviewSlateCandidates(
  saved: SavedSlateDiscovery[],
  existingCandidateIds: Iterable<string>,
  now = new Date().toISOString(),
  idFactory: () => string = () => crypto.randomUUID(),
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
      name: displayNameForCandidate(result),
      headline: result.headline || '',
      company: result.organization || '',
      location: result.location || result.sourceResult?.location || '',
      source: 'candidate_database',
      sourceUrl: result.sourceUrl || result.sourceResult?.profileUrl,
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
