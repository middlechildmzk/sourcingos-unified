import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type CandidateWorkspaceQuery = {
  limit?: number
  offset?: number
  search?: string
}

function safeSearch(value = '') {
  return value.trim().replace(/[^a-zA-Z0-9 ._@+\-]/g, ' ').replace(/\s+/g, ' ').slice(0, 100)
}

function relationCandidateName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value
  return relation && typeof relation === 'object' && 'canonical_name' in relation
    ? String((relation as { canonical_name?: unknown }).canonical_name || '')
    : ''
}

export async function getCandidateWorkspace(ownerId: string, query: CandidateWorkspaceQuery = {}) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')

  const limit = Math.max(1, Math.min(200, Number(query.limit) || 100))
  const offset = Math.max(0, Number(query.offset) || 0)
  const search = safeSearch(query.search)

  let candidateQuery = sb
    .from('candidates')
    .select('*', { count: 'exact' })
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    const pattern = `%${search}%`
    candidateQuery = candidateQuery.or(`canonical_name.ilike.${pattern},headline.ilike.${pattern},current_company.ilike.${pattern},location.ilike.${pattern}`)
  }

  const [candidateResult, totalCandidates, sourceCount, evidenceCount, contactCount, openCount, pendingReviewCount, matchReviews, importBatches] = await Promise.all([
    candidateQuery,
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

  const rows = candidateResult.data || []
  const candidateIds = rows.map(row => row.id)
  const emptyRelated = { data: [] as any[], error: null as null | { message: string } }
  const [profiles, evidence, contacts, openSignals] = candidateIds.length ? await Promise.all([
    sb.from('source_profiles').select('*').eq('owner_id', ownerId).in('candidate_id', candidateIds),
    sb.from('evidence_items').select('*').eq('owner_id', ownerId).in('candidate_id', candidateIds),
    sb.from('candidate_contacts').select('*').eq('owner_id', ownerId).in('candidate_id', candidateIds),
    sb.from('open_to_work_signals').select('*').eq('owner_id', ownerId).in('candidate_id', candidateIds),
  ]) : [emptyRelated, emptyRelated, emptyRelated, emptyRelated]

  const relatedError = profiles.error || evidence.error || contacts.error || openSignals.error
  if (relatedError) throw new Error(relatedError.message)

  const byCandidate = <T extends { candidate_id?: string | null }>(items: T[]) => {
    const map = new Map<string, T[]>()
    for (const item of items) {
      if (!item.candidate_id) continue
      const current = map.get(item.candidate_id) || []
      current.push(item)
      map.set(item.candidate_id, current)
    }
    return map
  }

  const profileMap = byCandidate(profiles.data || [])
  const evidenceMap = byCandidate(evidence.data || [])
  const contactMap = byCandidate(contacts.data || [])
  const openMap = byCandidate(openSignals.data || [])

  return {
    ok: true,
    persistence_mode: 'supabase' as const,
    candidates: rows.map(row => ({
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
      sourceProfileIds: (profileMap.get(row.id) || []).map(item => item.id),
      evidenceItemIds: (evidenceMap.get(row.id) || []).map(item => item.id),
      contactSignalIds: (contactMap.get(row.id) || []).map(item => item.id),
      openToWorkSignalIds: (openMap.get(row.id) || []).map(item => item.id),
      mergeStatus: row.merge_status || 'pending',
    })),
    sourceProfiles: (profiles.data || []).map(row => ({
      id: row.id,
      candidateId: row.candidate_id || undefined,
      source: row.source,
      sourceProfileId: row.source_profile_id,
      profileUrl: row.profile_url || undefined,
      displayName: row.display_name,
      headline: row.headline || undefined,
      location: row.location || undefined,
      organization: row.organization || undefined,
      status: row.status,
      matchScore: row.match_score,
      matchReasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
    })),
    evidenceItems: (evidence.data || []).map(row => ({ id: row.id, candidateId: row.candidate_id || undefined, sourceProfileId: row.source_profile_id || undefined, source: row.source, label: row.label, detail: row.detail, confidence: row.confidence, url: row.url || undefined, createdAt: row.created_at })),
    contactSignals: (contacts.data || []).map(row => ({ id: row.id, candidateId: row.candidate_id || undefined, sourceProfileId: row.source_profile_id || undefined, type: row.type, value: row.value, source: row.source, confidence: row.confidence, verified: false, permissionStatus: row.permission_status, createdAt: row.created_at })),
    openToWorkSignals: (openSignals.data || []).map(row => ({ id: row.id, candidateId: row.candidate_id || undefined, sourceProfileId: row.source_profile_id || undefined, source: row.source, label: row.label, detail: row.detail, confidence: row.confidence, requiresReview: true, createdAt: row.created_at })),
    matchReviews: (matchReviews.data || []).map(row => ({ id: row.id, candidateId: row.candidate_id || undefined, sourceProfileIds: Array.isArray(row.source_profile_ids) ? row.source_profile_ids : [], proposedCanonicalName: relationCandidateName(row.candidates) || 'Potential identity match', score: row.match_score || 0, reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [], conflicts: Array.isArray(row.conflicts) ? row.conflicts : [], decision: row.decision, decidedBy: row.decided_by || undefined, decidedAt: row.decided_at || undefined, createdAt: row.created_at })),
    importBatches: (importBatches.data || []).map(row => ({ id: row.id, importType: row.import_type, fileName: row.file_name || undefined, rowsSeen: row.rows_seen, recordsCreated: row.records_created, warnings: Array.isArray(row.warnings) ? row.warnings : [], createdAt: row.created_at })),
    counts: {
      candidates: totalCandidates.count || 0,
      filteredCandidates: candidateResult.count || 0,
      sourceProfiles: sourceCount.count || 0,
      evidenceItems: evidenceCount.count || 0,
      contactSignals: contactCount.count || 0,
      openToWorkSignals: openCount.count || 0,
      pendingMatchReviews: pendingReviewCount.count || 0,
    },
    page: { limit, offset, hasMore: offset + rows.length < (candidateResult.count || 0) },
    search,
  }
}
