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
  // Lowercase single-token names are common public handles. Do not spend a paid
  // enrichment lookup on them unless another deterministic profile anchor exists.
  return /^[a-z0-9._-]+$/.test(trimmed)
}

/**
 * Paid contact enrichment should resolve an already-grounded professional
 * identity, not discover identity from a username. This gate does not decide
 * whether two source profiles are the same person; Candidate Graph still owns
 * cross-source identity review. It only decides whether the provider request has
 * enough anchors to make a contact lookup responsible and useful.
 */
export function assessEnrichmentIdentityV34(request: ContactEnrichmentRequest): EnrichmentIdentityAssessmentV34 {
  const anchors: string[] = []
  const missing: string[] = []
  const profile = profileAnchor(request)
  const name = normalizedName(request)
  const strongName = multiTokenPersonName(name)
  const handleLike = singleTokenHandleLike(name)
  const company = clean(request.companyDomain) || clean(request.currentCompany)
  const location = clean(request.location)
  const title = clean(request.title)

  if (profile) anchors.push(`${profile} profile URL`)
  if (strongName) anchors.push('multi-token person name')
  else if (name) anchors.push(handleLike ? 'single-token handle/name' : 'partial name')
  if (company) anchors.push('company/domain')
  if (location) anchors.push('location')
  if (title) anchors.push('professional title')

  if (profile) {
    return {
      strength: 'strong',
      attemptProvider: true,
      anchors,
      missing,
      message: `Identity is grounded by an observed ${profile} profile URL.`,
    }
  }

  if (strongName && company) {
    return {
      strength: 'strong',
      attemptProvider: true,
      anchors,
      missing,
      message: 'Identity has a multi-token name plus company/domain context.',
    }
  }

  if (strongName && location && title) {
    return {
      strength: 'usable',
      attemptProvider: true,
      anchors,
      missing,
      message: 'Identity has a multi-token name plus location and professional-title context.',
    }
  }

  if (!strongName) missing.push('a real multi-token name or an observed GitHub/LinkedIn profile URL')
  if (!company && !(location && title)) missing.push('company/domain or both location and professional title')

  return {
    strength: 'insufficient',
    attemptProvider: false,
    anchors,
    missing,
    message: handleLike
      ? 'Contact lookup is paused because the record looks like a source handle, not a resolved professional identity.'
      : 'Contact lookup needs stronger professional identity anchors before calling a paid enrichment provider.',
  }
}
