// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase-candidate-graph.ts — Candidate graph persistence to Supabase.
// SERVER-ONLY. Uses service-role client (bypasses RLS) for batch upserts.
// All writes include owner_id; production routes should extract from auth token.
// ─────────────────────────────────────────────────────────────────────────────
import { CandidateDbSnapshot } from './candidate-db-v18'
import { createServerSupabaseClient, getDefaultOwnerId, isSupabaseConfigured } from './supabase/server'

export { isSupabaseConfigured as hasSupabaseCandidateGraphEnv }

export const requiredCandidateGraphEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

export interface PersistResult {
  ok: boolean
  mode: 'supabase' | 'preview' | 'scaffold'
  message: string
  written?: {
    candidates: number
    sourceProfiles: number
    evidenceItems: number
    contacts: number
    openToWorkSignals: number
    matchReviews: number
    importBatches: number
  }
  errors?: string[]
}

/**
 * Persist a full CandidateDbSnapshot to Supabase.
 * Falls back to preview mode when env vars are missing.
 *
 * ownerId: the Supabase auth.users UUID of the record owner.
 *          Use SUPABASE_DEFAULT_OWNER_ID for testing/admin scripts.
 *          Production callers should pass the authenticated user's ID.
 */
export async function persistCandidateGraphSnapshot(
  snapshot: CandidateDbSnapshot,
  ownerId?: string
): Promise<PersistResult> {

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: 'preview',
      message:
        'Supabase env vars not configured. Candidate Graph is in preview memory mode. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistence.',
    }
  }

  const owner = ownerId || getDefaultOwnerId()
  if (!owner) {
    return {
      ok: false,
      mode: 'supabase',
      message:
        'No owner_id available. Pass an authenticated user ID, or set SUPABASE_DEFAULT_OWNER_ID ' +
        'for admin/testing operations.',
    }
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return { ok: false, mode: 'supabase', message: 'Failed to create Supabase client.' }
  }

  const errors: string[] = []
  const written = {
    candidates: 0, sourceProfiles: 0, evidenceItems: 0,
    contacts: 0, openToWorkSignals: 0, matchReviews: 0, importBatches: 0,
  }

  // ── candidates ─────────────────────────────────────────────────────────────
  if (snapshot.candidates.length > 0) {
    const rows = snapshot.candidates.map(c => ({
      id: c.id,
      owner_id: owner,
      canonical_name: c.canonicalName,
      headline: c.headline || null,
      location: c.location || null,
      current_company: c.currentCompany || null,
      current_title: c.currentTitle || null,
      summary: c.summary || null,
      skills: c.skills || [],
      merge_status: c.mergeStatus || 'pending',
      last_refreshed_at: c.lastRefreshedAt || null,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }))
    const { error, count } = await sb
      .from('candidates')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`candidates: ${error.message}`)
    else written.candidates = count ?? rows.length
  }

  // ── source_profiles ────────────────────────────────────────────────────────
  if (snapshot.sourceProfiles.length > 0) {
    const rows = snapshot.sourceProfiles.map(sp => ({
      id: sp.id,
      owner_id: owner,
      candidate_id: sp.candidateId || null,
      source: sp.source,
      source_profile_id: sp.sourceProfileId,
      profile_url: sp.profileUrl || null,
      display_name: sp.displayName,
      headline: sp.headline || null,
      location: sp.location || null,
      organization: sp.organization || null,
      raw_text: sp.rawText || null,
      status: sp.status || 'pending',
      match_score: sp.matchScore || 0,
      match_reasons: sp.matchReasons || [],
      last_seen_at: sp.lastSeenAt,
      created_at: sp.createdAt,
    }))
    const { error, count } = await sb
      .from('source_profiles')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`source_profiles: ${error.message}`)
    else written.sourceProfiles = count ?? rows.length
  }

  // ── evidence_items ─────────────────────────────────────────────────────────
  if (snapshot.evidenceItems.length > 0) {
    const rows = snapshot.evidenceItems.map(e => ({
      id: e.id,
      owner_id: owner,
      candidate_id: e.candidateId || null,
      source_profile_id: e.sourceProfileId || null,
      source: e.source,
      label: e.label,
      detail: e.detail,
      confidence: e.confidence || 'medium',
      url: e.url || null,
      created_at: e.createdAt,
    }))
    const { error, count } = await sb
      .from('evidence_items')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`evidence_items: ${error.message}`)
    else written.evidenceItems = count ?? rows.length
  }

  // ── candidate_contacts ─────────────────────────────────────────────────────
  // GUARDRAIL: verified is always false. Never set to true.
  if (snapshot.contactSignals.length > 0) {
    const rows = snapshot.contactSignals.map(ct => ({
      id: ct.id,
      owner_id: owner,
      candidate_id: ct.candidateId || null,
      source_profile_id: ct.sourceProfileId || null,
      type: ct.type,
      value: ct.value,
      source: ct.source,
      confidence: ct.confidence || 'medium',
      verified: false as const,   // always false — enforced at DB level too
      permission_status: ct.permissionStatus || 'unknown',
      created_at: ct.createdAt,
    }))
    const { error, count } = await sb
      .from('candidate_contacts')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`candidate_contacts: ${error.message}`)
    else written.contacts = count ?? rows.length
  }

  // ── open_to_work_signals ───────────────────────────────────────────────────
  // GUARDRAIL: requires_review always true.
  if (snapshot.openToWorkSignals.length > 0) {
    const rows = snapshot.openToWorkSignals.map(s => ({
      id: s.id,
      owner_id: owner,
      candidate_id: s.candidateId || null,
      source_profile_id: s.sourceProfileId || null,
      source: s.source,
      label: s.label,
      detail: s.detail,
      confidence: s.confidence || 'medium',
      requires_review: true as const,  // always true
      created_at: s.createdAt,
    }))
    const { error, count } = await sb
      .from('open_to_work_signals')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`open_to_work_signals: ${error.message}`)
    else written.openToWorkSignals = count ?? rows.length
  }

  // ── identity_match_reviews ─────────────────────────────────────────────────
  // GUARDRAIL: decision='confirmed' requires decided_by to be non-null.
  if (snapshot.matchReviews.length > 0) {
    const rows = snapshot.matchReviews.map(r => ({
      id: r.id,
      owner_id: owner,
      candidate_id: r.candidateId || null,
      source_profile_ids: r.sourceProfileIds || [],
      match_score: r.score || 0,
      match_reasons: r.reasons || [],
      conflicts: r.conflicts || [],
      decision: r.decision || 'pending',
      decided_by: (r.decision !== 'pending' ? r.decidedBy : null) || null,
      decided_at: (r.decision !== 'pending' ? r.decidedAt : null) || null,
      created_at: r.createdAt,
    }))
    const { error, count } = await sb
      .from('identity_match_reviews')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`identity_match_reviews: ${error.message}`)
    else written.matchReviews = count ?? rows.length
  }

  // ── candidate_import_batches ───────────────────────────────────────────────
  if (snapshot.importBatches.length > 0) {
    const rows = snapshot.importBatches.map(b => ({
      id: b.id,
      owner_id: owner,
      import_type: b.importType,
      file_name: b.fileName || null,
      rows_seen: b.rowsSeen || 0,
      records_created: b.recordsCreated || 0,
      warnings: b.warnings || [],
      created_at: b.createdAt,
    }))
    const { error, count } = await sb
      .from('candidate_import_batches')
      .upsert(rows, { onConflict: 'id', count: 'exact' })
    if (error) errors.push(`import_batches: ${error.message}`)
    else written.importBatches = count ?? rows.length
  }

  const totalWritten = Object.values(written).reduce((a, b) => a + b, 0)
  return {
    ok: errors.length === 0,
    mode: 'supabase',
    message:
      errors.length === 0
        ? `Persisted ${totalWritten} records across ${Object.keys(written).length} tables.`
        : `Partial write: ${errors.length} table(s) failed. ${totalWritten} records written.`,
    written,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * List candidates from Supabase for a given owner.
 * Falls back to empty array when not configured.
 */
export async function listCandidatesFromSupabase(
  ownerId: string,
  limit = 50
): Promise<unknown[]> {
  if (!isSupabaseConfigured()) return []
  const sb = createServerSupabaseClient()
  if (!sb) return []
  const { data, error } = await sb
    .from('candidates')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data || []
}
