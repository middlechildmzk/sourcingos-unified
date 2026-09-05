import type { ContactEnrichmentRequest } from './types'

export type EnrichmentIdentityStrengthV34 = 'strong' | 'usable' | 'insufficient'

export type EnrichmentIdentityAssessmentV34 = {
  strength: EnrichmentIdentityStrengthV34
  attemptProvider: boolean
  anchors: string[]
  missing: string[]
  message: string
}

function clean(value?: string): string {
  return String(value || '').trim()
}

function validHttpUrl(value?: string): URL | null {
  const raw = clean(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function validEmail(value?: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(clean(value))
}

function validPhone(value?: string): boolean {
  const raw = clean(value)
  if (!raw || !/^[+()\-\.\s\d]+$/.test(raw)) return false
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function profileAnchor(request: ContactEnrichmentRequest): 'linkedin' | 'github' | '' {
  const linkedin = validHttpUrl(request.linkedinUrl)
  if (linkedin && /(^|\.)linkedin\.com$/i.test(linkedin.hostname) && /^\/in\//i.test(linkedin.pathname)) return 'linkedin'

  const github = validHttpUrl(request.githubUrl)
  if (github && /(^|\.)github\.com$/i.test(github.hostname) && github.pathname.split('/').filter(Boolean).length >= 1) return 'github'

  const profile = validHttpUrl(request.profileUrl)
  if (profile && /(^|\.)linkedin\.com$/i.test(profile.hostname) && /^\/in\//i.test(profile.pathname)) return 'linkedin'
  if (profile && /(^|\.)github\.com$/i.test(profile.hostname) && profile.pathname.split('/').filter(Boolean).length >= 1) return 'github'
  return ''
}

function normalizedName(request: ContactEnrichmentRequest): string {
  if (clean(request.fullName)) return clean(request.fullName)
  return [clean(request.firstName), clean(request.lastName)].filter(Boolean).join(' ')
}

function multiTokenPersonName(value: string): boolean {
  const tokens = value.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return false
  return tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))
}

function singleTokenHandleLike(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  return /^[a-z0-9._-]+$/.test(trimmed)
}

/**
 * Paid contact enrichment should resolve an already-grounded professional
 * identity, not discover identity from a username. Provider-native ids are
 * deterministic only within the explicitly named provider and never authorize a
 * cross-provider identity merge. Exact email/phone values are permitted as
 * explicit lookup identifiers only when a configured provider contract supports
 * them; they do not establish contact ownership or outreach permission by
 * themselves.
 */
export function assessEnrichmentIdentityV34(request: ContactEnrichmentRequest): EnrichmentIdentityAssessmentV34 {
  const anchors: string[] = []
  const missing: string[] = []
  const profile = profileAnchor(request)
  const providerAnchor = Boolean(clean(request.providerPersonId) && request.providerName && request.providerName !== 'none')
  const emailAnchor = validEmail(request.email)
  const phoneAnchor = validPhone(request.phone)
  const name = normalizedName(request)
  const strongName = multiTokenPersonName(name)
  const handleLike = singleTokenHandleLike(name)
  const company = clean(request.companyDomain) || clean(request.currentCompany)
  const location = clean(request.location)
  const title = clean(request.title)

  if (providerAnchor) anchors.push(`${request.providerName} provider person id`)
  if (profile) anchors.push(`${profile} profile URL`)
  if (emailAnchor) anchors.push('exact email lookup identifier')
  if (phoneAnchor) anchors.push('exact phone lookup identifier')
  if (strongName) anchors.push('multi-token person name')
  else if (name) anchors.push(handleLike ? 'single-token handle/name' : 'partial name')
  if (company) anchors.push('company/domain')
  if (location) anchors.push('location')
  if (title) anchors.push('professional title')

  if (providerAnchor) {
    return {
      strength: 'strong', attemptProvider: true, anchors, missing,
      message: `Identity is grounded by an observed ${request.providerName} provider person id for a same-provider enrichment lookup.`,
    }
  }

  if (profile) {
    return { strength: 'strong', attemptProvider: true, anchors, missing, message: `Identity is grounded by an observed ${profile} profile URL.` }
  }

  if (emailAnchor || phoneAnchor) {
    return {
      strength: 'usable',
      attemptProvider: true,
      anchors,
      missing,
      message: `An exact ${emailAnchor ? 'email' : 'phone'} identifier can be sent only to providers that explicitly support identity lookup by that field. Any returned person remains a provider observation pending identity review.`,
    }
  }

  if (strongName && company) {
    return { strength: 'strong', attemptProvider: true, anchors, missing, message: 'Identity has a multi-token name plus company/domain context.' }
  }

  if (strongName && location && title) {
    return { strength: 'usable', attemptProvider: true, anchors, missing, message: 'Identity has a multi-token name plus location and professional-title context.' }
  }

  if (!strongName) missing.push('a real multi-token name, an observed GitHub/LinkedIn profile URL, a same-provider person id, or an exact email/phone identifier supported by the provider')
  if (!company && !(location && title)) missing.push('company/domain or both location and professional title')

  return {
    strength: 'insufficient', attemptProvider: false, anchors, missing,
    message: handleLike
      ? 'Contact lookup is paused because the record looks like a source handle, not a resolved professional identity.'
      : 'Contact lookup needs stronger professional identity anchors before calling a paid enrichment provider.',
  }
}
