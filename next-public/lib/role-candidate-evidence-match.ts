import type { CandidateDossier, CandidateDossierEvidence } from './candidate-dossier'
import type { RoleCandidate, RoleWorkspace } from './role-workspace'

export type RequirementEvidenceState = 'supported' | 'contradicted' | 'needs_verification' | 'unknown'
export type RequirementTier = 'must_have' | 'nice_to_have' | 'clearance'
export type EvidenceProvenanceClass = 'authoritative_registry' | 'public_evidence' | 'candidate_stated'
export type ReasoningBasis = 'source_evidence' | 'recruiter_context' | 'unknown'

export type RequirementEvidenceReference = {
  id: string
  label: string
  source: string
  provenanceClass: EvidenceProvenanceClass
  confidence: string
  url?: string
  excerpt: string
}

export type RequirementEvidenceMatch = {
  requirement: string
  tier: RequirementTier
  state: RequirementEvidenceState
  evidence: RequirementEvidenceReference[]
  recruiterContext: string[]
  explanation: string
}

export type CandidateReasoningPoint = {
  title: string
  detail: string
  requirement?: string
  evidenceIds: string[]
  basis: ReasoningBasis
}

export type CandidateRoleEvidenceAnalysis = {
  requirements: RequirementEvidenceMatch[]
  caseFor: CandidateReasoningPoint[]
  caseAgainst: CandidateReasoningPoint[]
  unresolved: CandidateReasoningPoint[]
  summary: string
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'by', 'as', 'at',
  'experience', 'experienced', 'knowledge', 'skill', 'skills', 'strong', 'proficient', 'proficiency',
  'required', 'requirement', 'preferred', 'plus', 'ability', 'years', 'year', 'minimum', 'demonstrated',
])

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function coreTokens(value: string): string[] {
  return Array.from(new Set(normalize(value).split(' ').filter(token => token.length >= 2 && !STOP_WORDS.has(token))))
}

function evidenceText(item: CandidateDossierEvidence): string {
  return normalize([item.label, item.detail, item.source].filter(Boolean).join(' '))
}

function textMatchesRequirement(text: string, requirement: string): boolean {
  const normalizedText = normalize(text)
  const target = normalize(requirement)
  if (!normalizedText || !target) return false
  if (` ${normalizedText} `.includes(` ${target} `)) return true

  const tokens = coreTokens(requirement)
  if (!tokens.length) return false
  if (tokens.length === 1) return ` ${normalizedText} `.includes(` ${tokens[0]} `)

  const hits = tokens.filter(token => ` ${normalizedText} `.includes(` ${token} `)).length
  const requiredHits = tokens.length <= 3 ? tokens.length : Math.ceil(tokens.length * 0.75)
  return hits >= requiredHits
}

function hasExplicitNegation(text: string, requirement: string): boolean {
  const normalizedText = normalize(text)
  const tokens = coreTokens(requirement)
  if (!normalizedText || !tokens.length) return false

  return tokens.some(token => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const before = new RegExp(`\\b(?:no|not|without|lacks?|lacking|never|none)\\b.{0,45}\\b${escaped}\\b`, 'i')
    const after = new RegExp(`\\b${escaped}\\b.{0,35}\\b(?:absent|missing|not required|not used)\\b`, 'i')
    return before.test(normalizedText) || after.test(normalizedText)
  })
}

function provenanceClass(source?: string): EvidenceProvenanceClass {
  const value = normalize(source || '')
  if (/\b(?:npi|cms|registry|finra|faa)\b/.test(value)) return 'authoritative_registry'
  if (/\b(?:resume|uploaded resume|profile text|paste back|recruiter provided|candidate stated)\b/.test(value)) return 'candidate_stated'
  return 'public_evidence'
}

function evidenceReference(item: CandidateDossierEvidence): RequirementEvidenceReference {
  const excerpt = (item.detail || item.label || 'Source-linked evidence').trim().replace(/\s+/g, ' ').slice(0, 240)
  return {
    id: item.id,
    label: item.label || 'Evidence item',
    source: item.source || 'public source',
    provenanceClass: provenanceClass(item.source),
    confidence: item.confidence || 'unknown',
    url: item.url,
    excerpt,
  }
}

function recruiterContextFor(requirement: string, candidate: RoleCandidate): string[] {
  return [...candidate.fitReasons, ...candidate.concerns]
    .filter(value => textMatchesRequirement(value, requirement))
    .map(value => value.trim())
    .filter(Boolean)
}

function buildRequirementMatch(
  requirement: string,
  tier: RequirementTier,
  dossier: CandidateDossier,
  candidate: RoleCandidate,
): RequirementEvidenceMatch {
  const matchingEvidence = (dossier.evidence || []).filter(item => textMatchesRequirement(evidenceText(item), requirement))
  const evidence = matchingEvidence.map(evidenceReference)
  const recruiterContext = recruiterContextFor(requirement, candidate)
  const negativeEvidence = matchingEvidence.filter(item => hasExplicitNegation(evidenceText(item), requirement))
  const positiveEvidence = matchingEvidence.filter(item => !negativeEvidence.includes(item))
  const hasPublicSupport = positiveEvidence.some(item => provenanceClass(item.source) !== 'candidate_stated')
  const hasCandidateStatedSupport = positiveEvidence.some(item => provenanceClass(item.source) === 'candidate_stated')

  if (tier === 'clearance') {
    return {
      requirement,
      tier,
      state: evidence.length || recruiterContext.length ? 'needs_verification' : 'unknown',
      evidence,
      recruiterContext,
      explanation: evidence.length || recruiterContext.length
        ? 'Clearance-related breadcrumbs are visible, but SourcingOS never treats public or candidate-stated clearance language as verified clearance.'
        : 'No clearance breadcrumb is attached to this dossier. Confirm clearance only through the appropriate authorized process.',
    }
  }

  if (negativeEvidence.length && !positiveEvidence.length) {
    return {
      requirement,
      tier,
      state: 'contradicted',
      evidence,
      recruiterContext,
      explanation: 'Source-linked evidence contains an explicit negative statement about this requirement. Review the cited source before relying on the contradiction.',
    }
  }

  if (hasPublicSupport) {
    return {
      requirement,
      tier,
      state: negativeEvidence.length ? 'needs_verification' : 'supported',
      evidence,
      recruiterContext,
      explanation: negativeEvidence.length
        ? 'The dossier contains both supporting and conflicting source-linked evidence. Resolve the conflict before relying on this requirement.'
        : 'One or more source-linked public or registry evidence items support this requirement. Supported does not mean independently verified.',
    }
  }

  if (hasCandidateStatedSupport) {
    return {
      requirement,
      tier,
      state: 'needs_verification',
      evidence,
      recruiterContext,
      explanation: 'The only matching evidence is candidate-stated or recruiter-provided material. Verify it against an appropriate source before treating it as established.',
    }
  }

  if (recruiterContext.length) {
    return {
      requirement,
      tier,
      state: 'needs_verification',
      evidence,
      recruiterContext,
      explanation: 'Recruiter-authored review context mentions this requirement, but no source-linked evidence supports it yet.',
    }
  }

  return {
    requirement,
    tier,
    state: 'unknown',
    evidence,
    recruiterContext,
    explanation: 'No source-linked evidence currently supports or contradicts this requirement.',
  }
}

function pointFromMatch(match: RequirementEvidenceMatch): CandidateReasoningPoint {
  const basis: ReasoningBasis = match.evidence.length ? 'source_evidence' : match.recruiterContext.length ? 'recruiter_context' : 'unknown'
  return {
    title: match.requirement,
    detail: match.explanation,
    requirement: match.requirement,
    evidenceIds: match.evidence.map(item => item.id),
    basis,
  }
}

function uniquePoints(points: CandidateReasoningPoint[]): CandidateReasoningPoint[] {
  const seen = new Set<string>()
  return points.filter(point => {
    const key = `${point.basis}:${normalize(point.title)}:${normalize(point.detail)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildCandidateRoleEvidenceAnalysis(
  role: RoleWorkspace,
  candidate: RoleCandidate,
  dossier: CandidateDossier,
): CandidateRoleEvidenceAnalysis {
  const requirements: RequirementEvidenceMatch[] = [
    ...role.intake.mustHaves.map(requirement => buildRequirementMatch(requirement, 'must_have', dossier, candidate)),
    ...role.intake.niceToHaves.map(requirement => buildRequirementMatch(requirement, 'nice_to_have', dossier, candidate)),
    ...(role.intake.clearance && role.intake.clearance !== 'Not specified'
      ? [buildRequirementMatch(role.intake.clearance, 'clearance', dossier, candidate)]
      : []),
  ]

  const caseFor = requirements
    .filter(match => match.state === 'supported')
    .map(pointFromMatch)

  const caseAgainst = [
    ...requirements.filter(match => match.state === 'contradicted').map(pointFromMatch),
    ...candidate.concerns.map(concern => ({
      title: 'Recruiter concern',
      detail: concern,
      evidenceIds: [],
      basis: 'recruiter_context' as const,
    })),
  ]

  const unresolved = [
    ...requirements
      .filter(match => match.state === 'needs_verification' || (match.tier === 'must_have' && match.state === 'unknown') || match.tier === 'clearance')
      .map(pointFromMatch),
    ...(candidate.evidenceStatus === 'conflicting'
      ? [{ title: 'Conflicting dossier evidence', detail: 'Resolve conflicting evidence before presenting this person for the role.', evidenceIds: [], basis: 'unknown' as const }]
      : []),
    ...(candidate.evidenceStatus === 'stale'
      ? [{ title: 'Stale dossier evidence', detail: 'Refresh stale evidence before relying on it for this role.', evidenceIds: [], basis: 'unknown' as const }]
      : []),
  ]

  const mustHaves = requirements.filter(match => match.tier === 'must_have')
  const supported = mustHaves.filter(match => match.state === 'supported').length
  const contradicted = mustHaves.filter(match => match.state === 'contradicted').length
  const unresolvedCount = mustHaves.length - supported - contradicted

  return {
    requirements,
    caseFor: uniquePoints(caseFor),
    caseAgainst: uniquePoints(caseAgainst),
    unresolved: uniquePoints(unresolved),
    summary: mustHaves.length
      ? `${supported} of ${mustHaves.length} must-have requirements have source-linked support; ${contradicted} are explicitly contradicted and ${unresolvedCount} remain unresolved. This is evidence coverage, not a fit score.`
      : 'No explicit must-have requirements are configured for this role. Add recruiter-approved requirements before evaluating evidence coverage.',
  }
}
