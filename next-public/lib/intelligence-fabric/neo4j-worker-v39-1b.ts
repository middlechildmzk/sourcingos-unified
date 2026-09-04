import 'server-only'

import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { buildNeo4jProjectionBatchV39_1, type ProjectionCandidateV39_1 } from './neo4j-projection-v39-1'
import { ensureNeo4jProjectionSchemaV39_1B, projectNeo4jBatchV39_1B } from './neo4j-query-v39-1b'

export type ProjectionLoadResultV39_1B =
  | { ok: true; candidate: ProjectionCandidateV39_1 }
  | { ok: false; errorCode: 'supabase_unavailable' | 'candidate_not_found' | 'candidate_load_failed' | 'source_load_failed' | 'evidence_load_failed' }

export type CandidateProjectionResultV39_1B = {
  candidateId: string
  ok: boolean
  excludedSourceProfiles: number
  errorCode?: string
}

export type ProjectionPageResultV39_1B = {
  ok: boolean
  attempted: number
  succeeded: number
  failed: number
  excludedSourceProfiles: number
  nextCursor: string | null
  hasMore: boolean
  results: CandidateProjectionResultV39_1B[]
  errorCode?: string
}

export async function loadProjectionCandidateV39_1B(ownerId: string, candidateId: string): Promise<ProjectionLoadResultV39_1B> {
  if (!isSupabaseConfigured()) return { ok: false, errorCode: 'supabase_unavailable' }
  const sb = createServerSupabaseClient()
  if (!sb) return { ok: false, errorCode: 'supabase_unavailable' }

  const candidateResult = await sb
    .from('candidates')
    .select('id,canonical_name,headline,current_title,current_company,location,skills')
    .eq('owner_id', ownerId)
    .eq('id', candidateId)
    .maybeSingle()

  if (candidateResult.error) return { ok: false, errorCode: 'candidate_load_failed' }
  if (!candidateResult.data) return { ok: false, errorCode: 'candidate_not_found' }

  const [sourceResult, evidenceResult] = await Promise.all([
    sb
      .from('source_profiles')
      .select('id,source,status,search_allowed,retention_until,usage_scope')
      .eq('owner_id', ownerId)
      .eq('candidate_id', candidateId),
    sb
      .from('evidence_items')
      .select('id,source,label,detail,source_profile_id,confidence,url')
      .eq('owner_id', ownerId)
      .eq('candidate_id', candidateId),
  ])

  if (sourceResult.error) return { ok: false, errorCode: 'source_load_failed' }
  if (evidenceResult.error) return { ok: false, errorCode: 'evidence_load_failed' }

  const row: any = candidateResult.data
  return {
    ok: true,
    candidate: {
      id: String(row.id),
      canonicalName: String(row.canonical_name || ''),
      headline: row.headline || null,
      currentTitle: row.current_title || null,
      currentCompany: row.current_company || null,
      location: row.location || null,
      skills: Array.isArray(row.skills) ? row.skills.map((value: unknown) => String(value)).filter(Boolean) : [],
      sourceProfiles: (sourceResult.data || []).map((source: any) => ({
        id: String(source.id),
        source: String(source.source || ''),
        status: source.status || null,
        searchAllowed: source.search_allowed !== false,
        retentionUntil: source.retention_until || null,
        usageScope: Array.isArray(source.usage_scope) ? source.usage_scope.map((value: unknown) => String(value)).filter(Boolean) : [],
      })),
      evidence: (evidenceResult.data || []).map((evidence: any) => ({
        id: String(evidence.id),
        source: String(evidence.source || ''),
        label: String(evidence.label || ''),
        detail: evidence.detail || null,
        sourceProfileId: evidence.source_profile_id || null,
        confidence: evidence.confidence ?? null,
        url: evidence.url || null,
      })),
    },
  }
}

export async function projectCandidateV39_1B(ownerId: string, candidateId: string): Promise<CandidateProjectionResultV39_1B> {
  const loaded = await loadProjectionCandidateV39_1B(ownerId, candidateId)
  if (!loaded.ok) {
    return { candidateId, ok: false, excludedSourceProfiles: 0, errorCode: loaded.errorCode }
  }

  const batch = buildNeo4jProjectionBatchV39_1(loaded.candidate)
  const projected = await projectNeo4jBatchV39_1B(ownerId, batch)
  return {
    candidateId,
    ok: projected.ok,
    excludedSourceProfiles: batch.excludedSourceProfileIds.length,
    errorCode: projected.ok ? undefined : projected.errorCode || 'neo4j_projection_failed',
  }
}

/**
 * Projects a deliberately small owner-scoped page. V39.1B keeps this bounded so
 * one stalled graph request cannot monopolize the web function; durable queue /
 * workflow fan-out is a subsequent tranche.
 */
export async function projectCandidatePageV39_1B(ownerId: string, input?: { limit?: number; afterCandidateId?: string | null }): Promise<ProjectionPageResultV39_1B> {
  if (!isSupabaseConfigured()) {
    return { ok: false, attempted: 0, succeeded: 0, failed: 0, excludedSourceProfiles: 0, nextCursor: null, hasMore: false, results: [], errorCode: 'supabase_unavailable' }
  }
  const sb = createServerSupabaseClient()
  if (!sb) {
    return { ok: false, attempted: 0, succeeded: 0, failed: 0, excludedSourceProfiles: 0, nextCursor: null, hasMore: false, results: [], errorCode: 'supabase_unavailable' }
  }

  const limit = Math.max(1, Math.min(10, Math.round(input?.limit || 5)))
  let query = sb
    .from('candidate_search_documents_v39')
    .select('candidate_id')
    .eq('owner_id', ownerId)
    .order('candidate_id', { ascending: true })
    .limit(limit + 1)

  if (input?.afterCandidateId) query = query.gt('candidate_id', input.afterCandidateId)
  const page = await query
  if (page.error) {
    return { ok: false, attempted: 0, succeeded: 0, failed: 0, excludedSourceProfiles: 0, nextCursor: null, hasMore: false, results: [], errorCode: 'projection_page_load_failed' }
  }

  const ids = (page.data || []).map((row: any) => String(row.candidate_id || '')).filter(Boolean)
  const hasMore = ids.length > limit
  const selected = ids.slice(0, limit)

  if (selected.length === 0) {
    return { ok: true, attempted: 0, succeeded: 0, failed: 0, excludedSourceProfiles: 0, nextCursor: null, hasMore: false, results: [] }
  }

  const schema = await ensureNeo4jProjectionSchemaV39_1B()
  if (!schema.ok) {
    return {
      ok: false,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      excludedSourceProfiles: 0,
      nextCursor: input?.afterCandidateId || null,
      hasMore: true,
      results: [],
      errorCode: schema.errorCode || 'neo4j_schema_unavailable',
    }
  }

  const results: CandidateProjectionResultV39_1B[] = []
  for (const candidateId of selected) {
    results.push(await projectCandidateV39_1B(ownerId, candidateId))
  }

  const succeeded = results.filter(result => result.ok).length
  const failed = results.length - succeeded
  return {
    ok: failed === 0,
    attempted: results.length,
    succeeded,
    failed,
    excludedSourceProfiles: results.reduce((total, result) => total + result.excludedSourceProfiles, 0),
    nextCursor: selected[selected.length - 1] || null,
    hasMore,
    results,
    errorCode: failed ? 'partial_projection_failure' : undefined,
  }
}
