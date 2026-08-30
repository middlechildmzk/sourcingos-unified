import { ALL_TAXONOMY, type EntityType } from '@/data/search-taxonomy'
import { containsBoundedTerm, type EvidenceSpan } from '@/lib/evidence-span'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
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
 * Requirement matching intentionally reuses the Search Composer taxonomy rather
 * than maintaining a second synonym dictionary. Search expansions contain
 * adjacent terms as well as aliases, so they are not qualification evidence and
 * are intentionally excluded here.
 */
function requirementConcepts(requirementText: string): Concept[] {
  const matches = ALL_TAXONOMY.filter(entry =>
    entry.aliases.some(alias => containsBoundedTerm(requirementText, alias))
      || containsBoundedTerm(requirementText, entry.canonical),
  )

  if (!matches.length) {
    return [{ canonical: requirementText.trim(), aliases: [requirementText.trim()] }]
  }

  return matches.map(entry => ({
    canonical: entry.canonical,
    entityType: entry.type,
    aliases: unique([entry.canonical, ...entry.aliases]),
  }))
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

function claimSpan(claim: EvidenceClaim): EvidenceSpan | undefined {
  if (
    typeof claim.sourceTextRef !== 'string'
    || !Number.isInteger(claim.spanStart)
    || !Number.isInteger(claim.spanEnd)
    || typeof claim.spanText !== 'string'
    || !claim.spanText
  ) return undefined

  const span = {
    sourceTextRef: claim.sourceTextRef,
    start: claim.spanStart as number,
    end: claim.spanEnd as number,
    text: claim.spanText,
  }
  if (span.start < 0 || span.end <= span.start || span.text.length !== span.end - span.start) return undefined
  return span
}

function claimMatchesConcept(claim: EvidenceClaim, concept: Concept): boolean {
  const span = claimSpan(claim)
  if (!span) return false
  return concept.aliases.some(alias => containsBoundedTerm(span.text, alias))
    || concept.aliases.some(alias => containsBoundedTerm(claim.claimedValue, alias))
}

function claimMatchesRequirement(claim: EvidenceClaim, concepts: Concept[]): boolean {
  return concepts.some(concept => claimMatchesConcept(claim, concept))
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

function assessRequirement(
  requirementText: string,
  tier: RequirementTier,
  requirementId: string,
  claims: EvidenceClaim[],
  candidate?: RoleCandidate,
): RequirementAssessment {
  const concepts = requirementConcepts(requirementText)
  const kind = requirementKind(requirementText, concepts)
  const matchingClaims = claims.filter(claim => claimMatchesRequirement(claim, concepts))
  const contradictions = matchingClaims.filter(claim =>
    claim.evidenceClass === 'conflicting'
    && Boolean(claim.conflictGroup)
    && hasNegativeLanguage(`${claim.claimedValue} ${claim.detail}`),
  )
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
      spans: matchingClaims.map(claimSpan).filter((span): span is EvidenceSpan => Boolean(span)),
      contradictions,
      recruiterContext,
      rationale: 'A source-linked conflicting claim explicitly disagrees with this requirement. Absence alone is never treated as contradiction.',
    }
  }

  const sensitive = isSensitiveRequirement(tier, kind, requirementText)
  const conceptCoverage = concepts.map(concept => {
    const conceptClaims = matchingClaims.filter(claim => claimMatchesConcept(claim, concept))
    const strong = conceptClaims.filter(claim => claim.evidenceClass === 'verified_fact' || claim.evidenceClass === 'supported_inference')
    const strongAllowed = sensitive
      ? strong.filter(claim => claim.sourceType === 'authoritative_registry')
      : strong
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
      spans: supportingClaims.map(claimSpan).filter((span): span is EvidenceSpan => Boolean(span)),
      contradictions: [],
      recruiterContext,
      rationale: 'Every recognized requirement concept has span-backed verified or supported evidence from an allowed source class.',
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
      ? 'This requirement needs authoritative or recruiter verification before consequential use.'
      : 'Relevant evidence or recruiter context exists, but it does not satisfy the span-backed support rule for every requirement concept.'
    return {
      requirementId,
      requirementText,
      tier,
      kind,
      state: 'needs_verification',
      claims: matchingClaims,
      strongestSourceType: strongestSourceType(matchingClaims),
      spans: matchingClaims.map(claimSpan).filter((span): span is EvidenceSpan => Boolean(span)),
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
): RequirementAssessment[] {
  return buildRequirements(intake).map((requirement, index) =>
    assessRequirement(
      requirement.text,
      requirement.tier,
      stableRequirementId(requirement.tier, requirement.text, index),
      claims,
      candidate,
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
