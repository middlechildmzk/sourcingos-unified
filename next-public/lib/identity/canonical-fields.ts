export type FieldClaimLifecycle = 'active' | 'superseded' | 'conflicting' | 'rejected' | 'unresolved'
export type FieldClaimReview = 'unreviewed' | 'requires_review' | 'accepted' | 'rejected'

export type CandidateFieldClaim = {
  id: string
  fieldName: string
  value: unknown
  normalizedValue?: string
  source: string
  sourceType: string
  observedAt?: string
  retrievedAt: string
  sourceReliability?: number
  freshnessScore?: number
  corroborationCount?: number
  lifecycleStatus: FieldClaimLifecycle
  reviewerStatus: FieldClaimReview
}

export type CanonicalFieldSelection = {
  fieldName: string
  selectedValue: unknown | null
  selectedClaimId: string | null
  supportingClaims: CandidateFieldClaim[]
  conflictingClaims: CandidateFieldClaim[]
  selectionReason: string
  freshness: number | null
  reviewRequired: boolean
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function fieldSourceReliability(claim: CandidateFieldClaim): number {
  if (typeof claim.sourceReliability === 'number') return clamp(claim.sourceReliability)
  const field = claim.fieldName.toLowerCase()
  const source = claim.source.toLowerCase()

  if (source === 'github') {
    if (['skill', 'profile_url', 'personal_website', 'repository'].includes(field)) return 0.9
    if (['current_company', 'current_title', 'employment'].includes(field)) return 0.4
    return 0.65
  }
  if (source === 'orcid') {
    if (['orcid', 'publication', 'education'].includes(field)) return 0.92
    if (['current_company', 'current_title'].includes(field)) return 0.35
    return 0.7
  }
  if (source === 'openalex' || source === 'semantic_scholar') {
    if (['publication', 'research_affiliation', 'education'].includes(field)) return 0.82
    return 0.55
  }
  if (source === 'npi') {
    if (['canonical_name', 'taxonomy', 'location'].includes(field)) return 0.92
    if (['employment', 'current_company'].includes(field)) return 0.45
    return 0.7
  }
  if (source === 'resume_xray' || claim.sourceType === 'uploaded_document' || claim.sourceType === 'imported_data') {
    if (['employment', 'education', 'current_title', 'current_company'].includes(field)) return 0.78
    return 0.65
  }
  if (source === 'stackoverflow') {
    if (['skill', 'profile_url'].includes(field)) return 0.75
    return 0.55
  }
  if (claim.sourceType === 'authoritative_registry') return 0.9
  if (claim.sourceType === 'review_event') return 0.95
  return 0.5
}

function computedFreshness(claim: CandidateFieldClaim, now: Date): number {
  if (typeof claim.freshnessScore === 'number') return clamp(claim.freshnessScore)
  const timestamp = claim.observedAt ?? claim.retrievedAt
  const observed = Date.parse(timestamp)
  if (!Number.isFinite(observed)) return 0.3
  const ageDays = Math.max(0, (now.getTime() - observed) / 86_400_000)
  return clamp(Math.exp(-ageDays / 730))
}

function claimScore(claim: CandidateFieldClaim, now: Date): number {
  if (claim.lifecycleStatus === 'rejected' || claim.reviewerStatus === 'rejected') return -1
  if (claim.lifecycleStatus === 'superseded') return -0.5

  const reliability = fieldSourceReliability(claim)
  const freshness = computedFreshness(claim, now)
  const corroboration = clamp(Math.log2((claim.corroborationCount ?? 1) + 1) / 3)
  const review = claim.reviewerStatus === 'accepted' ? 1 : claim.reviewerStatus === 'requires_review' ? 0.35 : 0.5
  const conflictPenalty = claim.lifecycleStatus === 'conflicting' ? 0.22 : 0

  return clamp(reliability * 0.42 + freshness * 0.26 + corroboration * 0.17 + review * 0.15 - conflictPenalty)
}

function valueKey(claim: CandidateFieldClaim): string {
  if (claim.normalizedValue) return claim.normalizedValue.trim().toLowerCase()
  return JSON.stringify(claim.value)?.toLowerCase() ?? ''
}

export function selectCanonicalField(
  fieldName: string,
  claims: CandidateFieldClaim[],
  now = new Date(),
): CanonicalFieldSelection {
  const relevant = claims.filter(claim => claim.fieldName === fieldName)
  const eligible = relevant
    .filter(claim => claim.lifecycleStatus !== 'rejected' && claim.reviewerStatus !== 'rejected')
    .map(claim => ({ claim, score: claimScore(claim, now), key: valueKey(claim) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id))

  if (!eligible.length) {
    return {
      fieldName,
      selectedValue: null,
      selectedClaimId: null,
      supportingClaims: [],
      conflictingClaims: relevant,
      selectionReason: 'No active, non-rejected claim is available.',
      freshness: null,
      reviewRequired: relevant.length > 0,
    }
  }

  const selected = eligible[0]
  const supporting = eligible.filter(item => item.key === selected.key).map(item => item.claim)
  const conflicting = eligible.filter(item => item.key !== selected.key).map(item => item.claim)
  const runnerUp = eligible.find(item => item.key !== selected.key)
  const scoreGap = runnerUp ? selected.score - runnerUp.score : 1
  const explicitConflict = conflicting.some(claim =>
    claim.lifecycleStatus === 'conflicting' || claim.reviewerStatus === 'requires_review',
  )
  const reviewRequired = conflicting.length > 0 && (explicitConflict || scoreGap < 0.18)

  const accepted = selected.claim.reviewerStatus === 'accepted'
  const reason = accepted
    ? 'Selected from an explicitly recruiter-accepted claim.'
    : supporting.length > 1
      ? `Selected from ${supporting.length} corroborating claims using field-specific reliability and freshness.`
      : 'Selected using field-specific source reliability, freshness, corroboration, and review state.'

  return {
    fieldName,
    selectedValue: selected.claim.value,
    selectedClaimId: selected.claim.id,
    supportingClaims: supporting,
    conflictingClaims: conflicting,
    selectionReason: reviewRequired ? `${reason} Conflicting claims require recruiter review.` : reason,
    freshness: computedFreshness(selected.claim, now),
    reviewRequired,
  }
}

export function selectCanonicalFields(
  claims: CandidateFieldClaim[],
  now = new Date(),
): Record<string, CanonicalFieldSelection> {
  const fields = [...new Set(claims.map(claim => claim.fieldName))].sort()
  return Object.fromEntries(fields.map(field => [field, selectCanonicalField(field, claims, now)]))
}
