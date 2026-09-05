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

/**
 * Candidate Review Pro now exposes only workflow/provenance dimensions that are
 * directly recorded on the role candidate. Requirement conclusions live in the
 * canonical V32 RequirementAssessment path and are intentionally not recreated
 * here from tags, recruiter notes, or substring matching.
 */
export function candidateEvidenceDimensions(candidate: RoleCandidate, intake: RoleIntake): EvidenceDimension[] {
  const identitySources = [candidate.candidateId ? 'Candidate Graph' : '', candidate.sourceUrl ? 'source link' : '', candidate.source].filter(Boolean)

  return [
    {
      label: 'Location and work mode',
      value: candidate.location || 'Unknown',
      detail: candidate.location
        ? `Recorded candidate location: ${candidate.location}. Role target: ${intake.location || 'Not specified'} · ${intake.workMode}. Confirm commute, relocation, or remote eligibility directly.`
        : 'Candidate location is missing and should be verified before outreach.',
      tone: candidate.location ? 'supported' : 'unknown',
    },
    {
      label: 'Identity provenance',
      value: identitySources.join(' · ') || 'Manual record',
      detail: candidate.candidateId && candidate.sourceUrl
        ? 'Candidate Graph identity and an external source are linked for recruiter review. This is provenance, not a qualification signal.'
        : 'Additional source-linked identity evidence would improve identity review confidence.',
      tone: candidate.candidateId && candidate.sourceUrl ? 'strong' : candidate.candidateId || candidate.sourceUrl ? 'supported' : 'unknown',
    },
    {
      label: 'Evidence review state',
      value: words(candidate.evidenceStatus),
      detail: candidate.evidenceStatus === 'reviewed'
        ? 'A recruiter marked the current evidence set reviewed. Requirement support is evaluated separately from source-linked claims.'
        : candidate.evidenceStatus === 'conflicting'
          ? 'Conflicting evidence must be resolved before presentation or outreach.'
          : candidate.evidenceStatus === 'stale'
            ? 'Evidence freshness needs review.'
            : 'The candidate evidence set has not been reviewed.',
      tone: candidate.evidenceStatus === 'reviewed' ? 'strong' : candidate.evidenceStatus === 'conflicting' || candidate.evidenceStatus === 'stale' ? 'risk' : 'unknown',
    },
    {
      label: 'Contact readiness',
      value: words(candidate.contactStatus),
      detail: candidate.contactStatus === 'verified'
        ? 'A recruiter-confirmed contact method is recorded.'
        : candidate.contactStatus === 'signals_found'
          ? 'Contact signals exist but still require verification.'
          : candidate.contactStatus === 'blocked'
            ? 'Contact research is blocked or restricted.'
            : 'No contact signal has been recorded.',
      tone: candidate.contactStatus === 'verified' ? 'strong' : candidate.contactStatus === 'signals_found' ? 'supported' : candidate.contactStatus === 'blocked' ? 'risk' : 'unknown',
    },
  ]
}
