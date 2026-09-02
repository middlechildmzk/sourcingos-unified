import type { EntityType } from '@/data/search-taxonomy'
import { containsBoundedTerm, spanMatchesSource, type EvidenceSpan } from '@/lib/evidence-span'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
import { qualificationConceptsV35 } from '@/lib/entity-intelligence/qualification-v35'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'

export type RequirementState = 'supported' | 'contradicted' | 'unknown' | 'needs_verification'
export type RequirementTier = 'must_have' | 'preferred' | 'disqualifier'
export type RequirementKind = 'general' | 'credential' | 'clearance'

export type RequirementAssessment = {
  requirementId: string
  requirementText: string
  tier: RequirementTier
  kind: RequirementKind
  state: RequirementState
  claims: EvidenceClaim[]
  strongestSourceType: EvidenceClaim['sourceType']
  spans: EvidenceSpan[]
  contradictions: EvidenceClaim[]
  recruiterContext: string[]
  rationale: string
}

export type RequirementAssessmentTally = {
  supported: number
  contradicted: number
  needsVerification: number
  unknown: number
  total: number
}

/**
 * Optional source text supplied by callers that construct EvidenceClaim objects
 * outside the canonical Evidence Ledger. The canonical ledger marks spans as
 * validated after checking them against stored source_profiles.raw_text. Direct
 * callers must either provide source text here or their spans fail closed.
 */
export type RequirementSourceTexts = Map<string, string> | Record<string, string>

type Concept = {
  canonical: string
  entityType?: EntityType
  aliases: string[]
}

const SOURCE_STRENGTH: Record<EvidenceClaim['sourceType'], number> = {
  authoritative_registry: 7,
  public_artifact: 6,
  public_profile: 5,
  uploaded_document: 4,
  imported_data: 3,
  review_event: 2,
  unknown: 1,
}

const CANDIDATE_STATED_TYPES = new Set<EvidenceClaim['sourceType']>([
  'public_profile',
  'uploaded_document',
  'imported_data',
])

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function stableRequirementId(tier: RequirementTier, requirementText: string, index: number): string {
  const input = `${tier}:${index}:${requirementText.trim().toLowerCase()}`
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `req_${(hash >>> 0).toString(36)}`
}

/**
 * V35 qualification boundary: candidate requirement assessment uses only reviewed
 * equivalence aliases from Entity Intelligence. Broad legacy Search Composer
 * aliases and search expansions remain useful for recall, but cannot become
 * qualification evidence merely because they share a dictionary entry.
 */
function requirementConcepts(requirementText: string): Concept[] {
  return qualificationConceptsV35(requirementText)
}

function requirementKind(requirementText: string, concepts: Concept[]): RequirementKind {
  if (concepts.some(concept => concept.entityType === 'clearance') || /\b(clearance|polygraph|ts\/sci|top secret|public trust)\b/i.test(requirementText)) {
    return 'clearance'
  }
  if (concepts.some(concept => concept.entityType === 'certification') || /\b(license|licensed|licensure|certification|certified|credential)\b/i.test(requirementText)) {
    return 'credential'
  }
  return 'general'
}

function sourceTextFor(sourceTexts: RequirementSourceTexts | undefined, sourceTextRef: string): string | undefined {
  if (!sourceTexts) return undefined
  return sourceTexts instanceof Map ? sourceTexts.get(sourceTextRef) : sourceTexts[sourceTextRef]
}

/**
 * A span is usable for support only when its offsets are internally valid AND
 * either the canonical Evidence Ledger already revalidated it against stored
 * source text (`spanValidated === true`) or this caller independently supplies
 * the source text and the offsets/text round-trip exactly.
 *
 * This prevents future paste-back/provider adapters from manufacturing a
 * superficially consistent EvidenceClaim that bypasses the ledger.
 */
function claimSpan(claim: EvidenceClaim, sourceTexts?: RequirementSourceTexts): EvidenceSpan | undefined {
  if (
    typeof claim.sourceTextRef !== 'string'
    || !Number.isInteger(claim.spanStart)
    || !Number.isInteger(claim.spanEnd)
    || typeof claim.spanText !== 'string'
    || !claim.spanText
  ) return undefined

  const span: EvidenceSpan = {
    sourceTextRef: claim.sourceTextRef,
    start: claim.spanStart as number,
    end: claim.spanEnd as number,
    text: claim.spanText,
  }
  if (span.start < 0 || span.end <= span.start || span.text.length !== span.end - span.start) return undefined

  const sourceText = sourceTextFor(sourceTexts, span.sourceTextRef)
  if (typeof sourceText === 'string') return spanMatchesSource(sourceText, span) ? span : undefined
  return claim.spanValidated === true ? span : undefined
}

/** Relevance can exist without a span; it may produce Needs verification, never Supported. */
function claimTextMatchesConcept(claim: EvidenceClaim, concept: Concept): boolean {
  const text = `${claim.claimedValue} ${claim.detail}`
  return concept.aliases.some(alias => containsBoundedTerm(text, alias))
}

/** Support is stricter: the recognized concept itself must be inside a validated source span. */
function claimSpanMatchesConcept(claim: EvidenceClaim, concept: Concept, sourceTexts?: RequirementSourceTexts): boolean {
  const span = claimSpan(claim, sourceTexts)
  return Boolean(span && concept.aliases.some(alias => containsBoundedTerm(span.text, alias)))
}

function claimTextMatchesRequirement(claim: EvidenceClaim, concepts: Concept[]): boolean {
  return concepts.some(concept => claimTextMatchesConcept(claim, concept))
}

function hasNegativeLanguage(value: string): boolean {
  return /\b(no|not|never|without|lacks?|lacking|does not|did not|cannot|can't|unable)\b/i.test(value)
}

function strongestSourceType(claims: EvidenceClaim[]): EvidenceClaim['sourceType'] {
  return [...claims].sort((a, b) => SOURCE_STRENGTH[b.sourceType] - SOURCE_STRENGTH[a.sourceType])[0]?.sourceType || 'unknown'
}

function isSensitiveRequirement(tier: RequirementTier, kind: RequirementKind, text: string): boolean {
  return tier === 'disqualifier'
    || kind === 'credential'
    || kind === 'clearance'
    || /\b\d+\s*\+?\s*years?\b/i.test(text)
}

function recruiterContextForRequirement(candidate: RoleCandidate | undefined, concepts: Concept[]): string[] {
  if (!candidate) return []
  const values = [...candidate.fitReasons, ...candidate.concerns, ...candidate.tags]
  return unique(values.filter(value => concepts.some(concept => concept.aliases.some(alias => containsBoundedTerm(value, alias)))))
}

function buildRequirements(intake: RoleIntake): Array<{ text: string; tier: RequirementTier }> {
  const values: Array<{ text: string; tier: RequirementTier }> = [
    ...intake.mustHaves.map(text => ({ text, tier: 'must_have' as const })),
    ...intake.niceToHaves.map(text => ({ text, tier: 'preferred' as const })),
    ...intake.disqualifiers.map(text => ({ text, tier: 'disqualifier' as const })),
  ]
  const clearance = intake.clearance?.trim()
  if (clearance && clearance.toLowerCase() !== 'not specified') {
    values.push({ text: clearance, tier: 'must_have' })
  }

  const seen = new Set<string>()
  return values.filter(item => {
    const key = `${item.tier}:${item.text.trim().toLowerCase()}`
    if (!item.text.trim() || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function conflictingClaimsThatDisagree(
  matchingClaims: EvidenceClaim[],
  sourceTexts?: RequirementSourceTexts,
): EvidenceClaim[] {
  const byGroup = new Map<string, EvidenceClaim[]>()
  for (const claim of matchingClaims) {
    if (!claim.conflictGroup || !claimSpan(claim, sourceTexts)) continue
    const group = byGroup.get(claim.conflictGroup) || []
    group.push(claim)
    byGroup.set(claim.conflictGroup, group)
  }

  const contradictions: EvidenceClaim[] = []
  for (const group of byGroup.values()) {
    if (!group.some(claim => claim.evidenceClass === 'conflicting')) continue
    const negatives = group.filter(claim => hasNegativeLanguage(`${claim.claimedValue} ${claim.detail}`))
    const positives = group.filter(claim => !hasNegativeLanguage(`${claim.claimedValue} ${claim.detail}`))
    if (negatives.length && positives.length) contradictions.push(...negatives)
  }
  return uniqueClaims(contradictions)
}

function assessRequirement(
  requirementText: string,
  tier: RequirementTier,
  requirementId: string,
  claims: EvidenceClaim[],
  candidate?: RoleCandidate,
  sourceTexts?: RequirementSourceTexts,
): RequirementAssessment {
  const concepts = requirementConcepts(requirementText)
  const kind = requirementKind(requirementText, concepts)
  const matchingClaims = claims.filter(claim => claimTextMatchesRequirement(claim, concepts))
  const contradictions = conflictingClaimsThatDisagree(matchingClaims, sourceTexts)
  const recruiterContext = recruiterContextForRequirement(candidate, concepts)

  if (contradictions.length) {
    return {
      requirementId,
      requirementText,
      tier,
      kind,
      state: 'contradicted',
      claims: matchingClaims,
      strongestSourceType: strongestSourceType(matchingClaims),
      spans: matchingClaims.map(claim => claimSpan(claim, sourceTexts)).filter((span): span is EvidenceSpan => Boolean(span)),
      contradictions,
      recruiterContext,
      rationale: 'Span-backed claims in the same conflict group explicitly disagree about this requirement. Absence alone is never treated as contradiction.',
    }
  }

  const sensitive = isSensitiveRequirement(tier, kind, requirementText)
  const conceptCoverage = concepts.map(concept => {
    const conceptClaims = matchingClaims.filter(claim => claimTextMatchesConcept(claim, concept))
    const strongWithSpan = conceptClaims.filter(claim =>
      (claim.evidenceClass === 'verified_fact' || claim.evidenceClass === 'supported_inference')
      && claimSpanMatchesConcept(claim, concept, sourceTexts),
    )
    const strongAllowed = sensitive
      ? strongWithSpan.filter(claim => claim.sourceType === 'authoritative_registry')
      : strongWithSpan
    return { concept, conceptClaims, strongAllowed }
  })
  const everyConceptSupported = conceptCoverage.length > 0 && conceptCoverage.every(item => item.strongAllowed.length > 0)

  if (everyConceptSupported) {
    const supportingClaims = uniqueClaims(conceptCoverage.flatMap(item => item.strongAllowed))
    return {
      requirementId,
      requirementText,
      tier,
      kind,
      state: 'supported',
      claims: supportingClaims,
      strongestSourceType: strongestSourceType(supportingClaims),
      spans: supportingClaims.map(claim => claimSpan(claim, sourceTexts)).filter((span): span is EvidenceSpan => Boolean(span)),
      contradictions: [],
      recruiterContext,
      rationale: 'Every recognized requirement concept has independently validated span-backed verified or supported evidence from an allowed source class.',
    }
  }

  const hasReviewableEvidence = matchingClaims.some(claim =>
    claim.evidenceClass === 'weak_signal'
    || claim.evidenceClass === 'stale'
    || claim.evidenceClass === 'supported_inference'
    || claim.evidenceClass === 'verified_fact'
    || CANDIDATE_STATED_TYPES.has(claim.sourceType),
  )

  if (hasReviewableEvidence || recruiterContext.length) {
    const reason = sensitive
      ? 'Relevant evidence exists, but this requirement needs authoritative or recruiter verification before consequential use.'
      : 'Relevant evidence or recruiter context exists, but it does not satisfy the validated span-backed support rule for every requirement concept.'
    return {
      requirementId,
      requirementText,
      tier,
      kind,
      state: 'needs_verification',
      claims: matchingClaims,
      strongestSourceType: strongestSourceType(matchingClaims),
      spans: matchingClaims.map(claim => claimSpan(claim, sourceTexts)).filter((span): span is EvidenceSpan => Boolean(span)),
      contradictions: [],
      recruiterContext,
      rationale: reason,
    }
  }

  return {
    requirementId,
    requirementText,
    tier,
    kind,
    state: 'unknown',
    claims: [],
    strongestSourceType: 'unknown',
    spans: [],
    contradictions: [],
    recruiterContext,
    rationale: 'No qualifying source-linked evidence is recorded for this requirement. Missing evidence is not a negative finding.',
  }
}

function uniqueClaims(claims: EvidenceClaim[]): EvidenceClaim[] {
  const seen = new Set<string>()
  return claims.filter(claim => {
    if (seen.has(claim.id)) return false
    seen.add(claim.id)
    return true
  })
}

export function buildRequirementAssessments(
  intake: RoleIntake,
  claims: EvidenceClaim[],
  candidate?: RoleCandidate,
  sourceTexts?: RequirementSourceTexts,
): RequirementAssessment[] {
  return buildRequirements(intake).map((requirement, index) =>
    assessRequirement(
      requirement.text,
      requirement.tier,
      stableRequirementId(requirement.tier, requirement.text, index),
      claims,
      candidate,
      sourceTexts,
    ),
  )
}

export function requirementAssessmentTally(assessments: RequirementAssessment[]): RequirementAssessmentTally {
  return assessments.reduce<RequirementAssessmentTally>((tally, assessment) => {
    tally.total += 1
    if (assessment.state === 'supported') tally.supported += 1
    if (assessment.state === 'contradicted') tally.contradicted += 1
    if (assessment.state === 'needs_verification') tally.needsVerification += 1
    if (assessment.state === 'unknown') tally.unknown += 1
    return tally
  }, { supported: 0, contradicted: 0, needsVerification: 0, unknown: 0, total: 0 })
}

export function formatRequirementTally(tally: RequirementAssessmentTally): string {
  const parts = [
    `${tally.supported} supported`,
    `${tally.needsVerification} needs verification`,
    `${tally.unknown} unknown`,
  ]
  if (tally.contradicted) parts.splice(1, 0, `${tally.contradicted} contradicted`)
  return parts.join(' · ')
}
