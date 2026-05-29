import { CandidateDbSnapshot } from './candidate-db-v18'

export function hasSupabaseCandidateGraphEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function persistCandidateGraphSnapshot(_snapshot: CandidateDbSnapshot) {
  if (!hasSupabaseCandidateGraphEnv()) {
    return {
      ok: false,
      mode: 'preview',
      message: 'Supabase env vars are not configured. Candidate Graph is using preview memory storage.'
    }
  }

  // Scaffold only. Production implementation should use @supabase/supabase-js
  // with RLS-safe policies, service-role writes only from server routes,
  // and table-by-table upserts into candidates, source_profiles,
  // evidence_items, candidate_contacts, open_to_work_signals,
  // identity_match_reviews, and candidate_refresh_events.
  return {
    ok: false,
    mode: 'scaffold',
    message: 'Supabase env vars detected, but persistent writes are intentionally not enabled until RLS and QA are completed.'
  }
}

export const requiredCandidateGraphEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]
