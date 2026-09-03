import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, type CandidateDbSnapshot } from '@/lib/candidate-db-v18'
import { buildCandidate360, scoreContactSignal, scoreOpenToWorkSignal, staleStatus } from '@/lib/candidate-intelligence-v18'
import { buildCandidateUniverseProjectionV36 } from '@/lib/candidate-universe-v36'
import { buildEvidenceLedger } from '@/lib/evidence-ledger'
import { resolveCandidate360FieldsV35 } from '@/lib/candidate-field-resolution-v35'
import { candidateIdentityFamiliesV36_10, resolveCanonicalCandidateIdV36_10 } from '@/lib/candidate-identity-redirects-v36-10'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

function conflictText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.explanation === 'string') return record.explanation
    if (typeof record.type === 'string') return record.type
  }
  return 'Identity evidence conflict requires review.'
}

function buildDossierFromSupabase(
  candidate: Record<string, unknown>,
  sourceProfiles: Record<string, unknown>[],
  evidence: Record<string, unknown>[],
  contacts: Record<string, unknown>[],
  openToWorkSignals: Record<string, unknown>[],
  matchReviews: Record<string, unknown>[],
  projectCandidates: Record<string, unknown>[],
  roleCandidates: Record<string, unknown>[],
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
    rawText: typeof p.raw_text === 'string' ? p.raw_text : undefined,
    matchReasons: p.match_reasons || [], status: p.status || 'pending',
    matchScore: p.match_score || 0, lastSeenAt: p.last_seen_at,
    createdAt: p.created_at, candidateId: p.candidate_id,
  }))

  const evidenceItems = evidence.map((e: any) => ({
    id: e.id, source: e.source, label: e.label, detail: e.detail,
    confidence: e.confidence || 'medium', url: e.url,
    spanStart: typeof e.span_start === 'number' ? e.span_start : undefined,
    spanEnd: typeof e.span_end === 'number' ? e.span_end : undefined,
    spanText: typeof e.span_text === 'string' ? e.span_text : undefined,
    sourceTextRef: typeof e.source_text_ref === 'string' ? e.source_text_ref : undefined,
    candidateId: e.candidate_id, sourceProfileId: e.source_profile_id, createdAt: e.created_at,
  }))

  const mappedContacts = contacts.map((ct: any) => ({
    id: ct.id, type: ct.type, value: ct.value, source: ct.source,
    confidence: ct.confidence || 'medium', verified: false as const,
    permissionStatus: ct.permission_status || 'unknown',
    candidateId: ct.candidate_id, sourceProfileId: ct.source_profile_id, createdAt: ct.created_at,
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
    conflicts: Array.isArray(r.conflicts) ? r.conflicts.map(conflictText) : [], decision: r.decision || 'pending',
    decidedBy: r.decided_by, decidedAt: r.decided_at, createdAt: r.created_at,
  }))

  const candidateId = String(candidate.id || '')
  const resolutionSnapshot = {
    candidates: [cand],
    sourceProfiles: profiles,
    evidenceItems,
    contactSignals: mappedContacts,
    openToWorkSignals: otwSignals,
    matchReviews: reviews,
    importBatches: [],
  } as unknown as CandidateDbSnapshot
  const ledger = buildEvidenceLedger(resolutionSnapshot, { candidateId })
  const resolvedProfile = resolveCandidate360FieldsV35(resolutionSnapshot, ledger, candidateId)

  const freshness = staleStatus(cand as any, profiles as any)
  const contactsWithScore = mappedContacts.map(ct => ({ ...ct, score: scoreContactSignal(ct as any) }))
  const otwWithScore = otwSignals.map(s => ({ ...s, score: scoreOpenToWorkSignal(s as any) }))

  const verifyNext: string[] = [
    'Confirm current title and company from a primary source.',
    'Review source-profile identity matches before merging any profiles.',
    'Verify contact information through an approved workflow before outreach.',
    'Treat open-to-work signals as signals to review, not verified job-seeking claims.',
  ]
  if (resolvedProfile.reviewCount > 0 || resolvedProfile.conflictCount > 0) {
    verifyNext.unshift('Resolve competing Candidate 360 field observations before treating the canonical profile as current.')
  }
  if (mappedContacts.some(c => c.type === 'email')) {
    verifyNext.push('Email contact found — verify permission status before sending outreach.')
  }
  if (otwSignals.length > 0) {
    verifyNext.push('Open-to-work signal detected — confirm current status directly with the candidate.')
  }
  if (projectCandidates.length > 0) {
    verifyNext.push('Confirm project-specific fit assessment before HM presentation.')
  }

  const universe = buildCandidateUniverseProjectionV36({
    candidateId,
    profiles: sourceProfiles as any[],
    evidenceItems: evidence as any[],
    roleCandidates: roleCandidates as any[],
    candidateCreatedAt: typeof candidate.created_at === 'string' ? candidate.created_at : undefined,
    candidateUpdatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : undefined,
  })

  return {
    candidate: cand, resolvedProfile, sourceProfiles: profiles, evidence: evidenceItems,
    contacts: contactsWithScore, openToWorkSignals: otwWithScore, matchReviews: reviews,
    projectCandidates, universe, freshness, verifyNext, mode: 'supabase' as const,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(_req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const { id: requestedCandidateId } = await params

  // ── Supabase mode ──────────────────────────────────────────────────────────
  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: 'Authentication required.', mode: 'supabase' }, { status: 401 })
    }

    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    const ownerId = session.userId!
    const canonical = await resolveCanonicalCandidateIdV36_10({ sb, ownerId, candidateId: requestedCandidateId })
    const candidateId = canonical.candidateId
    const identityFamilies = await candidateIdentityFamiliesV36_10({ sb, ownerId, candidateIds: [candidateId] })
    const familyCandidateIds = identityFamilies.canonicalToFamily.get(candidateId) || [candidateId]

    // Candidate-level historical rows may remain on an absorbed audit ID when
    // they were never source-profile-backed. Read the confirmed identity family
    // together, but keep the canonical candidate row as the one person record.
    const [candRes, spRes, evRes, ctRes, otwRes, mrRes, pcRes, rcRes] = await Promise.all([
      sb.from('candidates').select('*').eq('id', candidateId).eq('owner_id', ownerId).single(),
      sb.from('source_profiles').select('*').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('evidence_items').select('*').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('candidate_contacts').select('*').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId),
      sb.from('open_to_work_signals').select('*').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId),
      sb.from('identity_match_reviews').select('*').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId).order('created_at', { ascending: false }),
      sb.from('project_candidates').select('id,candidate_id,project_id,stage,fit_score,fit_evidence,fit_missing,fit_confidence,added_at,updated_at').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId),
      sb.from('role_candidates').select('candidate_id,role_id,stage,fit_decision,fit_reasons,concerns,added_at,updated_at').in('candidate_id', familyCandidateIds).eq('owner_id', ownerId),
    ])

    if (candRes.error || !candRes.data) {
      return NextResponse.json({
        ok: false,
        error: candRes.error?.message || 'Candidate not found.',
        mode: 'supabase',
      }, { status: 404 })
    }

    const failedSections = [
      { section: 'sourceProfiles', error: spRes.error },
      { section: 'evidence', error: evRes.error },
      { section: 'contacts', error: ctRes.error },
      { section: 'openToWorkSignals', error: otwRes.error },
      { section: 'matchReviews', error: mrRes.error },
      { section: 'projectCandidates', error: pcRes.error },
      { section: 'roleCandidates', error: rcRes.error },
    ].filter(item => Boolean(item.error)).map(item => item.section)

    if (failedSections.length) {
      return NextResponse.json({
        ok: false,
        error: 'Candidate dossier relationships could not be loaded.',
        failedSections,
        mode: 'supabase',
      }, { status: 502 })
    }

    const dossier = buildDossierFromSupabase(
      candRes.data, spRes.data || [], evRes.data || [], ctRes.data || [],
      otwRes.data || [], mrRes.data || [], pcRes.data || [], rcRes.data || [],
    )
    return NextResponse.json({
      ok: true,
      dossier: {
        ...dossier,
        identity: {
          canonicalCandidateId: candidateId,
          requestedCandidateId,
          redirected: canonical.redirected,
          familyCandidateIds,
          absorbedCandidateIds: familyCandidateIds.filter(id => id !== candidateId),
          migrationReady: canonical.migrationReady && identityFamilies.migrationReady,
          trustBoundary: 'Identity family membership exists only after recruiter-authorized source-profile reassignment. Historical candidate IDs remain audit references, not separate active people.',
        },
      },
    })
  }

  // ── Preview fallback — in-memory, clearly labelled ─────────────────────────
  const candidateId = requestedCandidateId
  const db = getCandidateDb()
  const dossier = buildCandidate360(db, candidateId)
  if (!dossier) {
    return NextResponse.json({
      ok: false, error: 'Candidate not found (preview mode — data resets on cold start).', mode: 'preview',
    }, { status: 404 })
  }

  const previewCandidate = db.candidates.find(candidate => candidate.id === candidateId)
  const previewProfiles = db.sourceProfiles.filter(profile => profile.candidateId === candidateId)
  const previewEvidence = db.evidenceItems.filter(item => item.candidateId === candidateId)
  const ledger = buildEvidenceLedger(db, { candidateId })
  const resolvedProfile = resolveCandidate360FieldsV35(db, ledger, candidateId)
  const universe = buildCandidateUniverseProjectionV36({
    candidateId,
    profiles: previewProfiles.map(profile => ({
      id: profile.id,
      candidate_id: profile.candidateId,
      source: profile.source,
      source_profile_id: profile.sourceProfileId,
      profile_url: profile.profileUrl,
      headline: profile.headline,
      organization: profile.organization,
      raw: (() => { try { return profile.rawText ? JSON.parse(profile.rawText) : undefined } catch { return undefined } })(),
      last_seen_at: profile.lastSeenAt,
      created_at: profile.createdAt,
    })),
    evidenceItems: previewEvidence.map(item => ({ candidate_id: item.candidateId, created_at: item.createdAt })),
    roleCandidates: [],
    candidateCreatedAt: previewCandidate?.createdAt,
    candidateUpdatedAt: previewCandidate?.updatedAt,
  })

  return NextResponse.json({ ok: true, dossier: { ...dossier, resolvedProfile, universe, mode: 'preview' } })
}
