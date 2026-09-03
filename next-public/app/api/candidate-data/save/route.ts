import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import { createDeterministicIdentityProposals } from '@/lib/identity-proposal-service-v33-2'
import { providerObservationToSourceResultV36_8, verifyProviderObservationV36_8 } from '@/lib/candidate-data/provider-observation-bridge-v36-8'
import type { CandidateProviderObservationV36_8 } from '@/lib/candidate-data/types-v36-8'

export const dynamic = 'force-dynamic'

function errorResponse(scope: string, message: string, status = 500) {
  return NextResponse.json({ ok: false, error: `${scope}: ${message}` }, { status })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  const session = await getRouteSession()

  try {
    const body = await req.json() as { observation?: CandidateProviderObservationV36_8; observationSignature?: string; projectId?: string }
    if (!body.observation || !body.observationSignature) return NextResponse.json({ ok: false, error: 'Signed provider observation is required.' }, { status: 400 })
    if (!verifyProviderObservationV36_8(body.observation, body.observationSignature)) {
      return NextResponse.json({ ok: false, code: 'provider_observation_signature_invalid', error: 'Provider observation could not be verified as a server-returned search result.' }, { status: 422 })
    }

    // Rebuild the entire SourceResult from the signed normalized observation.
    // Client-supplied entity kind, skills, contacts, and evidence are ignored.
    const normalizedResult = providerObservationToSourceResultV36_8(body.observation)
    const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : undefined

    if (!isSupabaseConfigured()) {
      const db = getCandidateDb()
      const existingProfile = db.sourceProfiles.find(profile => profile.source === normalizedResult.source && profile.sourceProfileId === normalizedResult.sourceProfileId)
      if (existingProfile?.candidateId) {
        return NextResponse.json({ ok: true, mode: 'preview', reused: true, candidateId: existingProfile.candidateId, sourceProfileId: existingProfile.id, candidateUrl: `/app/candidate/${existingProfile.candidateId}`, identityProposals: { created: [], considered: 0, anchored: 0 }, note: 'Signed provider observation reused in preview. Candidate remains pending recruiter review.' })
      }

      const candidateId = uid('cand')
      const spId = existingProfile?.id || uid('sp')
      if (existingProfile) {
        existingProfile.candidateId = candidateId
        existingProfile.rawText = JSON.stringify(normalizedResult)
        existingProfile.lastSeenAt = nowIso()
      } else {
        db.sourceProfiles.unshift({ id: spId, source: normalizedResult.source, sourceProfileId: normalizedResult.sourceProfileId, displayName: normalizedResult.displayName, headline: normalizedResult.headline || '', location: normalizedResult.location || '', organization: normalizedResult.organization || '', rawText: JSON.stringify(normalizedResult), status: 'pending', matchScore: 0, matchReasons: [], candidateId, lastSeenAt: nowIso(), createdAt: nowIso() })
      }
      db.candidates.unshift({ id: candidateId, canonicalName: normalizedResult.displayName, headline: normalizedResult.headline || '', location: normalizedResult.location || '', currentCompany: normalizedResult.organization || '', skills: normalizedResult.skills, summary: `Provider observation from ${normalizedResult.source}. Pending recruiter review.`, mergeStatus: 'pending', sourceProfileIds: [spId], evidenceItemIds: normalizedResult.evidence.map(item => item.id), contactSignalIds: [], openToWorkSignalIds: [], createdAt: nowIso(), updatedAt: nowIso() })
      return NextResponse.json({ ok: true, mode: 'preview', candidateId, sourceProfileId: spId, candidateUrl: `/app/candidate/${candidateId}`, identityProposals: { created: [], considered: 0, anchored: 0 }, note: 'Signed provider observation saved to preview Candidate Graph. No identity merge or recruiter decision was performed.' })
    }

    if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
    const ownerId = session.userId!

    const { data: existingProfile, error: lookupError } = await sb.from('source_profiles').select('id,candidate_id').eq('owner_id', ownerId).eq('source', normalizedResult.source).eq('source_profile_id', normalizedResult.sourceProfileId).maybeSingle()
    if (lookupError) return errorResponse('provider source profile lookup', lookupError.message)

    const { data: profileData, error: profileError } = await sb.from('source_profiles').upsert({
      owner_id: ownerId,
      source: normalizedResult.source,
      source_profile_id: normalizedResult.sourceProfileId,
      profile_url: normalizedResult.profileUrl || null,
      display_name: normalizedResult.displayName,
      headline: normalizedResult.headline || null,
      location: normalizedResult.location || null,
      organization: normalizedResult.organization || null,
      raw: normalizedResult,
      status: 'pending',
      match_score: 0,
      match_reasons: [],
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,source,source_profile_id' }).select('id,candidate_id').single()
    if (profileError) return errorResponse('provider source profile write', profileError.message)

    const sourceProfileId = profileData.id
    const isNewSourceIdentity = !existingProfile?.candidate_id && !profileData.candidate_id
    let candidateId: string | null = profileData.candidate_id || existingProfile?.candidate_id || null
    let createdCandidateId: string | null = null

    if (!candidateId) {
      const { data: candidateData, error: candidateError } = await sb.from('candidates').insert({ owner_id: ownerId, canonical_name: normalizedResult.displayName, headline: normalizedResult.headline || null, location: normalizedResult.location || null, current_company: normalizedResult.organization || null, skills: normalizedResult.skills, summary: `Provider observation from ${normalizedResult.source}. Pending recruiter review. Not verified.`, merge_status: 'pending' }).select('id').single()
      if (candidateError) return errorResponse('provider candidate write', candidateError.message)
      createdCandidateId = candidateData.id
      const { data: linkedProfile, error: linkError } = await sb.from('source_profiles').update({ candidate_id: createdCandidateId }).eq('id', sourceProfileId).eq('owner_id', ownerId).is('candidate_id', null).select('candidate_id').maybeSingle()
      if (linkError) return errorResponse('provider source profile link', linkError.message)
      if (linkedProfile?.candidate_id) candidateId = linkedProfile.candidate_id
      else {
        const { data: reconciled, error: reconcileError } = await sb.from('source_profiles').select('candidate_id').eq('id', sourceProfileId).eq('owner_id', ownerId).single()
        if (reconcileError || !reconciled?.candidate_id) return errorResponse('provider source profile reconcile', reconcileError?.message || 'Candidate link was not established.')
        candidateId = reconciled.candidate_id
        if (candidateId !== createdCandidateId) {
          const { error: cleanupError } = await sb.from('candidates').delete().eq('id', createdCandidateId).eq('owner_id', ownerId)
          if (cleanupError) return errorResponse('provider candidate reconciliation cleanup', cleanupError.message)
        }
      }
    }
    if (!candidateId) return errorResponse('provider candidate link', 'No canonical candidate was resolved.')

    const { data: existingEvidence, error: evidenceLookupError } = await sb.from('evidence_items').select('source,label,detail,url').eq('owner_id', ownerId).eq('source_profile_id', sourceProfileId)
    if (evidenceLookupError) return errorResponse('provider evidence lookup', evidenceLookupError.message)
    const evidenceKeys = new Set((existingEvidence || []).map(item => [item.source, item.label, item.detail, item.url || ''].join('\u0000')))
    const newEvidence = normalizedResult.evidence.filter(item => !evidenceKeys.has([item.source, item.label, item.detail, item.url || ''].join('\u0000')))
    if (newEvidence.length) {
      const { error } = await sb.from('evidence_items').insert(newEvidence.map(item => ({ owner_id: ownerId, candidate_id: candidateId, source_profile_id: sourceProfileId, source: item.source, label: item.label, detail: item.detail, confidence: item.confidence, url: item.url || null })))
      if (error) return errorResponse('provider evidence write', error.message)
    }

    const { data: existingContacts, error: contactLookupError } = await sb.from('candidate_contacts').select('type,value,source').eq('owner_id', ownerId).eq('source_profile_id', sourceProfileId)
    if (contactLookupError) return errorResponse('provider contact lookup', contactLookupError.message)
    const contactKeys = new Set((existingContacts || []).map(item => [item.type, item.value, item.source].join('\u0000')))
    const newContacts = normalizedResult.contactSignals.filter(item => !contactKeys.has([item.type, item.value, item.source].join('\u0000')))
    if (newContacts.length) {
      const { error } = await sb.from('candidate_contacts').insert(newContacts.map(item => ({ owner_id: ownerId, candidate_id: candidateId, source_profile_id: sourceProfileId, type: item.type, value: item.value, source: item.source, confidence: 'medium', verified: false, permission_status: 'unknown' })))
      if (error) return errorResponse('provider contact/link write', error.message)
    }

    const identityProposals = isNewSourceIdentity
      ? await createDeterministicIdentityProposals({ sb, ownerId, incomingSourceProfileId: sourceProfileId, incomingCandidateId: candidateId, incomingResult: normalizedResult })
      : { created: [], considered: 0, anchored: 0 }

    let projectCandidateId: string | null = null
    if (projectId) {
      const { data: projectCandidate, error: projectError } = await sb.from('project_candidates').upsert({ project_id: projectId, candidate_id: candidateId, owner_id: ownerId, stage: 'sourced', fit_score: null, fit_evidence: [], fit_missing: [], fit_confidence: 'low' }, { onConflict: 'project_id,candidate_id' }).select('id').single()
      if (projectError) return errorResponse('provider project candidate write', projectError.message)
      projectCandidateId = projectCandidate.id
    }

    return NextResponse.json({
      ok: true,
      mode: 'supabase',
      reused: Boolean(existingProfile?.candidate_id || profileData.candidate_id),
      candidateId,
      sourceProfileId,
      projectCandidateId,
      identityProposals,
      candidateUrl: `/app/candidate/${candidateId}`,
      note: identityProposals.created.length
        ? `Signed provider observation saved. ${identityProposals.created.length} deterministic cross-source identity proposal${identityProposals.created.length === 1 ? '' : 's'} await recruiter review; nothing was merged automatically.`
        : 'Signed provider observation saved. Candidate remains pending recruiter review.',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Provider observation save failed.' }, { status: 500 })
  }
}
