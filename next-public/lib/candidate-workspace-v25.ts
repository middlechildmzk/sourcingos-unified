import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveStoredEntityKind } from '@/lib/entity-classification'
import type { EntityKind } from '@/lib/source-types'
import { buildCandidateUniverseProjectionV36 } from '@/lib/candidate-universe-v36'
import { searchCandidateGraphIdsV36_10 } from '@/lib/candidate-graph-search-v36-10'
import { candidateIdentityFamiliesV36_10, candidateIdentityRedirectStateV36_10 } from '@/lib/candidate-identity-redirects-v36-10'

export type CandidateWorkspaceQuery = {
  limit?: number
  offset?: number
  search?: string
  roleId?: string
}

function safeSearch(value = '') {
  return value.trim().replace(/[^a-zA-Z0-9 ._@+\-/:]/g, ' ').replace(/\s+/g, ' ').slice(0, 100)
}

function safeRoleId(value = '') {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100)
}

function relationCandidateName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value
  return relation && typeof relation === 'object' && 'canonical_name' in relation
    ? String((relation as { canonical_name?: unknown }).canonical_name || '')
    : ''
}

const EXPLICIT_ENTITY_KINDS_V41 = new Set<EntityKind>(['person', 'organization', 'artifact', 'publication', 'search_lane'])

function explicitStoredEntityKindV41(value: unknown): EntityKind | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() as EntityKind : undefined
  return normalized && EXPLICIT_ENTITY_KINDS_V41.has(normalized) ? normalized : undefined
}

/**
 * Stored candidates have already crossed the discovery-time entity safety gate.
 * Older rows can legitimately predate persisted entity_kind, so a stored graph
 * row with at least one profile is treated leniently as a person only when no
 * explicit non-person classification exists. Discovery-time gates stay strict.
 */
export function candidateWorkspaceEntityKindV41(profiles: any[]): EntityKind {
  const explicitKinds = profiles
    .map(profile => explicitStoredEntityKindV41(profile?.entity_kind))
    .filter(Boolean) as EntityKind[]

  // An explicit stored non-person classification is authoritative on this read
  // path and must never be converted into a person merely because older raw
  // payloads do not carry enough classifier context.
  for (const kind of ['organization', 'artifact', 'publication', 'search_lane'] as const) {
    if (explicitKinds.includes(kind)) return kind
  }
  if (explicitKinds.includes('person')) return 'person'

  const kinds = profiles.map(profile => resolveStoredEntityKind({
    source: profile.source,
    raw: profile.raw,
    entityKind: profile.entity_kind,
  }))
  if (kinds.includes('organization')) return 'organization'
  if (kinds.includes('artifact')) return 'artifact'
  if (kinds.includes('publication')) return 'publication'
  if (kinds.includes('search_lane')) return 'search_lane'
  if (kinds.includes('person')) return 'person'
  return profiles.length > 0 ? 'person' : 'unknown'
}

export async function getCandidateWorkspace(ownerId: string, query: CandidateWorkspaceQuery = {}) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')

  const limit = Math.max(1, Math.min(200, Number(query.limit) || 100))
  const offset = Math.max(0, Number(query.offset) || 0)
  const search = safeSearch(query.search)
  const activeRoleId = safeRoleId(query.roleId)
  const graphSearch = search
    ? await searchCandidateGraphIdsV36_10({ sb, ownerId, query: search, limit, offset })
    : null
  const graphSearchActive = Boolean(search && graphSearch?.migrationReady)

  let candidatePromise: PromiseLike<any>
  if (graphSearchActive) {
    const ids = graphSearch?.candidateIds || []
    candidatePromise = ids.length
      ? sb.from('candidates').select('*', { count: 'exact' }).eq('owner_id', ownerId).in('id', ids)
      : Promise.resolve({ data: [], error: null, count: 0 })
  } else {
    let candidateQuery = sb
      .from('candidates')
      .select('*', { count: 'exact' })
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      const pattern = `%${search}%`
      candidateQuery = candidateQuery.or(`canonical_name.ilike.${pattern},headline.ilike.${pattern},current_title.ilike.${pattern},current_company.ilike.${pattern},location.ilike.${pattern}`)
    }
    candidatePromise = candidateQuery
  }

  const [candidateResult, totalCandidates, sourceCount, evidenceCount, contactCount, openCount, pendingReviewCount, matchReviews, importBatches] = await Promise.all([
    candidatePromise,
    sb.from('candidates').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('candidate_contacts').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('open_to_work_signals').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('identity_match_reviews').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('decision', 'pending'),
    sb.from('identity_match_reviews').select('*,candidates(canonical_name)').eq('owner_id', ownerId).eq('decision', 'pending').order('created_at', { ascending: false }).limit(50),
    sb.from('candidate_import_batches').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(20),
  ])

  const fatal = candidateResult.error || totalCandidates.error || sourceCount.error || evidenceCount.error || contactCount.error || openCount.error || pendingReviewCount.error || matchReviews.error || importBatches.error
  if (fatal) throw new Error(fatal.message)

  const graphOrder = new Map((graphSearch?.candidateIds || []).map((id, index) => [id, index]))
  const fetchedRows = [...(candidateResult.data || [])]
  const redirectState = await candidateIdentityRedirectStateV36_10({
    sb,
    ownerId,
    candidateIds: fetchedRows.map(row => row.id),
  })
  const rows = fetchedRows.filter(row => !redirectState.redirectedIds.has(row.id))
  if (graphSearchActive) rows.sort((a, b) => (graphOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (graphOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER))

  const candidateIds = rows.map(row => row.id)
  const identityFamilies = await candidateIdentityFamiliesV36_10({ sb, ownerId, candidateIds })
  const relationshipCandidateIds = Array.from(identityFamilies.familyToCanonical.keys())
  const relatedCandidateIds = relationshipCandidateIds.length ? relationshipCandidateIds : candidateIds
  const emptyRelated = { data: [] as any[], error: null as null | { message: string } }
  const [profiles, evidence, contacts, openSignals, roleCandidates] = relatedCandidateIds.length ? await Promise.all([
    sb.from('source_profiles').select('*').eq('owner_id', ownerId).in('candidate_id', relatedCandidateIds),
    sb.from('evidence_items').select('*').eq('owner_id', ownerId).in('candidate_id', relatedCandidateIds),
    sb.from('candidate_contacts').select('*').eq('owner_id', ownerId).in('candidate_id', relatedCandidateIds),
    sb.from('open_to_work_signals').select('*').eq('owner_id', ownerId).in('candidate_id', relatedCandidateIds),
    sb.from('role_candidates')
      .select('candidate_id,role_id,stage,fit_decision,fit_reasons,concerns,added_at,updated_at')
      .eq('owner_id', ownerId)
      .in('candidate_id', relatedCandidateIds),
  ]) : [emptyRelated, emptyRelated, emptyRelated, emptyRelated, emptyRelated]

  const relatedError = profiles.error || evidence.error || contacts.error || openSignals.error || roleCandidates.error
  if (relatedError) throw new Error(relatedError.message)

  const byCanonicalCandidate = <T extends { candidate_id?: string | null }>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const item of items) {
      if (!item.candidate_id) continue
      const canonicalId = identityFamilies.familyToCanonical.get(item.candidate_id) || item.candidate_id
      const current = map.get(canonicalId) || []
      current.push(item)
      map.set(canonicalId, current)
    }
    return map
  }

  const profileMap = byCanonicalCandidate(profiles.data || [])
  const evidenceMap = byCanonicalCandidate(evidence.data || [])
  const contactMap = byCanonicalCandidate(contacts.data || [])
  const openMap = byCanonicalCandidate(openSignals.data || [])
  const roleCandidateMap = byCanonicalCandidate(roleCandidates.data || [])

  const candidates = rows.map(row => {
    const candidateProfiles = profileMap.get(row.id) || []
    const candidateEvidence = evidenceMap.get(row.id) || []
    const candidateRoleHistory = roleCandidateMap.get(row.id) || []
    const identityFamilyIds = identityFamilies.canonicalToFamily.get(row.id) || [row.id]
    return {
      id: row.id,
      canonicalName: row.canonical_name,
      headline: row.headline || row.current_title || '',
      location: row.location || undefined,
      currentCompany: row.current_company || undefined,
      currentTitle: row.current_title || undefined,
      summary: row.summary || '',
      skills: Array.isArray(row.skills) ? row.skills : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRefreshedAt: row.last_refreshed_at || undefined,
      entityKind: candidateWorkspaceEntityKindV41(candidateProfiles),
      sourceProfileIds: candidateProfiles.map(item => item.id),
      evidenceItemIds: candidateEvidence.map(item => item.id),
      contactSignalIds: (contactMap.get(row.id) || []).map(item => item.id),
      openToWorkSignalIds: (openMap.get(row.id) || []).map(item => item.id),
      mergeStatus: row.merge_status || 'pending',
      searchRank: graphSearchActive ? graphSearch?.ranks.get(row.id) || 0 : undefined,
      identityFamilyIds,
      absorbedIdentityCount: Math.max(0, identityFamilyIds.length - 1),
      universe: buildCandidateUniverseProjectionV36({
        candidateId: row.id,
        profiles: candidateProfiles,
        evidenceItems: candidateEvidence,
        roleCandidates: candidateRoleHistory,
        activeRoleId: activeRoleId || undefined,
        candidateCreatedAt: row.created_at,
        candidateUpdatedAt: row.updated_at,
      }),
    }
  })

  const personCandidatesOnPage = candidates.filter(candidate => candidate.entityKind === 'person').length
  const nonPersonCandidatesOnPage = candidates.length - personCandidatesOnPage
  const activeCandidateCount = Math.max(0, (totalCandidates.count || 0) - (redirectState.migrationReady ? redirectState.totalRedirects : 0))
  const filteredCandidates = graphSearchActive
    ? graphSearch?.total || 0
    : search
      ? Math.max(0, (candidateResult.count || 0) - (fetchedRows.length - rows.length))
      : activeCandidateCount

  const canonicalCandidateId = (candidateId: string | null | undefined) => candidateId
    ? identityFamilies.familyToCanonical.get(candidateId) || candidateId
    : undefined

  return {
    ok: true,
    persistence_mode: 'supabase' as const,
    candidates,
    sourceProfiles: (profiles.data || []).map(row => ({
      id: row.id,
      candidateId: canonicalCandidateId(row.candidate_id),
      historicalCandidateId: row.candidate_id && canonicalCandidateId(row.candidate_id) !== row.candidate_id ? row.candidate_id : undefined,
      source: row.source,
      sourceProfileId: row.source_profile_id,
      profileUrl: row.profile_url || undefined,
      displayName: row.display_name,
      headline: row.headline || undefined,
      location: row.location || undefined,
      organization: row.organization || undefined,
      entityKind: resolveStoredEntityKind({ source: row.source, raw: row.raw, entityKind: row.entity_kind }),
      status: row.status,
      matchScore: row.match_score,
      matchReasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
    })),
    evidenceItems: (evidence.data || []).map(row => ({ id: row.id, candidateId: canonicalCandidateId(row.candidate_id), historicalCandidateId: row.candidate_id && canonicalCandidateId(row.candidate_id) !== row.candidate_id ? row.candidate_id : undefined, sourceProfileId: row.source_profile_id || undefined, source: row.source, label: row.label, detail: row.detail, confidence: row.confidence, url: row.url || undefined, createdAt: row.created_at })),
    contactSignals: (contacts.data || []).map(row => ({ id: row.id, candidateId: canonicalCandidateId(row.candidate_id), historicalCandidateId: row.candidate_id && canonicalCandidateId(row.candidate_id) !== row.candidate_id ? row.candidate_id : undefined, sourceProfileId: row.source_profile_id || undefined, type: row.type, value: row.value, source: row.source, confidence: row.confidence, verified: false, permissionStatus: row.permission_status, createdAt: row.created_at })),
    openToWorkSignals: (openSignals.data || []).map(row => ({ id: row.id, candidateId: canonicalCandidateId(row.candidate_id), historicalCandidateId: row.candidate_id && canonicalCandidateId(row.candidate_id) !== row.candidate_id ? row.candidate_id : undefined, sourceProfileId: row.source_profile_id || undefined, source: row.source, label: row.label, detail: row.detail, confidence: row.confidence, requiresReview: true, createdAt: row.created_at })),
    matchReviews: (matchReviews.data || []).map(row => ({ id: row.id, candidateId: row.candidate_id || undefined, sourceProfileIds: Array.isArray(row.source_profile_ids) ? row.source_profile_ids : [], proposedCanonicalName: relationCandidateName(row.candidates) || 'Potential identity match', score: row.match_score || 0, reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [], conflicts: Array.isArray(row.conflicts) ? row.conflicts : [], decision: row.decision, decidedBy: row.decided_by || undefined, decidedAt: row.decided_at || undefined, createdAt: row.created_at })),
    importBatches: (importBatches.data || []).map(row => ({ id: row.id, importType: row.import_type, fileName: row.file_name || undefined, rowsSeen: row.rows_seen, recordsCreated: row.records_created, warnings: Array.isArray(row.warnings) ? row.warnings : [], createdAt: row.created_at })),
    counts: {
      candidates: activeCandidateCount,
      filteredCandidates,
      personCandidatesOnPage,
      nonPersonCandidatesOnPage,
      sourceProfiles: sourceCount.count || 0,
      evidenceItems: evidenceCount.count || 0,
      contactSignals: contactCount.count || 0,
      openToWorkSignals: openCount.count || 0,
      pendingMatchReviews: pendingReviewCount.count || 0,
    },
    page: { limit, offset, hasMore: offset + fetchedRows.length < filteredCandidates },
    search,
    searchMode: search ? graphSearchActive ? 'candidate_graph' : 'legacy_scalar' : 'none',
    activeRoleId: activeRoleId || null,
  }
}