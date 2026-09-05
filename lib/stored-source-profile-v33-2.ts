import { classifySourceResult } from './entity-classification'
import { allSourceNames, type SourceName, type SourceResult } from './source-types'

function parseRaw(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return {} }
}

/**
 * Reconstruct the canonical SourceResult envelope from either Supabase
 * snake_case rows or preview Candidate DB camelCase rows.
 *
 * Rich V29.2+ saves retain the complete source result in `raw`/`rawText`.
 * Older rows fail closed to observed profile fields only. This adapter never
 * introduces role/search criteria and always re-runs source classification.
 */
export function sourceResultFromStoredProfile(profile: any): SourceResult | null {
  const source = String(profile?.source || '').trim() as SourceName
  if (!allSourceNames.includes(source)) return null

  const rawCandidate = parseRaw(profile.raw ?? profile.rawText ?? profile.raw_text)
  const rawRecord = rawCandidate && typeof rawCandidate === 'object' && !Array.isArray(rawCandidate)
    ? rawCandidate as Record<string, unknown>
    : {}
  const nested = rawRecord.raw && typeof rawRecord.raw === 'object' && !Array.isArray(rawRecord.raw)
    ? rawRecord.raw
    : rawCandidate

  const storedLooksCanonical = rawRecord.source === source
    && typeof rawRecord.sourceProfileId === 'string'
    && typeof rawRecord.displayName === 'string'

  const candidate: SourceResult = storedLooksCanonical
    ? {
        ...(rawRecord as unknown as SourceResult),
        source,
        sourceProfileId: String(rawRecord.sourceProfileId || profile.source_profile_id || profile.sourceProfileId || ''),
        displayName: String(rawRecord.displayName || profile.display_name || profile.displayName || '').trim(),
        profileUrl: String(rawRecord.profileUrl || profile.profile_url || profile.profileUrl || '').trim() || undefined,
        skills: Array.isArray(rawRecord.skills) ? rawRecord.skills.filter((item): item is string => typeof item === 'string') : [],
        evidence: Array.isArray(rawRecord.evidence) ? rawRecord.evidence as SourceResult['evidence'] : [],
        contactSignals: Array.isArray(rawRecord.contactSignals) ? rawRecord.contactSignals as SourceResult['contactSignals'] : [],
        identitySignals: Array.isArray(rawRecord.identitySignals) ? rawRecord.identitySignals as SourceResult['identitySignals'] : [],
        refreshedAt: typeof rawRecord.refreshedAt === 'string' ? rawRecord.refreshedAt : new Date().toISOString(),
        raw: nested,
      }
    : {
        id: String(profile.id || `${source}:${profile.source_profile_id || profile.sourceProfileId || ''}`),
        source,
        sourceProfileId: String(profile.source_profile_id || profile.sourceProfileId || '').trim(),
        entityKind: 'unknown',
        displayName: String(profile.display_name || profile.displayName || '').trim(),
        headline: String(profile.headline || '').trim() || undefined,
        location: String(profile.location || '').trim() || undefined,
        organization: String(profile.organization || '').trim() || undefined,
        profileUrl: String(profile.profile_url || profile.profileUrl || '').trim() || undefined,
        skills: [],
        evidence: [],
        contactSignals: [],
        identitySignals: [],
        refreshedAt: String(profile.last_seen_at || profile.lastSeenAt || profile.created_at || profile.createdAt || new Date().toISOString()),
        raw: nested,
      }

  if (!candidate.sourceProfileId || !candidate.displayName) return null
  return classifySourceResult(candidate)
}
