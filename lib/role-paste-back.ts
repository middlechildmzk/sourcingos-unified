import type { CandidateRecord, SourceProfileRecord } from './candidate-db-v18'
import type { RoleCandidateLinkInput } from './role-candidate-link'

export type RecruiterPasteBackSurface = 'linkedin_recruiter' | 'clearancejobs' | 'resume_profile' | 'other'

export const RECRUITER_PASTE_BACK_SURFACES: Record<RecruiterPasteBackSurface, string> = {
  linkedin_recruiter: 'LinkedIn Recruiter',
  clearancejobs: 'ClearanceJobs',
  resume_profile: 'Resume / profile text',
  other: 'Other recruiter source',
}

function safeHttpUrl(value?: string): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function recruiterPasteBackSourceLabel(
  surface: RecruiterPasteBackSurface,
  laneLabel?: string,
  planRevision?: number,
): string {
  const parts = [RECRUITER_PASTE_BACK_SURFACES[surface]]
  if (laneLabel?.trim()) parts.push(laneLabel.trim())
  if (Number.isInteger(planRevision) && Number(planRevision) > 0) parts.push(`Search Plan v${planRevision}`)
  parts.push('recruiter paste-back')
  return parts.join(' · ')
}

export function candidateImportToRoleLinkInput(input: {
  candidate: CandidateRecord
  sourceProfile?: SourceProfileRecord
  surface: RecruiterPasteBackSurface
  laneLabel?: string
  planRevision?: number
  sourceUrl?: string
}): RoleCandidateLinkInput {
  const { candidate, sourceProfile, surface, laneLabel, planRevision, sourceUrl } = input
  return {
    candidateId: candidate.id,
    entityKind: 'person',
    displayName: candidate.canonicalName || sourceProfile?.displayName || 'Imported candidate',
    headline: candidate.headline || sourceProfile?.headline || '',
    organization: candidate.currentCompany || sourceProfile?.organization || '',
    location: candidate.location || sourceProfile?.location || '',
    source: recruiterPasteBackSourceLabel(surface, laneLabel, planRevision),
    profileUrl: safeHttpUrl(sourceUrl) || safeHttpUrl(sourceProfile?.profileUrl),
    skills: candidate.skills,
    contactSignalCount: candidate.contactSignalIds.length,
  }
}
