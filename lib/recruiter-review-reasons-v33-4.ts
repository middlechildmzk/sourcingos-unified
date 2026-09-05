export const NEGATIVE_REVIEW_REASONS = [
  { id: 'too_hands_on', label: 'Too hands-on' },
  { id: 'too_junior', label: 'Too junior' },
  { id: 'too_senior', label: 'Too senior' },
  { id: 'wrong_domain', label: 'Wrong domain' },
  { id: 'location_work_mode', label: 'Location / work mode' },
  { id: 'explicit_requirement_conflict', label: 'Requirement conflict' },
  { id: 'other', label: 'Other' },
] as const

export type NegativeReviewReasonCode = (typeof NEGATIVE_REVIEW_REASONS)[number]['id']
export type ReviewDecision = 'strong_fit' | 'possible_fit' | 'not_fit'

export const RECRUITER_REVIEW_NOTE_PREFIX = 'Recruiter note: '

const structuredReasonLabels = new Set<string>(NEGATIVE_REVIEW_REASONS.map(reason => reason.label))

export function reviewReasonLabel(code: NegativeReviewReasonCode | ''): string {
  return NEGATIVE_REVIEW_REASONS.find(reason => reason.id === code)?.label || ''
}

export function isStructuredNegativeReviewReason(value: string): boolean {
  return structuredReasonLabels.has(value.trim())
}

export function concernsAfterReviewDecision(
  existing: string[],
  decision: ReviewDecision,
  reasonCode: NegativeReviewReasonCode | '' = '',
  detail = ''
): string[] {
  const retained = existing.filter(value => {
    const normalized = value.trim()
    return normalized && !isStructuredNegativeReviewReason(normalized) && !normalized.startsWith(RECRUITER_REVIEW_NOTE_PREFIX)
  })
  if (decision !== 'not_fit') return Array.from(new Set(retained)).slice(0, 20)

  const label = reviewReasonLabel(reasonCode)
  if (!label) return Array.from(new Set(retained)).slice(0, 20)
  const note = detail.trim()
  return Array.from(new Set([
    label,
    ...(note ? [`${RECRUITER_REVIEW_NOTE_PREFIX}${note}`] : []),
    ...retained,
  ])).slice(0, 20)
}
