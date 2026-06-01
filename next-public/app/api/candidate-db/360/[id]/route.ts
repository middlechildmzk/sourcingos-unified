import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { buildCandidate360, scoreContactSignal, scoreOpenToWorkSignal, staleStatus } from '@/lib/candidate-intelligence-v18'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

function buildDossierFromSupabase(
  candidate: Record<string, unknown>,
  sourceProfiles: Record<string, unknown>[],
  evidence: Record<string, unknown>[],
  contacts: Record<string, unknown>[],
  openToWorkSignals: Record<string, unknown>[],
  matchReviews: Record<string, unknown>[],
  projectCandidates: Record<string, unknown>[]
) {
  const cand = {
    id: candidate.id, canonicalName: candidate.canonical_name,
    headline: candidate.headline, location: candidate.location,
    currentCompany: candidate.current_company, currentTitle: candidate.current_title,
    summary: candidate.summary, skills: candidate.skills || [],
    mergeStatus: candidate.merge_status || 'pending',
    lastRefreshedAt: candidate.last_refreshed_at,
    createdAt: candidate.created_at, updatedAt: candidate.updated_at,
    sourceProfileIds: sourceProfiles.map((p: any) => p.id),
    evidenceItemIds: evidence.map((e: any) => e.id),
    contactSignalIds: contacts.map((c: any) => c.id),
    openToWorkSignalIds: openToWorkSignals.map((s: any) => s.id),
  }

  const profiles = sourceProfiles.map((p: any) => ({
    id: p.id, source: p.source, sourceProfileId: p.source_profile_id,
    displayName: p.display_name, headline: p.headline, location: p.location,
    organization: p.organization, profileUrl: p.profile_url,
    matchReasons: p.match_reasons || [], status: p.status || 'pending',
    matchScore: p.match_score || 0, lastSeenAt: p.last_seen_at,
    createdAt: p.created_at, candidateId: p.candidate_id,
  }))

  const evidenceItems = evidence.map((e: any) => ({
    id: e.id, source: e.source, label: e.label, detail: e.detail,
    confidence: e.confidence || 'medium', url: e.url,
    candidateId: e.candidate_id, sourceProfileId: e.source_profile_id, createdAt: e.created_at,
  }))

  const mappedContacts = contacts.map((ct: any) => ({
    id: ct.id, type: ct.type, value: ct.value, source: ct.source,
    confidence: ct.confidence || 'medium', verified: false as const,
    permissionStatus: ct.permission_status || 'unknown',
    candidateId: ct.candidate_id, createdAt: ct.created_at,
  }))

  const otwSignals = openToWorkSignals.map((s: any) => ({
    id: s.id, source: s.source, label: s.label, detail: s.detail,
    confidence: s.confidence || 'medium', requiresReview: true as const,
    candidateId: s.candidate_id, sourceProfileId: s.source_profile_id, createdAt: s.created_at,
  }))

  const reviews = matchReviews.map((r: any) => ({
    id: r.id, candidateId: r.candidate_id, sourceProfileIds: r.source_profile_ids || [],
    proposedCanonicalName: candidate.canonical_name as string,
    score: r.match_score || 0, reasons: r.match_reasons || [],
    conflicts: r.conflicts || [], decision: r.decision || 'pending',
    decidedBy: r.decided_by, decidedAt: r.decided_at, createdAt: r.created_at,
  }))

  const freshness = staleStatus(cand as any, profiles as any)
  const contactsWithScore = mappedContacts.map(ct => ({ ...ct, score: scoreContactSignal(ct as any) }))
  const otwWithScore = otwSignals.map(s => ({ ...s, score: scoreOpenToWorkSignal(s as any) }))
  const bestContactScore = Math.max(0, ...contactsWithScore.map(c => c.score))
  const openToWorkScore = Math.max(0, ...otwWithScore.map(s => s.score))
  const evidenceScore = Math.min(100, evidenceItems.length * 6 + profiles.length * 12)

  const verifyNext: string[] = [
    'Confirm current title and company from a primary source.',
    'Review source-profile identity matches before merging any profiles.',
    'Verify contact information through an approved workflow before outreach.',
    'Treat open-to-work signals as signals to review, not verified job-seeking claims.',
  ]
  if (mappedContacts.some(c => c.type === 'email')) {
    verifyNext.push('Email contact found — verify permission status before sending outreach.')
  }
  if (otwSignals.length > 0) {
    verifyNext.push('Open-to-work signal detected — confirm current status directly with the candidate.')
  }
  if (projectCandidates.length > 0) {
    verifyNext.push('Confirm project-specific fit assessment before HM presentation.')
  }

  return {
    candidate: cand, sourceProfiles: profiles, evidence: evidenceItems,
    contacts: contactsWithScore, openToWorkSignals: otwWithScore, matchReviews: reviews,
    projectCandidates, freshness, scores: { bestContactScore, openToWorkScore, evidenceScore },
    verifyNext, mode: 'supabase' as const,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const candidateId = params.id

  // ── Supabase mode ──────────────────────────────────────────────────────────
  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: 'Authentication required.', mode: 'supabase' }, { status: 401 })
    }

    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    const ownerId = session.userId!

    // Fetch all related tables in parallel, scoped to owner_id
    const [candRes, spRes, evRes, ctRes, otwRes, mrRes, pcRes] = await Promise.all([
      sb.from('candidates').select('*').eq('id', candidateId).eq('owner_id', ownerId).single(),
      sb.from('source_profiles').select('*').eq('candidate_id', candidateId).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('evidence_items').select('*').eq('candidate_id', candidateId).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('candidate_contacts').select('*').eq('candidate_id', candidateId).eq('owner_id', ownerId),
      sb.from('open_to_work_signals').select('*').eq('candidate_id', candidateId).eq('owner_id', ownerId),
      sb.from('identity_match_reviews').select('*').eq('candidate_id', candidateId).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('project_candidates').select('id,project_id,stage,fit_score,fit_evidence,fit_missing,fit_confidence,added_at,updated_at').eq('candidate_id', candidateId).eq('owner_id', ownerId),
    ])

    if (candRes.error || !candRes.data) {
      return NextResponse.json({
        ok: false,
        error: candRes.error?.message || 'Candidate not found.',
        mode: 'supabase',
      }, { status: 404 })
    }

    const dossier = buildDossierFromSupabase(
      candRes.data, spRes.data || [], evRes.data || [], ctRes.data || [],
      otwRes.data || [], mrRes.data || [], pcRes.data || []
    )
    return NextResponse.json({ ok: true, dossier })
  }

  // ── Preview fallback — in-memory, clearly labelled ─────────────────────────
  const db = getCandidateDb()
  const dossier = buildCandidate360(db, candidateId)
  if (!dossier) {
    return NextResponse.json({
      ok: false, error: 'Candidate not found (preview mode — data resets on cold start).', mode: 'preview',
    }, { status: 404 })
  }
  return NextResponse.json({ ok: true, dossier: { ...dossier, mode: 'preview' } })
}
