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

export function recruiterPasteBackSourceLabel(surface: RecruiterPasteBackSurface, laneLabel?: string): string {
  const base = RECRUITER_PASTE_BACK_SURFACES[surface]
  return laneLabel?.trim() ? `${base} · ${laneLabel.trim()} · recruiter paste-back` : `${base} · recruiter paste-back`
}

export function candidateImportToRoleLinkInput(input: {
  candidate: CandidateRecord
  sourceProfile?: SourceProfileRecord
  surface: RecruiterPasteBackSurface
  laneLabel?: string
  sourceUrl?: string
}): RoleCandidateLinkInput {
  const { candidate, sourceProfile, surface, laneLabel, sourceUrl } = input
  return {
    candidateId: candidate.id,
    entityKind: 'person',
    displayName: candidate.canonicalName || sourceProfile?.displayName || 'Imported candidate',
    headline: candidate.headline || sourceProfile?.headline || '',
    organization: candidate.currentCompany || sourceProfile?.organization || '',
    location: candidate.location || sourceProfile?.location || '',
    source: recruiterPasteBackSourceLabel(surface, laneLabel),
    profileUrl: safeHttpUrl(sourceUrl) || safeHttpUrl(sourceProfile?.profileUrl),
    skills: candidate.skills,
    contactSignalCount: candidate.contactSignalIds.length,
  }
}
