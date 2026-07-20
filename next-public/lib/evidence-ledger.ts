export const EVIDENCE_CLASSES = [
  'verified_fact',
  'supported_inference',
  'weak_signal',
  'unknown',
  'stale',
  'conflicting',
] as const

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number]
export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'unknown'
export type ReviewerStatus = 'unreviewed' | 'requires_review' | 'accepted' | 'rejected'
export type PermittedUse = 'research_only' | 'review_only' | 'outreach_draft' | 'blocked'

export type LegacyCandidateDbSnapshot = {
  candidates: Array<{
    id: string
    canonicalName: string
    headline?: string
    location?: string
  }>
  sourceProfiles: Array<{
    id: string
    candidateId?: string
    source: string
    profileUrl?: string
  }>
  evidenceItems: Array<{
    id: string
    candidateId?: string
    sourceProfileId?: string
    source: string
    label: string
    detail: string
    confidence: 'low' | 'medium' | 'high'
    url?: string
    createdAt: string
  }>
  contactSignals: Array<{
    id: string
    candidateId?: string
    sourceProfileId?: string
    type: string
    value: string
    source: string
    confidence: 'low' | 'medium' | 'high'
    verified: boolean
    permissionStatus: 'unknown' | 'candidate_provided' | 'company_owned' | 'do_not_contact'
    createdAt: string
  }>
  openToWorkSignals: Array<{
    id: string
    candidateId?: string
    sourceProfileId?: string
    source: string
    label: string
    detail: string
    confidence: 'low' | 'medium' | 'high'
    requiresReview: boolean
    createdAt: string
  }>
  matchReviews: Array<{
    id: string
    candidateId?: string
    sourceProfileIds: string[]
    proposedCanonicalName: string
    score: number
    reasons: string[]
    conflicts: string[]
    decision: 'pending' | 'confirmed' | 'rejected'
    decidedBy?: string
    decidedAt?: string
    createdAt: string
  }>
}

export type EvidenceClaim = {
  id: string
  candidateId?: string
  sourceProfileId?: string
  fieldName: string
  claimedValue: string
  detail: string
  evidenceClass: EvidenceClass
  baseEvidenceClass: Exclude<EvidenceClass, 'stale'>
  confidenceScore: number
  source: string
  sourceUrl?: string
  sourceType: 'authoritative_registry' | 'public_profile' | 'public_artifact' | 'uploaded_document' | 'imported_data' | 'review_event' | 'unknown'
  retrievedAt: string
  freshnessWindowDays: number
  freshness: FreshnessStatus
  conflictGroup?: string
  reviewerStatus: ReviewerStatus
  permittedUse: PermittedUse
  containsPii: boolean
  notes: string[]
}

export type CandidateEvidenceCard = {
  candidateId: string
  canonicalName: string
  headline?: string
  location?: string
  claims: EvidenceClaim[]
  summary: {
    total: number
    verified: number
    supported: number
    weak: number
    stale: number
    conflicting: number
    requiresReview: number
    blocked: number
  }
}

export type EvidenceLedgerSnapshot = {
  generatedAt: string
  summary: CandidateEvidenceCard['summary'] & {
    candidateCount: number
    unlinkedClaimCount: number
  }
  claims: EvidenceClaim[]
  candidates: CandidateEvidenceCard[]
  principles: string[]
}

const confidenceScores = { low: 35, medium: 60, high: 80 } as const

function sourceTypeFor(source: string): EvidenceClaim['sourceType'] {
  if (source === 'uploaded_resume') return 'uploaded_document'
  if (source === 'csv_import' || source === 'resume_xray') return 'imported_data'
  if (source === 'npi') return 'authoritative_registry'
  if (['github', 'stackoverflow', 'orcid', 'openalex', 'semantic_scholar', 'arxiv', 'pubmed', 'huggingface', 'npm', 'pypi'].includes(source)) {
    return 'public_profile'
  }
  if (source) return 'public_artifact'
  return 'unknown'
}

function fieldNameForLabel(label: string): string {
  const normalized = label.toLowerCase()
  if (normalized.includes('skill')) return 'skills'
  if (normalized.includes('location')) return 'location'
  if (normalized.includes('organization') || normalized.includes('company')) return 'employment.organization'
  if (normalized.includes('title') || normalized.includes('headline')) return 'employment.title'
  if (normalized.includes('education')) return 'education'
  if (normalized.includes('license') || normalized.includes('credential')) return 'credential'
  if (normalized.includes('url')) return 'public_url'
  if (normalized.includes('summary')) return 'profile_summary'
  return `evidence.${normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'claim'}`
}

function baseClassForEvidence(label: string, source: string): EvidenceClaim['baseEvidenceClass'] {
  const normalized = label.toLowerCase()
  if (normalized.includes('public url')) return 'verified_fact'
  if (source === 'npi' && (normalized.includes('identifier') || normalized.includes('registry'))) return 'verified_fact'
  if (normalized.includes('summary') || source === 'uploaded_resume' || source === 'csv_import') return 'supported_inference'
  return 'weak_signal'
}

export function freshnessFor(retrievedAt: string, freshnessWindowDays: number, now = new Date()): FreshnessStatus {
  const retrieved = new Date(retrievedAt).getTime()
  if (!Number.isFinite(retrieved) || freshnessWindowDays <= 0) return 'unknown'
  const ageDays = Math.max(0, now.getTime() - retrieved) / 86_400_000
  if (ageDays > freshnessWindowDays) return 'stale'
  if (ageDays > freshnessWindowDays * 0.75) return 'aging'
  return 'fresh'
}

function applyFreshness(baseEvidenceClass: EvidenceClaim['baseEvidenceClass'], freshness: FreshnessStatus): EvidenceClass {
  if (baseEvidenceClass === 'conflicting') return 'conflicting'
  return freshness === 'stale' ? 'stale' : baseEvidenceClass
}

function resolveCandidateId(
  candidateId: string | undefined,
  sourceProfileId: string | undefined,
  sourceProfileOwners: Map<string, string | undefined>,
): string | undefined {
  return candidateId || (sourceProfileId ? sourceProfileOwners.get(sourceProfileId) : undefined)
}

function emptySummary(): CandidateEvidenceCard['summary'] {
  return { total: 0, verified: 0, supported: 0, weak: 0, stale: 0, conflicting: 0, requiresReview: 0, blocked: 0 }
}

function summarizeClaims(claims: EvidenceClaim[]): CandidateEvidenceCard['summary'] {
  return claims.reduce((summary, claim) => {
    summary.total += 1
    if (claim.evidenceClass === 'verified_fact') summary.verified += 1
    if (claim.evidenceClass === 'supported_inference') summary.supported += 1
    if (claim.evidenceClass === 'weak_signal' || claim.evidenceClass === 'unknown') summary.weak += 1
    if (claim.evidenceClass === 'stale') summary.stale += 1
    if (claim.evidenceClass === 'conflicting') summary.conflicting += 1
    if (claim.reviewerStatus === 'requires_review' || claim.reviewerStatus === 'unreviewed') summary.requiresReview += 1
    if (claim.permittedUse === 'blocked') summary.blocked += 1
    return summary
  }, emptySummary())
}

export function buildEvidenceLedger(
  snapshot: LegacyCandidateDbSnapshot,
  options: { candidateId?: string; now?: Date } = {},
): EvidenceLedgerSnapshot {
  const now = options.now || new Date()
  const sourceProfileOwners = new Map(snapshot.sourceProfiles.map(profile => [profile.id, profile.candidateId]))
  const sourceProfileUrls = new Map(snapshot.sourceProfiles.map(profile => [profile.id, profile.profileUrl]))
  const claims: EvidenceClaim[] = []

  for (const item of snapshot.evidenceItems) {
    const candidateId = resolveCandidateId(item.candidateId, item.sourceProfileId, sourceProfileOwners)
    if (options.candidateId && candidateId !== options.candidateId) continue
    const freshnessWindowDays = item.label.toLowerCase().includes('skill') ? 180 : 120
    const freshness = freshnessFor(item.createdAt, freshnessWindowDays, now)
    const baseEvidenceClass = baseClassForEvidence(item.label, item.source)
    claims.push({
      id: `evidence:${item.id}`,
      candidateId,
      sourceProfileId: item.sourceProfileId,
      fieldName: fieldNameForLabel(item.label),
      claimedValue: item.detail,
      detail: item.detail,
      evidenceClass: applyFreshness(baseEvidenceClass, freshness),
      baseEvidenceClass,
      confidenceScore: confidenceScores[item.confidence],
      source: item.source,
      sourceUrl: item.url || (item.sourceProfileId ? sourceProfileUrls.get(item.sourceProfileId) : undefined),
      sourceType: sourceTypeFor(item.source),
      retrievedAt: item.createdAt,
      freshnessWindowDays,
      freshness,
      reviewerStatus: baseEvidenceClass === 'verified_fact' ? 'unreviewed' : 'requires_review',
      permittedUse: 'research_only',
      containsPii: false,
      notes: baseEvidenceClass === 'verified_fact'
        ? ['Verified means the artifact or URL exists; identity and employment implications still require review.']
        : ['Legacy evidence was adapted into the V19 ledger and has not been independently re-verified.'],
    })
  }

  for (const contact of snapshot.contactSignals) {
    const candidateId = resolveCandidateId(contact.candidateId, contact.sourceProfileId, sourceProfileOwners)
    if (options.candidateId && candidateId !== options.candidateId) continue
    const freshnessWindowDays = 60
    const freshness = freshnessFor(contact.createdAt, freshnessWindowDays, now)
    const baseEvidenceClass: EvidenceClaim['baseEvidenceClass'] = contact.verified ? 'supported_inference' : 'weak_signal'
    const permissionBlocked = contact.permissionStatus === 'do_not_contact'
    claims.push({
      id: `contact:${contact.id}`,
      candidateId,
      sourceProfileId: contact.sourceProfileId,
      fieldName: `contact.${contact.type}`,
      claimedValue: contact.value,
      detail: `Unverified ${contact.type} signal from ${contact.source}.`,
      evidenceClass: applyFreshness(baseEvidenceClass, freshness),
      baseEvidenceClass,
      confidenceScore: contact.verified ? 75 : Math.min(65, confidenceScores[contact.confidence]),
      source: contact.source,
      sourceUrl: contact.sourceProfileId ? sourceProfileUrls.get(contact.sourceProfileId) : undefined,
      sourceType: sourceTypeFor(contact.source),
      retrievedAt: contact.createdAt,
      freshnessWindowDays,
      freshness,
      reviewerStatus: 'requires_review',
      permittedUse: permissionBlocked ? 'blocked' : contact.permissionStatus === 'candidate_provided' ? 'outreach_draft' : 'research_only',
      containsPii: true,
      notes: [
        'A contact signal is not proof of ownership, deliverability, consent, or permission to contact.',
        permissionBlocked ? 'Do-not-contact status blocks outreach use.' : `Permission status: ${contact.permissionStatus}.`,
      ],
    })
  }

  for (const signal of snapshot.openToWorkSignals) {
    const candidateId = resolveCandidateId(signal.candidateId, signal.sourceProfileId, sourceProfileOwners)
    if (options.candidateId && candidateId !== options.candidateId) continue
    const freshnessWindowDays = 30
    const freshness = freshnessFor(signal.createdAt, freshnessWindowDays, now)
    const baseEvidenceClass: EvidenceClaim['baseEvidenceClass'] = 'weak_signal'
    claims.push({
      id: `availability:${signal.id}`,
      candidateId,
      sourceProfileId: signal.sourceProfileId,
      fieldName: 'availability.open_to_work',
      claimedValue: signal.detail,
      detail: signal.detail,
      evidenceClass: applyFreshness(baseEvidenceClass, freshness),
      baseEvidenceClass,
      confidenceScore: Math.min(60, confidenceScores[signal.confidence]),
      source: signal.source,
      sourceUrl: signal.sourceProfileId ? sourceProfileUrls.get(signal.sourceProfileId) : undefined,
      sourceType: sourceTypeFor(signal.source),
      retrievedAt: signal.createdAt,
      freshnessWindowDays,
      freshness,
      reviewerStatus: 'requires_review',
      permittedUse: 'review_only',
      containsPii: false,
      notes: ['Open-to-work and availability language is a time-sensitive signal, never a verified current claim.'],
    })
  }

  for (const review of snapshot.matchReviews) {
    const candidateId = review.candidateId || review.sourceProfileIds.map(id => sourceProfileOwners.get(id)).find(Boolean)
    if (options.candidateId && candidateId !== options.candidateId) continue
    review.conflicts.forEach((conflict, index) => {
      claims.push({
        id: `conflict:${review.id}:${index}`,
        candidateId,
        sourceProfileId: review.sourceProfileIds[0],
        fieldName: 'identity.conflict',
        claimedValue: conflict,
        detail: conflict,
        evidenceClass: 'conflicting',
        baseEvidenceClass: 'conflicting',
        confidenceScore: Math.max(10, Math.min(90, review.score)),
        source: 'identity_match_review',
        sourceType: 'review_event',
        retrievedAt: review.createdAt,
        freshnessWindowDays: 365,
        freshness: freshnessFor(review.createdAt, 365, now),
        conflictGroup: review.id,
        reviewerStatus: review.decision === 'confirmed' ? 'accepted' : review.decision === 'rejected' ? 'rejected' : 'requires_review',
        permittedUse: 'review_only',
        containsPii: false,
        notes: ['Conflicting evidence is preserved rather than overwritten. Identity merge remains recruiter-controlled.'],
      })
    })
  }

  claims.sort((a, b) => {
    const riskOrder: Record<EvidenceClass, number> = { conflicting: 0, stale: 1, weak_signal: 2, unknown: 3, supported_inference: 4, verified_fact: 5 }
    return riskOrder[a.evidenceClass] - riskOrder[b.evidenceClass] || b.retrievedAt.localeCompare(a.retrievedAt)
  })

  const candidateCards = snapshot.candidates
    .filter(candidate => !options.candidateId || candidate.id === options.candidateId)
    .map(candidate => {
      const candidateClaims = claims.filter(claim => claim.candidateId === candidate.id)
      return {
        candidateId: candidate.id,
        canonicalName: candidate.canonicalName,
        headline: candidate.headline,
        location: candidate.location,
        claims: candidateClaims,
        summary: summarizeClaims(candidateClaims),
      }
    })
    .sort((a, b) => b.summary.conflicting + b.summary.stale + b.summary.requiresReview - (a.summary.conflicting + a.summary.stale + a.summary.requiresReview))

  const totalSummary = summarizeClaims(claims)
  return {
    generatedAt: now.toISOString(),
    summary: {
      ...totalSummary,
      candidateCount: candidateCards.length,
      unlinkedClaimCount: claims.filter(claim => !claim.candidateId).length,
    },
    claims,
    candidates: candidateCards,
    principles: [
      'Verified Fact means the specific claim is directly supported; it does not verify unrelated identity, employment, clearance, availability, or consent conclusions.',
      'Supported Inference requires corroborating evidence and human review before consequential use.',
      'Weak, stale, unknown, and conflicting claims remain visible and cannot silently become facts.',
      'Contact and availability signals never imply consent or permission to contact.',
      'Identity conflicts and merges remain recruiter-controlled and reversible.',
    ],
  }
}
