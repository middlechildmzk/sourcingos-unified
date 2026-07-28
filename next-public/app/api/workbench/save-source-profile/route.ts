import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import type { SourceResult } from '@/lib/source-types'

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function evidenceKey(item: { source?: string; label?: string; detail?: string; url?: string | null }) {
  return [item.source || '', item.label || '', item.detail || '', item.url || ''].join('\u0000')
}

function contactKey(item: { source?: string; type?: string; value?: string }) {
  return [item.source || '', item.type || '', item.value || ''].join('\u0000')
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const session = await getRouteSession()

  try {
    const body = await req.json()
    const sourceResult = body?.sourceResult as SourceResult | undefined
    const projectId = typeof body?.projectId === 'string' && body.projectId ? body.projectId : undefined

    if (!sourceResult?.id || !sourceResult?.displayName || !sourceResult?.source || !sourceResult?.sourceProfileId) {
      return badRequest('sourceResult.id, source, sourceProfileId, and displayName are required.')
    }

    if (sourceResult.entityKind !== 'person') {
      return badRequest(`Only person records can be saved as candidates. Received ${sourceResult.entityKind || 'unknown'}.`, 422)
    }

    if (!isSupabaseConfigured()) {
      const db = getCandidateDb()
      const existingProfile = db.sourceProfiles.find(profile =>
        profile.source === sourceResult.source && profile.sourceProfileId === sourceResult.sourceProfileId,
      )

      if (existingProfile?.candidateId) {
        return NextResponse.json({
          ok: true,
          mode: 'preview',
          candidateId: existingProfile.candidateId,
          sourceProfileId: existingProfile.id,
          candidateUrl: `/app/candidate/${existingProfile.candidateId}`,
          note: 'Already saved. Reusing the existing pending candidate.',
        })
      }

      const candidateId = uid('cand')
      const sourceProfileId = existingProfile?.id || uid('sp')

      if (existingProfile) {
        existingProfile.candidateId = candidateId
        existingProfile.displayName = sourceResult.displayName
        existingProfile.headline = sourceResult.headline || ''
        existingProfile.location = sourceResult.location || ''
        existingProfile.organization = sourceResult.organization || ''
        existingProfile.rawText = JSON.stringify(sourceResult)
        existingProfile.lastSeenAt = nowIso()
      } else {
        db.sourceProfiles.unshift({
          id: sourceProfileId,
          source: sourceResult.source,
          sourceProfileId: sourceResult.sourceProfileId,
          displayName: sourceResult.displayName,
          headline: sourceResult.headline || '',
          location: sourceResult.location || '',
          organization: sourceResult.organization || '',
          rawText: JSON.stringify(sourceResult),
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
        canonicalName: sourceResult.displayName,
        headline: sourceResult.headline || '',
        location: sourceResult.location || '',
        currentCompany: sourceResult.organization || '',
        skills: sourceResult.skills || [],
        summary: `Source profile from ${sourceResult.source}. Pending recruiter review.`,
        mergeStatus: 'pending',
        sourceProfileIds: [sourceProfileId],
        evidenceItemIds: (sourceResult.evidence || []).map(item => item.id),
        contactSignalIds: [],
        openToWorkSignalIds: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })

      return NextResponse.json({
        ok: true,
        mode: 'preview',
        candidateId,
        sourceProfileId,
        candidateUrl: `/app/candidate/${candidateId}`,
        note: 'Preview mode. Data is in-memory only and remains pending recruiter review.',
      })
    }

    if (!session.authenticated) {
      return badRequest('Authentication required.', 401)
    }

    const sb = createServerSupabaseClient()
    if (!sb) return badRequest('Supabase client unavailable.', 500)

    const ownerId = session.userId!
    const profilePayload = {
      owner_id: ownerId,
      source: sourceResult.source,
      source_profile_id: sourceResult.sourceProfileId,
      profile_url: sourceResult.profileUrl || null,
      display_name: sourceResult.displayName,
      headline: sourceResult.headline || null,
      location: sourceResult.location || null,
      organization: sourceResult.organization || null,
      raw: sourceResult,
      status: 'pending',
      match_score: 0,
      match_reasons: [],
      last_seen_at: new Date().toISOString(),
    }

    const { data: profile, error: profileError } = await sb
      .from('source_profiles')
      .upsert(profilePayload, { onConflict: 'owner_id,source,source_profile_id' })
      .select('id,candidate_id')
      .single()

    if (profileError || !profile) {
      return badRequest(`source_profiles: ${profileError?.message || 'No profile returned.'}`, 500)
    }

    const sourceProfileId = profile.id as string
    let candidateId = profile.candidate_id as string | null
    let createdCandidateId: string | null = null

    if (!candidateId) {
      const { data: candidate, error: candidateError } = await sb
        .from('candidates')
        .insert({
          owner_id: ownerId,
          canonical_name: sourceResult.displayName,
          headline: sourceResult.headline || null,
          location: sourceResult.location || null,
          current_company: sourceResult.organization || null,
          skills: sourceResult.skills || [],
          summary: `Source profile from ${sourceResult.source}. Pending recruiter review. Not verified.`,
          merge_status: 'pending',
        })
        .select('id')
        .single()

      if (candidateError || !candidate) {
        return badRequest(`candidates: ${candidateError?.message || 'No candidate returned.'}`, 500)
      }

      createdCandidateId = candidate.id as string

      const { data: linkedProfile, error: linkError } = await sb
        .from('source_profiles')
        .update({ candidate_id: createdCandidateId })
        .eq('id', sourceProfileId)
        .eq('owner_id', ownerId)
        .is('candidate_id', null)
        .select('candidate_id')
        .maybeSingle()

      if (linkError) {
        return badRequest(`source_profiles link: ${linkError.message}`, 500)
      }

      if (linkedProfile?.candidate_id) {
        candidateId = linkedProfile.candidate_id as string
      } else {
        const { data: reconciled, error: reconcileError } = await sb
          .from('source_profiles')
          .select('candidate_id')
          .eq('id', sourceProfileId)
          .eq('owner_id', ownerId)
          .single()

        if (reconcileError || !reconciled?.candidate_id) {
          return badRequest(`source_profiles reconciliation: ${reconcileError?.message || 'Candidate link unavailable.'}`, 409)
        }

        candidateId = reconciled.candidate_id as string

        if (candidateId !== createdCandidateId) {
          const { error: cleanupError } = await sb
            .from('candidates')
            .delete()
            .eq('id', createdCandidateId)
            .eq('owner_id', ownerId)

          if (cleanupError) {
            return badRequest(`candidate race cleanup: ${cleanupError.message}`, 500)
          }
        }
      }
    }

    if (!candidateId) return badRequest('Candidate link unavailable.', 409)

    const incomingEvidence = Array.isArray(sourceResult.evidence) ? sourceResult.evidence : []
    if (incomingEvidence.length > 0) {
      const { data: existingEvidence, error: existingEvidenceError } = await sb
        .from('evidence_items')
        .select('source,label,detail,url')
        .eq('owner_id', ownerId)
        .eq('candidate_id', candidateId)
        .eq('source_profile_id', sourceProfileId)

      if (existingEvidenceError) return badRequest(`evidence_items read: ${existingEvidenceError.message}`, 500)
      const existingKeys = new Set((existingEvidence || []).map(evidenceKey))
      const newEvidence = incomingEvidence
        .map(item => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          source: item.source || sourceResult.source,
          label: item.label,
          detail: item.detail,
          confidence: item.confidence || 'medium',
          url: item.url || null,
        }))
        .filter(item => !existingKeys.has(evidenceKey(item)))

      if (newEvidence.length > 0) {
        const { error: evidenceError } = await sb.from('evidence_items').insert(newEvidence)
        if (evidenceError) return badRequest(`evidence_items: ${evidenceError.message}`, 500)
      }
    }

    const incomingContacts = Array.isArray(sourceResult.contactSignals) ? sourceResult.contactSignals : []
    if (incomingContacts.length > 0) {
      const { data: existingContacts, error: existingContactsError } = await sb
        .from('candidate_contacts')
        .select('source,type,value')
        .eq('owner_id', ownerId)
        .eq('candidate_id', candidateId)
        .eq('source_profile_id', sourceProfileId)

      if (existingContactsError) return badRequest(`candidate_contacts read: ${existingContactsError.message}`, 500)
      const existingKeys = new Set((existingContacts || []).map(contactKey))
      const newContacts = incomingContacts
        .map(item => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          type: item.type,
          value: item.value,
          source: item.source || sourceResult.source,
          confidence: 'medium',
          verified: false,
          permission_status: 'unknown',
        }))
        .filter(item => !existingKeys.has(contactKey(item)))

      if (newContacts.length > 0) {
        const { error: contactsError } = await sb.from('candidate_contacts').insert(newContacts)
        if (contactsError) return badRequest(`candidate_contacts: ${contactsError.message}`, 500)
      }
    }

    let projectCandidateId: string | null = null
    if (projectId) {
      const { data: projectCandidate, error: projectCandidateError } = await sb
        .from('project_candidates')
        .upsert({
          project_id: projectId,
          candidate_id: candidateId,
          owner_id: ownerId,
          stage: 'sourced',
          fit_score: null,
          fit_evidence: [],
          fit_missing: [],
          fit_confidence: 'low',
        }, { onConflict: 'project_id,candidate_id' })
        .select('id')
        .single()

      if (projectCandidateError) return badRequest(`project_candidates: ${projectCandidateError.message}`, 500)
      projectCandidateId = projectCandidate?.id ?? null
    }

    return NextResponse.json({
      ok: true,
      mode: 'supabase',
      candidateId,
      sourceProfileId,
      projectCandidateId,
      candidateUrl: `/app/candidate/${candidateId}`,
      reusedCandidate: createdCandidateId === null || createdCandidateId !== candidateId,
      note: createdCandidateId === null
        ? 'Already saved. Reusing the existing pending candidate.'
        : 'Source profile saved. Candidate remains pending recruiter identity review.',
    })
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Save failed.', 500)
  }
}
