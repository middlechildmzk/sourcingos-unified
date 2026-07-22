import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'

export type EvidenceTone = 'strong' | 'supported' | 'unknown' | 'risk'

export type EvidenceDimension = {
  label: string
  value: string
  detail: string
  tone: EvidenceTone
}

function words(value: string): string {
  return value.replaceAll('_', ' ')
}

function candidateText(candidate: RoleCandidate): string {
  return [
    candidate.name,
    candidate.headline,
    candidate.company,
    candidate.location,
    candidate.source,
    ...candidate.tags,
    ...candidate.fitReasons,
    ...candidate.concerns,
  ].join(' ').toLowerCase()
}

export function matchedRoleSignals(candidate: RoleCandidate, terms: string[]): string[] {
  const haystack = candidateText(candidate)
  return terms.filter(term => term.trim() && haystack.includes(term.trim().toLowerCase())).slice(0, 8)
}

export function candidateReviewScore(candidate: RoleCandidate, intake: RoleIntake): number {
  const mustHaveMatches = matchedRoleSignals(candidate, intake.mustHaves).length
  const mustHaveBase = intake.mustHaves.length ? Math.round((mustHaveMatches / intake.mustHaves.length) * 45) : 12
  const evidence = candidate.evidenceStatus === 'reviewed' ? 20 : candidate.evidenceStatus === 'conflicting' ? 4 : candidate.evidenceStatus === 'stale' ? 7 : 10
  const decision = candidate.fitDecision === 'strong_fit' ? 20 : candidate.fitDecision === 'possible_fit' ? 13 : candidate.fitDecision === 'not_fit' ? 0 : 7
  const identity = candidate.candidateId && candidate.sourceUrl ? 10 : candidate.candidateId || candidate.sourceUrl ? 6 : 2
  const contact = candidate.contactStatus === 'verified' ? 5 : candidate.contactStatus === 'signals_found' ? 3 : 0
  return Math.max(0, Math.min(100, mustHaveBase + evidence + decision + identity + contact))
}

export function candidateEvidenceDimensions(candidate: RoleCandidate, intake: RoleIntake): EvidenceDimension[] {
  const mustHaveMatches = matchedRoleSignals(candidate, intake.mustHaves)
  const adjacentMatches = matchedRoleSignals(candidate, intake.adjacentBackgrounds)
  const seniorityMatches = matchedRoleSignals(candidate, ['director', 'head', 'vice president', 'vp', 'manager', 'lead', 'principal', 'senior', 'program owner'])
  const identitySources = [candidate.candidateId ? 'Candidate Graph' : '', candidate.sourceUrl ? 'source link' : '', candidate.source].filter(Boolean)

  return [
    {
      label: 'Required experience',
      value: intake.mustHaves.length ? `${mustHaveMatches.length}/${intake.mustHaves.length} signals` : 'Not calibrated',
      detail: mustHaveMatches.length ? mustHaveMatches.join(', ') : 'No required-skill signal is currently recorded on this role candidate.',
      tone: !intake.mustHaves.length ? 'unknown' : mustHaveMatches.length >= Math.max(2, Math.ceil(intake.mustHaves.length * 0.6)) ? 'strong' : mustHaveMatches.length ? 'supported' : 'unknown',
    },
    {
      label: 'Scope and seniority',
      value: seniorityMatches.length ? seniorityMatches.join(', ') : 'Needs evidence',
      detail: seniorityMatches.length ? 'Seniority language appears in the candidate record. Confirm actual ownership and team or program scale.' : 'No explicit leadership or seniority signal is recorded yet.',
      tone: seniorityMatches.length ? 'supported' : 'unknown',
    },
    {
      label: 'Adjacent background',
      value: adjacentMatches.length ? adjacentMatches.join(', ') : 'No recorded match',
      detail: adjacentMatches.length ? 'Matches an approved transferable background. This is a sourcing signal, not a verified qualification.' : 'No approved adjacent-background signal is currently visible.',
      tone: adjacentMatches.length ? 'supported' : 'unknown',
    },
    {
      label: 'Location and work mode',
      value: candidate.location || 'Unknown',
      detail: candidate.location ? `Role target: ${intake.location || 'Not specified'} · ${intake.workMode}. Confirm commute, relocation, or remote eligibility.` : 'Candidate location is missing and should be verified before outreach.',
      tone: candidate.location ? 'supported' : 'unknown',
    },
    {
      label: 'Identity provenance',
      value: identitySources.join(' · ') || 'Manual record',
      detail: candidate.candidateId && candidate.sourceUrl ? 'Candidate Graph identity and an external source are linked for review.' : 'Additional source-linked identity evidence would improve confidence.',
      tone: candidate.candidateId && candidate.sourceUrl ? 'strong' : candidate.candidateId || candidate.sourceUrl ? 'supported' : 'unknown',
    },
    {
      label: 'Evidence state',
      value: words(candidate.evidenceStatus),
      detail: candidate.evidenceStatus === 'reviewed' ? 'A recruiter marked the current evidence set reviewed.' : candidate.evidenceStatus === 'conflicting' ? 'Conflicting evidence must be resolved before presentation or outreach.' : candidate.evidenceStatus === 'stale' ? 'Evidence freshness needs review.' : 'The candidate evidence set has not been reviewed.',
      tone: candidate.evidenceStatus === 'reviewed' ? 'strong' : candidate.evidenceStatus === 'conflicting' || candidate.evidenceStatus === 'stale' ? 'risk' : 'unknown',
    },
    {
      label: 'Contact readiness',
      value: words(candidate.contactStatus),
      detail: candidate.contactStatus === 'verified' ? 'A recruiter-confirmed contact method is recorded.' : candidate.contactStatus === 'signals_found' ? 'Contact signals exist but still require verification.' : candidate.contactStatus === 'blocked' ? 'Contact research is blocked or restricted.' : 'No contact signal has been recorded.',
      tone: candidate.contactStatus === 'verified' ? 'strong' : candidate.contactStatus === 'signals_found' ? 'supported' : candidate.contactStatus === 'blocked' ? 'risk' : 'unknown',
    },
  ]
}
