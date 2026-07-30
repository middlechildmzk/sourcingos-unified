import { classifySourceResult, isLegacyLinkedInConnectionImport } from '../entity-classification'
import type { SourceResult } from '../source-types'
import { extractObservedIdentifiers } from './identifier-extraction'
import { normalizeOrcid, normalizeProfileUrl, uniqueNormalized } from './normalization'
import type { IdentityProfile } from './resolver-types'
import { sourceRoleFor } from './source-role'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,;|\n]+/).map(item => item.trim()).filter(Boolean)
  return []
}

function candidateRawRecords(raw: unknown): UnknownRecord[] {
  const root = record(raw)
  const nested = record(root.raw)
  return Object.keys(nested).length ? [root, nested] : [root]
}

function extractHandles(raw: unknown): string[] {
  const values: string[] = []
  for (const item of candidateRawRecords(raw)) {
    values.push(text(item.login), text(item.username), text(item.user_name), text(item.handle))
  }
  return values.filter(Boolean)
}

function extractExplicitLinks(raw: unknown): string[] {
  const values: string[] = []
  for (const item of candidateRawRecords(raw)) {
    values.push(
      text(item.html_url),
      text(item.blog),
      text(item.website),
      text(item.webpage),
      ...textList(item.sameAs),
      ...textList(item.same_as),
      ...textList(item.external_urls),
    )
  }
  return uniqueNormalized(values, normalizeProfileUrl)
}

function extractOrcid(result: SourceResult): string {
  if (result.source !== 'orcid') return ''
  const direct = normalizeOrcid(result.sourceProfileId)
  if (direct) return direct
  for (const item of candidateRawRecords(result.raw)) {
    const found = normalizeOrcid(text(item.orcid) || text(item['orcid-identifier']))
    if (found) return found
  }
  return ''
}

export function identityProfileFromSourceResult(
  input: SourceResult,
  ownerId: string,
  sensitiveSecret: string,
): IdentityProfile {
  const result = classifySourceResult(input)
  const role = sourceRoleFor({
    source: result.source,
    entityKind: result.entityKind,
    authorizedPersonImport: isLegacyLinkedInConnectionImport(result.raw),
  })

  const publicEmails = result.contactSignals
    .filter(signal => signal.type === 'public_email')
    .map(signal => signal.value)
  const websites = result.contactSignals
    .filter(signal => signal.type === 'website')
    .map(signal => signal.value)
  const explicitLinks = extractExplicitLinks(result.raw)
  if (result.profileUrl) explicitLinks.push(result.profileUrl)

  const base: Omit<IdentityProfile, 'identifiers'> = {
    id: result.id,
    ownerId,
    source: result.source,
    sourceProfileId: result.sourceProfileId,
    entityKind: result.entityKind,
    sourceRole: role,
    displayName: result.displayName,
    headline: result.headline,
    location: result.location,
    organization: result.organization,
    profileUrl: result.profileUrl,
    websites,
    handles: extractHandles(result.raw),
    publicEmails,
    orcid: extractOrcid(result) || undefined,
    explicitLinks: uniqueNormalized(explicitLinks, normalizeProfileUrl),
    observedAt: result.refreshedAt,
  }

  return {
    ...base,
    identifiers: extractObservedIdentifiers(base, sensitiveSecret),
  }
}
