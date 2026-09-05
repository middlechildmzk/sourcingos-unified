import type { SourceResult } from './source-types'

export type ProfessionalProfileAnchorV36_10 = {
  network: 'linkedin' | 'github' | 'stackoverflow' | 'huggingface' | 'dev' | 'kaggle' | 'orcid'
  canonicalUrl: string
  observedUrl: string
}

function safeUrl(value: unknown): URL | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
}

function cleanHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function cleanPath(pathname: string) {
  return pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/'
}

export function canonicalProfessionalProfileUrlV36_10(value: unknown): ProfessionalProfileAnchorV36_10 | null {
  const parsed = safeUrl(value)
  if (!parsed) return null
  const host = cleanHost(parsed.hostname)
  const path = cleanPath(parsed.pathname)
  const parts = path.split('/').filter(Boolean)
  const observedUrl = parsed.toString()

  // LinkedIn is normalized so the product can display/dedupe the observed URL,
  // but V36.11 deliberately excludes it from deterministic cross-source
  // identity authority. Commercial providers may report the same LinkedIn URL;
  // that observation is useful context, not permission to link identities.
  if (host === 'linkedin.com' && parts.length === 2 && ['in', 'pub'].includes(parts[0].toLowerCase())) {
    return { network: 'linkedin', canonicalUrl: `https://linkedin.com/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`, observedUrl }
  }

  if (host === 'github.com' && parts.length === 1) {
    const username = parts[0].toLowerCase()
    const reserved = new Set(['about', 'apps', 'collections', 'contact', 'enterprise', 'events', 'explore', 'features', 'issues', 'login', 'marketplace', 'new', 'organizations', 'orgs', 'pricing', 'pulls', 'search', 'security', 'settings', 'site', 'sponsors', 'topics'])
    if (!reserved.has(username)) return { network: 'github', canonicalUrl: `https://github.com/${username}`, observedUrl }
  }

  if (host === 'stackoverflow.com' && parts.length >= 2 && parts[0].toLowerCase() === 'users' && /^\d+$/.test(parts[1])) {
    return { network: 'stackoverflow', canonicalUrl: `https://stackoverflow.com/users/${parts[1]}`, observedUrl }
  }

  if (host === 'huggingface.co' && parts.length === 1) {
    return { network: 'huggingface', canonicalUrl: `https://huggingface.co/${parts[0].toLowerCase()}`, observedUrl }
  }

  if (host === 'dev.to' && parts.length === 1) {
    return { network: 'dev', canonicalUrl: `https://dev.to/${parts[0].toLowerCase()}`, observedUrl }
  }

  if (host === 'kaggle.com' && parts.length === 1) {
    return { network: 'kaggle', canonicalUrl: `https://kaggle.com/${parts[0].toLowerCase()}`, observedUrl }
  }

  if (host === 'orcid.org' && parts.length === 1 && /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(parts[0])) {
    return { network: 'orcid', canonicalUrl: `https://orcid.org/${parts[0].toUpperCase()}`, observedUrl }
  }

  return null
}

function candidateUrls(result: SourceResult): string[] {
  return [
    result.profileUrl || '',
    ...result.contactSignals
      .filter(signal => signal.type === 'profile_url' || signal.type === 'website')
      .map(signal => signal.value),
    ...result.identitySignals
      .filter(signal => signal.type === 'website' || signal.type === 'source_url')
      .map(signal => signal.value),
    ...result.evidence.map(item => item.url || ''),
  ].filter(Boolean)
}

export function professionalProfileAnchorsV36_10(result: SourceResult): ProfessionalProfileAnchorV36_10[] {
  const anchors = candidateUrls(result)
    .map(canonicalProfessionalProfileUrlV36_10)
    .filter((anchor): anchor is ProfessionalProfileAnchorV36_10 => Boolean(anchor))

  return Array.from(new Map(anchors.map(anchor => [`${anchor.network}:${anchor.canonicalUrl}`, anchor])).values())
}

function deterministicProfessionalAnchorV36_11(anchor: ProfessionalProfileAnchorV36_10): boolean {
  return anchor.network !== 'linkedin'
}

/**
 * Returns only professional-profile overlaps that are strong enough to create
 * an identity-review proposal. LinkedIn overlap is intentionally omitted here:
 * it remains visible provenance and a lookup anchor, but never deterministic
 * cross-provider identity authority.
 */
export function sharedProfessionalProfileAnchorsV36_10(a: SourceResult, b: SourceResult) {
  const anchorsA = professionalProfileAnchorsV36_10(a).filter(deterministicProfessionalAnchorV36_11)
  const anchorsB = professionalProfileAnchorsV36_10(b).filter(deterministicProfessionalAnchorV36_11)
  const keysB = new Map(anchorsB.map(anchor => [`${anchor.network}:${anchor.canonicalUrl}`, anchor]))
  const shared = anchorsA.flatMap(anchor => {
    const other = keysB.get(`${anchor.network}:${anchor.canonicalUrl}`)
    return other ? [{ ...anchor, corroboratingObservedUrl: other.observedUrl }] : []
  })

  return {
    matched: shared.length > 0,
    anchors: shared,
    reasons: shared.map(anchor => `Same canonical ${anchor.network} profile ${anchor.canonicalUrl}`),
  }
}
