import 'server-only'
import { buildEvidenceLedger, type EvidenceLedgerSnapshot, type LegacyCandidateDbSnapshot } from './evidence-ledger'
import { createServerSupabaseClient, isSupabaseConfigured } from './supabase/server'

type Row = Record<string, unknown>

type EvidenceLedgerReadResult =
  | { ok: true; ledger: EvidenceLedgerSnapshot }
  | { ok: false; error: string }

function stringValue(row: Row, key: string, fallback = ''): string {
  const value = row[key]
  return typeof value === 'string' ? value : fallback
}

function optionalString(row: Row, key: string): string | undefined {
  const value = row[key]
  return typeof value === 'string' && value ? value : undefined
}

function stringArray(row: Row, key: string): string[] {
  const value = row[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberValue(row: Row, key: string): number {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function confidenceValue(row: Row, key: string): 'low' | 'medium' | 'high' {
  const value = row[key]
  return value === 'low' || value === 'high' ? value : 'medium'
}

function decisionValue(row: Row, key: string): 'pending' | 'confirmed' | 'rejected' {
  const value = row[key]
  return value === 'confirmed' || value === 'rejected' ? value : 'pending'
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : []
}

export async function listEvidenceLedgerFromSupabase(
  ownerId: string,
  candidateId?: string,
): Promise<EvidenceLedgerReadResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase is not configured.' }
  const sb = createServerSupabaseClient()
  if (!sb) return { ok: false, error: 'Failed to create the server database client.' }

  let candidateQuery = sb
    .from('candidates')
    .select('id, canonical_name, headline, location')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(250)

  let sourceProfileQuery = sb
    .from('source_profiles')
    .select('id, candidate_id, source, profile_url')
    .eq('owner_id', ownerId)
    .limit(2000)

  const evidenceQuery = sb
    .from('evidence_items')
    .select('id, candidate_id, source_profile_id, source, label, detail, confidence, url, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(5000)

  const contactQuery = sb
    .from('candidate_contacts')
    .select('id, candidate_id, source_profile_id, type, value, source, confidence, verified, permission_status, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(2000)

  const availabilityQuery = sb
    .from('open_to_work_signals')
    .select('id, candidate_id, source_profile_id, source, label, detail, confidence, requires_review, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(2000)

  const reviewQuery = sb
    .from('identity_match_reviews')
    .select('id, candidate_id, source_profile_ids, match_score, match_reasons, conflicts, decision, decided_by, decided_at, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (candidateId) {
    candidateQuery = candidateQuery.eq('id', candidateId)
    sourceProfileQuery = sourceProfileQuery.eq('candidate_id', candidateId)
    // Evidence/contact rows may be linked through source_profile_id while candidate_id is null.
    // Keep all reads owner-scoped, then let buildEvidenceLedger resolve and filter those relationships.
  }

  const [candidateResult, sourceProfileResult, evidenceResult, contactResult, availabilityResult, reviewResult] = await Promise.all([
    candidateQuery,
    sourceProfileQuery,
    evidenceQuery,
    contactQuery,
    availabilityQuery,
    reviewQuery,
  ])

  const queryErrors = [candidateResult, sourceProfileResult, evidenceResult, contactResult, availabilityResult, reviewResult]
    .map(result => result.error?.message)
    .filter((message): message is string => Boolean(message))

  if (queryErrors.length) return { ok: false, error: queryErrors.join(' | ') }

  const candidates = rows(candidateResult.data).map(row => ({
    id: stringValue(row, 'id'),
    canonicalName: stringValue(row, 'canonical_name', 'Unnamed candidate'),
    headline: optionalString(row, 'headline'),
    location: optionalString(row, 'location'),
  }))

  const sourceProfiles = rows(sourceProfileResult.data).map(row => ({
    id: stringValue(row, 'id'),
    candidateId: optionalString(row, 'candidate_id'),
    source: stringValue(row, 'source', 'unknown'),
    profileUrl: optionalString(row, 'profile_url'),
  }))

  const evidenceItems = rows(evidenceResult.data).map(row => ({
    id: stringValue(row, 'id'),
    candidateId: optionalString(row, 'candidate_id'),
    sourceProfileId: optionalString(row, 'source_profile_id'),
    source: stringValue(row, 'source', 'unknown'),
    label: stringValue(row, 'label', 'Evidence claim'),
    detail: stringValue(row, 'detail'),
    confidence: confidenceValue(row, 'confidence'),
    url: optionalString(row, 'url'),
    createdAt: stringValue(row, 'created_at', new Date(0).toISOString()),
  }))

  const contactSignals = rows(contactResult.data).map(row => ({
    id: stringValue(row, 'id'),
    candidateId: optionalString(row, 'candidate_id'),
    sourceProfileId: optionalString(row, 'source_profile_id'),
    type: stringValue(row, 'type', 'other'),
    value: stringValue(row, 'value'),
    source: stringValue(row, 'source', 'unknown'),
    confidence: confidenceValue(row, 'confidence'),
    verified: false,
    permissionStatus: row.permission_status === 'candidate_provided' || row.permission_status === 'company_owned' || row.permission_status === 'do_not_contact'
      ? row.permission_status
      : 'unknown',
    createdAt: stringValue(row, 'created_at', new Date(0).toISOString()),
  }))

  const openToWorkSignals = rows(availabilityResult.data).map(row => ({
    id: stringValue(row, 'id'),
    candidateId: optionalString(row, 'candidate_id'),
    sourceProfileId: optionalString(row, 'source_profile_id'),
    source: stringValue(row, 'source', 'unknown'),
    label: stringValue(row, 'label', 'Availability signal'),
    detail: stringValue(row, 'detail'),
    confidence: confidenceValue(row, 'confidence'),
    requiresReview: true,
    createdAt: stringValue(row, 'created_at', new Date(0).toISOString()),
  }))

  const matchReviews = rows(reviewResult.data).map(row => ({
    id: stringValue(row, 'id'),
    candidateId: optionalString(row, 'candidate_id'),
    sourceProfileIds: stringArray(row, 'source_profile_ids'),
    proposedCanonicalName: 'Candidate identity review',
    score: numberValue(row, 'match_score'),
    reasons: stringArray(row, 'match_reasons'),
    conflicts: stringArray(row, 'conflicts'),
    decision: decisionValue(row, 'decision'),
    decidedBy: optionalString(row, 'decided_by'),
    decidedAt: optionalString(row, 'decided_at'),
    createdAt: stringValue(row, 'created_at', new Date(0).toISOString()),
  }))

  const snapshot: LegacyCandidateDbSnapshot = {
    candidates,
    sourceProfiles,
    evidenceItems,
    contactSignals,
    openToWorkSignals,
    matchReviews,
  }

  return { ok: true, ledger: buildEvidenceLedger(snapshot, { candidateId }) }
}
