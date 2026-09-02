export type UniversalPeopleSearchIntentV36_9 =
  | 'email_lookup'
  | 'phone_lookup'
  | 'linkedin_lookup'
  | 'github_lookup'
  | 'profile_lookup'
  | 'person_lookup'
  | 'professional_search'

export type UniversalPeopleSearchDraftV36_9 = {
  query: string
  title?: string
  company?: string
  location?: string
  skills?: string
  limit?: number
}

export type UniversalPeopleProviderRequestV36_9 = {
  query: string
  requirements?: Array<{ text: string; mustHave: boolean }>
  titles?: string[]
  skills?: string[]
  locations?: string[]
  limit: number
  highFreshness: boolean
}

function clean(value?: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function splitList(value?: string, max = 30): string[] {
  return Array.from(new Set(String(value || '')
    .split(/[,\n;]/)
    .map(item => clean(item))
    .filter(Boolean)))
    .slice(0, max)
}

function exactHttpUrl(value: string): URL | null {
  if (!/^https?:\/\//i.test(value)) return null
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null
  } catch {
    return null
  }
}

export function classifyUniversalPeopleSearchV36_9(value: string): UniversalPeopleSearchIntentV36_9 {
  const query = clean(value)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(query)) return 'email_lookup'

  const digits = query.replace(/\D/g, '')
  if (digits.length >= 7 && digits.length <= 15 && /^[+()\-\.\s\d]+$/.test(query)) return 'phone_lookup'

  const url = exactHttpUrl(query)
  if (url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'linkedin.com' && /^\/in\//i.test(url.pathname)) return 'linkedin_lookup'
    if (host === 'github.com' && url.pathname.split('/').filter(Boolean).length >= 1) return 'github_lookup'
    return 'profile_lookup'
  }

  const tokens = query.split(/\s+/).filter(Boolean)
  const nameLike = tokens.length >= 2 && tokens.length <= 4 && tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))
  if (nameLike) return 'person_lookup'
  return 'professional_search'
}

export function universalPeopleIntentLabelV36_9(intent: UniversalPeopleSearchIntentV36_9): string {
  if (intent === 'email_lookup') return 'Email lookup'
  if (intent === 'phone_lookup') return 'Phone lookup'
  if (intent === 'linkedin_lookup') return 'LinkedIn profile lookup'
  if (intent === 'github_lookup') return 'GitHub profile lookup'
  if (intent === 'profile_lookup') return 'Profile URL lookup'
  if (intent === 'person_lookup') return 'Person lookup'
  return 'Professional people search'
}

/**
 * The universal box is a control surface, not provider query syntax. Structured
 * filters stay explicit. Company is currently included as bounded natural-language
 * context because the V36.8 provider contract does not yet expose a universal
 * company field across every adapter.
 */
export function buildUniversalPeopleProviderRequestV36_9(
  draft: UniversalPeopleSearchDraftV36_9,
): UniversalPeopleProviderRequestV36_9 {
  const query = clean(draft.query)
  const company = clean(draft.company)
  const titles = splitList(draft.title, 20)
  const skills = splitList(draft.skills, 40)
  const locations = splitList(draft.location, 20)
  const context = [query, company ? `company ${company}` : ''].filter(Boolean).join(' · ').slice(0, 3000)
  const requirements = [
    ...titles.map(text => ({ text: `Current or relevant title: ${text}`, mustHave: false })),
    ...skills.map(text => ({ text, mustHave: true })),
  ].slice(0, 30)

  return {
    query: context || 'professional person search',
    ...(requirements.length ? { requirements } : {}),
    ...(titles.length ? { titles } : {}),
    ...(skills.length ? { skills } : {}),
    ...(locations.length ? { locations } : {}),
    limit: Math.max(1, Math.min(50, Math.trunc(draft.limit || 30))),
    highFreshness: false,
  }
}

export function exactLinkedInAnchorV36_9(profileUrls: Array<{ kind: string; url: string }>): string | undefined {
  const item = profileUrls.find(profile => profile.kind === 'linkedin')
  if (!item?.url) return undefined
  try {
    const url = new URL(item.url)
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return undefined
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return undefined
  }
}
