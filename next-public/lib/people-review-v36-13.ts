import type { UniversalPeopleProviderRequestV36_9 } from './universal-people-search-v36-9'

export type PeopleReviewObservationV36_13 = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: Array<{ kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'; url: string }>
  providerExplanation?: string
}

export type PeopleEvidenceCriterionV36_13 = {
  id: string
  label: string
  kind: 'title' | 'company' | 'skill' | 'location' | 'clearance' | 'experience' | 'requirement'
  mustHave: boolean
  status: 'observed' | 'not_evidenced'
  evidence?: string
}

export type PeopleEvidenceCoverageV36_13 = {
  criteria: PeopleEvidenceCriterionV36_13[]
  observedCount: number
  totalCount: number
  mustHaveObserved: number
  mustHaveTotal: number
}

export type ExplicitPeopleFiltersV36_13 = {
  company?: string
  title?: string
  location?: string
  skills?: string
}

export type ContactSignalForReviewV36_13 = {
  type: string
  channelKind?: string
  value: string
  sourceProvider: string
  confidence: 'low' | 'medium' | 'high'
  verified?: boolean
  permissionStatus?: string
  ownershipConfidence?: string
  deliverability?: string
}

export type ContactReviewChannelV36_13 = {
  primary?: ContactSignalForReviewV36_13
  alternatives: ContactSignalForReviewV36_13[]
}

export type ContactReviewSummaryV36_13 = {
  workEmail: ContactReviewChannelV36_13
  personalEmail: ContactReviewChannelV36_13
  otherEmail: ContactReviewChannelV36_13
  mobilePhone: ContactReviewChannelV36_13
  otherPhone: ContactReviewChannelV36_13
  linkedin: ContactReviewChannelV36_13
  github: ContactReviewChannelV36_13
  otherProfiles: ContactReviewChannelV36_13
  rejected: ContactSignalForReviewV36_13[]
}

function clean(value?: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalized(value?: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsPhrase(haystack: string, needle: string): boolean {
  const h = normalized(haystack)
  const n = normalized(needle)
  if (!h || !n) return false
  if (h.includes(n)) return true
  const tokens = n.split(' ').filter(token => token.length > 2)
  return tokens.length > 1 && tokens.every(token => h.includes(token))
}

function candidateEvidenceText(observation: PeopleReviewObservationV36_13): string {
  // Deliberately excludes providerExplanation/provider retrieval rationale. Retrieval
  // context can explain why a source returned a record, but it is not candidate evidence.
  return [
    observation.currentTitle,
    observation.headline,
    observation.currentEmployer,
    observation.location,
    ...(observation.skills || []),
  ].filter(Boolean).join(' · ')
}

function clearanceObserved(requirement: string, evidence: string): boolean {
  const target = normalized(requirement)
  const text = normalized(evidence)
  const hasTsSci = /\bts\s*\/?\s*sci\b|\btop secret\s*\/?\s*sci\b/.test(text)
  const hasTopSecret = hasTsSci || /\btop secret\b|\bts clearance\b/.test(text)
  const hasSecret = hasTopSecret || /\bsecret clearance\b|\bsecret\b/.test(text)
  if (/ts\s*\/?\s*sci|top secret/.test(target)) return hasTopSecret
  if (/secret/.test(target)) return hasSecret
  if (/public trust/.test(target)) return /\bpublic trust\b/.test(text)
  if (/confidential/.test(target)) return /\bconfidential\b/.test(text)
  return containsPhrase(text, target)
}

function requirementKind(label: string): PeopleEvidenceCriterionV36_13['kind'] {
  const value = normalized(label)
  if (value.startsWith('current or relevant title')) return 'title'
  if (value.startsWith('current or relevant employer')) return 'company'
  if (/\b(clearance|secret|ts\/?sci|top secret|public trust|confidential)\b/.test(value)) return 'clearance'
  if (/\b(year|years|yrs|experience)\b/.test(value)) return 'experience'
  return 'requirement'
}

function criterionObserved(
  observation: PeopleReviewObservationV36_13,
  kind: PeopleEvidenceCriterionV36_13['kind'],
  label: string,
): { observed: boolean; evidence?: string } {
  const title = [observation.currentTitle, observation.headline].filter(Boolean).join(' · ')
  const employer = clean(observation.currentEmployer)
  const location = clean(observation.location)
  const skills = (observation.skills || []).join(' · ')
  const full = candidateEvidenceText(observation)
  const stripped = label.replace(/^Current or relevant (?:title|employer):\s*/i, '')

  if (kind === 'title') return { observed: containsPhrase(title, stripped), evidence: title || undefined }
  if (kind === 'company') return { observed: containsPhrase(employer, stripped), evidence: employer || undefined }
  if (kind === 'location') return { observed: containsPhrase(location, label), evidence: location || undefined }
  if (kind === 'skill') return { observed: containsPhrase([skills, title].join(' · '), label), evidence: skills || title || undefined }
  if (kind === 'clearance') {
    const clearanceEvidence = [title, skills].filter(Boolean).join(' · ')
    const observed = clearanceObserved(label, clearanceEvidence)
    return { observed, evidence: observed ? clearanceEvidence : undefined }
  }
  if (kind === 'experience') {
    // Thin search observations do not carry normalized employment chronology/dates.
    // Never infer years of experience from title, skills, or provider retrieval rationale.
    return { observed: false }
  }
  return { observed: containsPhrase(full, label), evidence: full || undefined }
}

function semanticCriterionKey(label: string): string {
  return normalized(label.replace(/^Current or relevant (?:title|employer):\s*/i, ''))
}

function pushCriterion(
  target: Array<{ label: string; kind: PeopleEvidenceCriterionV36_13['kind']; mustHave: boolean }>,
  item: { label: string; kind: PeopleEvidenceCriterionV36_13['kind']; mustHave: boolean },
) {
  const key = semanticCriterionKey(item.label)
  if (!item.label || !key) return
  const existing = target.find(candidate => semanticCriterionKey(candidate.label) === key)
  if (existing) {
    // Keep the first, more semantically specific parser classification but never
    // lose a must-have boundary when the same criterion is repeated elsewhere.
    existing.mustHave = existing.mustHave || item.mustHave
    return
  }
  target.push(item)
}

function splitFilterValues(value?: string): string[] {
  return clean(value).split(/[,;|]+/).map(item => item.trim()).filter(Boolean)
}

export function observationPassesExplicitFiltersV36_13(
  observation: PeopleReviewObservationV36_13,
  filters: ExplicitPeopleFiltersV36_13 = {},
): boolean {
  const company = clean(filters.company)
  const title = clean(filters.title)
  const location = clean(filters.location)
  const skills = splitFilterValues(filters.skills)

  if (company && !containsPhrase(observation.currentEmployer || '', company)) return false
  if (title && !containsPhrase([observation.currentTitle, observation.headline].filter(Boolean).join(' · '), title)) return false
  // Explicit recruiter location is a constraint. Missing location does not pass.
  if (location && !containsPhrase(observation.location || '', location)) return false
  if (skills.length) {
    const skillEvidence = [(observation.skills || []).join(' · '), observation.currentTitle, observation.headline].filter(Boolean).join(' · ')
    if (!skills.every(skill => containsPhrase(skillEvidence, skill))) return false
  }
  return true
}

export function evidenceCoverageForObservationV36_13(
  observation: PeopleReviewObservationV36_13,
  request?: UniversalPeopleProviderRequestV36_9,
): PeopleEvidenceCoverageV36_13 {
  if (!request) return { criteria: [], observedCount: 0, totalCount: 0, mustHaveObserved: 0, mustHaveTotal: 0 }

  const drafts: Array<{ label: string; kind: PeopleEvidenceCriterionV36_13['kind']; mustHave: boolean }> = []
  for (const item of request.requirements || []) {
    pushCriterion(drafts, { label: clean(item.text), kind: requirementKind(item.text), mustHave: Boolean(item.mustHave) })
  }
  for (const value of request.skills || []) pushCriterion(drafts, { label: clean(value), kind: 'skill', mustHave: false })
  for (const value of request.locations || []) pushCriterion(drafts, { label: clean(value), kind: 'location', mustHave: false })
  for (const value of request.titles || []) pushCriterion(drafts, { label: clean(value), kind: 'title', mustHave: false })
  for (const value of request.companies || []) pushCriterion(drafts, { label: clean(value), kind: 'company', mustHave: false })

  const criteria = drafts.slice(0, 18).map((draft, index) => {
    const result = criterionObserved(observation, draft.kind, draft.label)
    return {
      id: `${draft.kind}-${index}-${semanticCriterionKey(draft.label).replace(/\s+/g, '-')}`,
      label: draft.label,
      kind: draft.kind,
      mustHave: draft.mustHave,
      status: result.observed ? 'observed' as const : 'not_evidenced' as const,
      ...(result.observed && result.evidence ? { evidence: result.evidence } : {}),
    }
  })

  return {
    criteria,
    observedCount: criteria.filter(item => item.status === 'observed').length,
    totalCount: criteria.length,
    mustHaveObserved: criteria.filter(item => item.mustHave && item.status === 'observed').length,
    mustHaveTotal: criteria.filter(item => item.mustHave).length,
  }
}

export function orderObservationsByEvidenceV36_13<T extends PeopleReviewObservationV36_13>(
  observations: T[],
  request?: UniversalPeopleProviderRequestV36_9,
): T[] {
  return observations
    .map((observation, index) => ({ observation, index, coverage: evidenceCoverageForObservationV36_13(observation, request) }))
    .sort((a, b) => {
      if (b.coverage.mustHaveObserved !== a.coverage.mustHaveObserved) return b.coverage.mustHaveObserved - a.coverage.mustHaveObserved
      if (b.coverage.observedCount !== a.coverage.observedCount) return b.coverage.observedCount - a.coverage.observedCount
      return a.index - b.index
    })
    .map(item => item.observation)
}

function signalRank(signal: ContactSignalForReviewV36_13): number {
  const deliverability = ({ verified: 60, valid: 50, accept_all: 18, unknown: 0, risky: -30, invalid: -200, disconnected: -200 } as Record<string, number>)[signal.deliverability || 'unknown'] ?? 0
  const ownership = ({ deterministic: 55, strong: 40, moderate: 22, weak: 4, unknown: 0 } as Record<string, number>)[signal.ownershipConfidence || 'unknown'] ?? 0
  const confidence = signal.confidence === 'high' ? 24 : signal.confidence === 'medium' ? 12 : 0
  const verified = signal.verified ? 35 : 0
  return deliverability + ownership + confidence + verified
}

function host(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function channelForSignal(signal: ContactSignalForReviewV36_13): keyof Omit<ContactReviewSummaryV36_13, 'rejected'> | 'rejected' {
  if (signal.deliverability === 'invalid' || signal.deliverability === 'disconnected') return 'rejected'
  if (signal.type === 'email') {
    if (signal.channelKind === 'work_email') return 'workEmail'
    if (signal.channelKind === 'personal_email') return 'personalEmail'
    return 'otherEmail'
  }
  if (signal.type === 'phone') return signal.channelKind === 'mobile_phone' ? 'mobilePhone' : 'otherPhone'
  if (signal.type === 'profile_url' || signal.type === 'social_url') {
    const hostname = host(signal.value)
    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return 'linkedin'
    if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'github'
    return 'otherProfiles'
  }
  return 'otherProfiles'
}

function blankChannel(): ContactReviewChannelV36_13 {
  return { alternatives: [] }
}

export function summarizeContactSignalsV36_13(signals: ContactSignalForReviewV36_13[] = []): ContactReviewSummaryV36_13 {
  const summary: ContactReviewSummaryV36_13 = {
    workEmail: blankChannel(),
    personalEmail: blankChannel(),
    otherEmail: blankChannel(),
    mobilePhone: blankChannel(),
    otherPhone: blankChannel(),
    linkedin: blankChannel(),
    github: blankChannel(),
    otherProfiles: blankChannel(),
    rejected: [],
  }

  const deduped = Array.from(new Map(signals.filter(signal => clean(signal.value)).map(signal => [`${signal.type}:${normalized(signal.value)}:${signal.sourceProvider}`, signal])).values())
  const grouped = new Map<keyof Omit<ContactReviewSummaryV36_13, 'rejected'>, ContactSignalForReviewV36_13[]>()

  for (const signal of deduped) {
    const channel = channelForSignal(signal)
    if (channel === 'rejected') {
      summary.rejected.push(signal)
      continue
    }
    grouped.set(channel, [...(grouped.get(channel) || []), signal])
  }

  for (const [channel, values] of grouped.entries()) {
    const sorted = [...values].sort((a, b) => signalRank(b) - signalRank(a))
    summary[channel] = { primary: sorted[0], alternatives: sorted.slice(1) }
  }

  return summary
}

export function bestPhoneChannelV36_13(summary: ContactReviewSummaryV36_13): ContactReviewChannelV36_13 {
  return summary.mobilePhone.primary ? summary.mobilePhone : summary.otherPhone
}

export function contactSupportLabelV36_13(signal?: ContactSignalForReviewV36_13): string {
  if (!signal) return 'Not found'
  if (signal.verified || (signal.deliverability === 'verified' && ['deterministic', 'strong'].includes(signal.ownershipConfidence || ''))) return 'Best supported'
  if (signal.deliverability === 'verified' || signal.deliverability === 'valid') return 'Deliverability supported'
  if (signal.ownershipConfidence === 'deterministic' || signal.ownershipConfidence === 'strong') return 'Ownership supported'
  return 'Best available'
}
