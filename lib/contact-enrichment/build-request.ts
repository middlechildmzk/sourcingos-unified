// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/build-request.ts — Build a ContactEnrichmentRequest
// from candidate / source-profile data available in the UI.
//
// Professional data only. No protected-trait fields. Safe to run client or server.
// ─────────────────────────────────────────────────────────────────────────────
import { ContactEnrichmentRequest } from './types'

/** Source-profile / candidate shape as surfaced in result cards and dossiers. */
export interface EnrichmentSource {
  candidateId?: string
  sourceProfileId?: string
  displayName?: string
  headline?: string
  organization?: string
  currentCompany?: string
  location?: string
  profileUrl?: string
  githubUrl?: string
  linkedinUrl?: string
  source?: string
}

/** Split a display name into first/last for provider requests (best-effort). */
function splitName(displayName?: string): { firstName?: string; lastName?: string; fullName?: string } {
  if (!displayName) return {}
  const trimmed = displayName.trim()
  // Skip handles that look like usernames (no space, contains digits/symbols)
  const looksLikeHandle = !trimmed.includes(' ') && /[0-9_\-]/.test(trimmed)
  if (looksLikeHandle) return { fullName: trimmed }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { fullName: trimmed }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: trimmed,
  }
}

/** Derive a company domain from an organization name (best-effort, no network). */
function inferCompanyDomain(org?: string): string | undefined {
  if (!org) return undefined
  // Only return a domain if the org already looks like one
  if (/\.[a-z]{2,}$/i.test(org)) return org.toLowerCase()
  return undefined
}

export function buildEnrichmentRequest(src: EnrichmentSource): ContactEnrichmentRequest {
  const { firstName, lastName, fullName } = splitName(src.displayName)
  const company = src.currentCompany || src.organization

  return {
    candidateId: src.candidateId,
    sourceProfileId: src.sourceProfileId,
    firstName,
    lastName,
    fullName,
    currentCompany: company,
    companyDomain: inferCompanyDomain(company),
    location: src.location,
    title: src.headline,
    profileUrl: src.profileUrl,
    githubUrl: src.githubUrl || (src.source === 'github' ? src.profileUrl : undefined),
    linkedinUrl: src.linkedinUrl,
    sourceContext: src.source ? `Source: ${src.source}` : undefined,
  }
}

/** Human-readable guidance when the request lacks enough identity signal. */
export function enrichmentInputHint(req: ContactEnrichmentRequest): string | null {
  const hasName = Boolean(req.fullName || (req.firstName && req.lastName))
  const hasCompanyOrDomain = Boolean(req.currentCompany || req.companyDomain)
  const hasProfileUrl = Boolean(req.profileUrl || req.linkedinUrl || req.githubUrl)

  if (!hasName && !hasProfileUrl) {
    return 'Add a name or source profile URL to improve enrichment.'
  }
  if (hasName && !hasCompanyOrDomain && !hasProfileUrl) {
    return 'Add company, domain, or source profile URL to improve enrichment.'
  }
  return null
}
