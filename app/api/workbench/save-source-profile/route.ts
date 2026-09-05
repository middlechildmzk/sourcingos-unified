import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import { classifySourceResult } from '@/lib/entity-classification'
import { createDeterministicIdentityProposals } from '@/lib/identity-proposal-service-v33-2'
import type { SourceResult } from '@/lib/source-types'

// Save one person source profile to the Candidate Graph.
// Non-person source subjects fail closed. Repeated saves reuse the existing
// candidate rather than creating or relinking a new identity.

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
    const body = await req.json()
    const { sourceResult, projectId } = body

    if (!sourceResult?.id || !sourceResult?.displayName || !sourceResult?.source || !sourceResult?.sourceProfileId) {
      return NextResponse.json(
        { ok: false, error: 'sourceResult.id, source, sourceProfileId, and displayName are required.' },
        { status: 400 },
      )
    }

    // Request bodies are untrusted. Re-run the same source-role and claim truth
    // boundary used by search before any candidate, evidence, or contact write.
    // This prevents a client from relabelling publications/artifacts as people,
    // copying recruiter query terms into skills, or saving profile links as
    // contact information.
    const normalizedResult = classifySourceResult({
      ...sourceResult,
      entityKind: sourceResult.entityKind || 'unknown',
      skills: Array.isArray(sourceResult.skills) ? sourceResult.skills : [],
      evidence: Array.isArray(sourceResult.evidence) ? sourceResult.evidence : [],
      contactSignals: Array.isArray(sourceResult.contactSignals) ? sourceResult.contactSignals : [],
      identitySignals: Array.isArray(sourceResult.identitySignals) ? sourceResult.identitySignals : [],
      refreshedAt: sourceResult.refreshedAt || new Date().toISOString(),
    } as SourceResult)

    const entityKind = normalizedResult.entityKind
    if (entityKind !== 'person') {
      return NextResponse.json({
        ok: false,
        error: `Only person records can be saved as candidates. Received ${entityKind}.`,
        entityKind,
      }, { status: 422 })
    }

    // Preview mode remains idempotent within the current process. Cross-source
    // proposal creation is durable-only so preview state cannot imply a review
    // exists when the page/process disappears.
    if (!isSupabaseConfigured()) {
      const db = getCandidateDb()
      const existingProfile = db.sourceProfiles.find(profile =>
        profile.source === normalizedResult.source
        && profile.sourceProfileId === normalizedResult.sourceProfileId
      )

      if (existingProfile?.candidateId) {
        return NextResponse.json({
          ok: true,
          mode: 'preview',
          reused: true,
          candidateId: existingProfile.candidateId,
          sourceProfileId: existingProfile.id,
          candidateUrl: `/app/candidate/${existingProfile.candidateId}`,
          identityProposals: { created: [], considered: 0, anchored: 0 },
          note: 'Existing source profile reused. Identity remains pending recruiter review.',
        })
      }

      const candidateId = uid('cand')
      const spId = existingProfile?.id || uid('sp')

      if (existingProfile) {
        existingProfile.candidateId = candidateId
        existingProfile.rawText = JSON.stringify(normalizedResult)
        existingProfile.lastSeenAt = nowIso()
      } else {
        db.sourceProfiles.unshift({
          id: spId,
          source: normalizedResult.source,
          sourceProfileId: normalizedResult.sourceProfileId,
          displayName: normalizedResult.displayName,
          headline: normalizedResult.headline || '',
          location: normalizedResult.location || '',
          organization: normalizedResult.organization || '',
          rawText: JSON.stringify(normalizedResult),
          status: 'pending',
          matchScore: 0,
          matchReasons: [],
          candidateId,
          lastSeenAt: nowIso(),
          createdAt: nowIso(),
        })
      }

      db.candidates.unshift({
        id: candidateId,
        canonicalName: normalizedResult.displayName,
        headline: normalizedResult.headline || '',
        location: normalizedResult.location || '',
        currentCompany: normalizedResult.organization || '',
        skills: normalizedResult.skills || [],
        summary: `Source profile from ${normalizedResult.source}. Pending recruiter review.`,
        mergeStatus: 'pending',
        sourceProfileIds: [spId],
        evidenceItemIds: (normalizedResult.evidence || []).map((item: { id: string }) => item.id),
        contactSignalIds: [],
        openToWorkSignalIds: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })

      return NextResponse.json({
        ok: true,
        mode: 'preview',
        candidateId,
        sourceProfileId: spId,
        candidateUrl: `/app/candidate/${candidateId}`,
        identityProposals: { created: [], considered: 0, anchored: 0 },
        note: 'Preview mode data is in-memory only. Candidate remains pending recruiter review.',
      })
    }

    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    }

    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    const ownerId = session.userId!

    const { data: existingProfile, error: lookupError } = await sb
      .from('source_profiles')
      .select('id,candidate_id')
      .eq('owner_id', ownerId)
      .eq('source', normalizedResult.source)
      .eq('source_profile_id', normalizedResult.sourceProfileId)
      .maybeSingle()

    if (lookupError) return errorResponse('source_profiles lookup', lookupError.message)

    const profilePayload = {
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
    }

    // Upsert closes the race where two first-time saves both pass the lookup.
    // candidate_id is intentionally omitted from profilePayload, so an existing
    // canonical link is preserved rather than overwritten.
    const { data: profileData, error: profileError } = await sb
      .from('source_profiles')
      .upsert(profilePayload, { onConflict: 'owner_id,source,source_profile_id' })
      .select('id,candidate_id')
      .single()

    if (profileError) return errorResponse('source_profiles write', profileError.message)

    const sourceProfileId = profileData.id
    const isNewSourceIdentity = !existingProfile?.candidate_id && !profileData.candidate_id
    let candidateId: string | null = profileData.candidate_id || existingProfile?.candidate_id || null
    let createdCandidateId: string | null = null

    if (!candidateId) {
      const { data: candidateData, error: candidateError } = await sb.from('candidates').insert({
        owner_id: ownerId,
        canonical_name: normalizedResult.displayName,
        headline: normalizedResult.headline || null,
        location: normalizedResult.location || null,
        current_company: normalizedResult.organization || null,
        skills: normalizedResult.skills || [],
        summary: `Source profile from ${normalizedResult.source}. Pending recruiter review. Not verified.`,
        merge_status: 'pending',
      }).select('id').single()

      if (candidateError) return errorResponse('candidates', candidateError.message)
      createdCandidateId = candidateData.id

      const { data: linkedProfile, error: linkError } = await sb
        .from('source_profiles')
        .update({ candidate_id: createdCandidateId })
        .eq('id', sourceProfileId)
        .eq('owner_id', ownerId)
        .is('candidate_id', null)
        .select('candidate_id')
        .maybeSingle()

      if (linkError) return errorResponse('source_profiles link', linkError.message)

      if (linkedProfile?.candidate_id) {
        candidateId = linkedProfile.candidate_id
      } else {
        // A concurrent save may have linked the profile first. Reconcile to the
        // winning candidate and remove the unlinked duplicate candidate.
        const { data: reconciled, error: reconcileError } = await sb
          .from('source_profiles')
          .select('candidate_id')
          .eq('id', sourceProfileId)
          .eq('owner_id', ownerId)
          .single()

        if (reconcileError || !reconciled?.candidate_id) {
          return errorResponse('source_profiles reconcile', reconcileError?.message || 'Candidate link was not established.')
        }
        candidateId = reconciled.candidate_id

        if (candidateId !== createdCandidateId) {
          const { error: cleanupError } = await sb
            .from('candidates')
            .delete()
            .eq('id', createdCandidateId)
            .eq('owner_id', ownerId)
          if (cleanupError) return errorResponse('candidate reconciliation cleanup', cleanupError.message)
        }
      }
    }

    if (!candidateId) return errorResponse('candidate link', 'No canonical candidate was resolved.')

    const { data: existingEvidence, error: evidenceLookupError } = await sb
      .from('evidence_items')
      .select('source,label,detail,url')
      .eq('owner_id', ownerId)
      .eq('source_profile_id', sourceProfileId)

    if (evidenceLookupError) return errorResponse('evidence lookup', evidenceLookupError.message)

    const evidenceKeys = new Set((existingEvidence || []).map(item =>
      [item.source, item.label, item.detail, item.url || ''].join('\u0000')
    ))
    const newEvidence = Array.isArray(normalizedResult.evidence)
      ? normalizedResult.evidence.filter((item: { source?: string; label: string; detail: string; url?: string }) =>
          !evidenceKeys.has([
            item.source || normalizedResult.source,
            item.label,
            item.detail,
            item.url || '',
          ].join('\u0000'))
        )
      : []

    if (newEvidence.length > 0) {
      const { error: evidenceError } = await sb.from('evidence_items').insert(
        newEvidence.map((item: { label: string; detail: string; source?: string; confidence?: string; url?: string }) => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          source: item.source || normalizedResult.source,
          label: item.label,
          detail: item.detail,
          confidence: item.confidence || 'medium',
          url: item.url || null,
        }))
      )
      if (evidenceError) return errorResponse('evidence write', evidenceError.message)
    }

    const { data: existingContacts, error: contactLookupError } = await sb
      .from('candidate_contacts')
      .select('type,value,source')
      .eq('owner_id', ownerId)
      .eq('source_profile_id', sourceProfileId)

    if (contactLookupError) return errorResponse('contact lookup', contactLookupError.message)

    const contactKeys = new Set((existingContacts || []).map(item =>
      [item.type, item.value, item.source].join('\u0000')
    ))
    const newContacts = Array.isArray(normalizedResult.contactSignals)
      ? normalizedResult.contactSignals.filter((item: { type: string; value: string; source?: string }) =>
          !contactKeys.has([item.type, item.value, item.source || normalizedResult.source].join('\u0000'))
        )
      : []

    if (newContacts.length > 0) {
      const { error: contactError } = await sb.from('candidate_contacts').insert(
        newContacts.map((item: { type: string; value: string; source?: string }) => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          type: item.type,
          value: item.value,
          source: item.source || normalizedResult.source,
          confidence: 'medium',
          verified: false,
          permission_status: 'unknown',
        }))
      )
      if (contactError) return errorResponse('contact write', contactError.message)
    }

    const identityProposals = isNewSourceIdentity
      ? await createDeterministicIdentityProposals({
          sb,
          ownerId,
          incomingSourceProfileId: sourceProfileId,
          incomingCandidateId: candidateId,
          incomingResult: normalizedResult,
        })
      : { created: [], considered: 0, anchored: 0 }

    let projectCandidateId: string | null = null
    if (projectId) {
      const { data: projectCandidate, error: projectError } = await sb.from('project_candidates').upsert({
        project_id: projectId,
        candidate_id: candidateId,
        owner_id: ownerId,
        stage: 'sourced',
        fit_score: null,
        fit_evidence: [],
        fit_missing: [],
        fit_confidence: 'low',
      }, { onConflict: 'project_id,candidate_id' }).select('id').single()

      if (projectError) return errorResponse('project candidate write', projectError.message)
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
        ? `Source profile saved. ${identityProposals.created.length} deterministic cross-source identity proposal${identityProposals.created.length === 1 ? '' : 's'} await recruiter review; nothing was merged automatically.`
        : 'Source profile saved. Candidate is pending recruiter identity review.',
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Save failed.' }, { status: 500 })
  }
}
