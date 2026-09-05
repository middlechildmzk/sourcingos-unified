import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDeterministicIdentityProposals } from '@/lib/identity-proposal-service-v33-2'
import type { SourceResult } from '@/lib/source-types'

export type CaptureSourceResultV40 = {
  ok: boolean
  reused: boolean
  candidateId?: string
  sourceProfileId?: string
  identityReviewProposalsCreated?: number
  identityProposalWarning?: string
  errorCode?: string
}

/**
 * Canonical persistence boundary for automatically observed public/provider
 * person records. It persists source-native evidence, never contact values,
 * and hands deterministic identity anchors to the existing recruiter-review
 * proposal service. It never changes another source profile's candidate id.
 */
export async function captureSourceResultV40(
  sb: SupabaseClient,
  ownerId: string,
  result: SourceResult,
  reason = 'Automatically captured from an executed SourcingOS sourcing lane.',
): Promise<CaptureSourceResultV40> {
  if (result.entityKind !== 'person' || !result.sourceProfileId || !result.displayName) {
    return { ok: false, reused: false, errorCode: 'non_person_or_incomplete' }
  }

  const normalized: SourceResult = { ...result, contactSignals: [] }

  try {
    const { data: existing, error: lookupError } = await sb
      .from('source_profiles')
      .select('id,candidate_id')
      .eq('owner_id', ownerId)
      .eq('source', normalized.source)
      .eq('source_profile_id', normalized.sourceProfileId)
      .maybeSingle()

    if (lookupError) return { ok: false, reused: false, errorCode: 'source_profile_lookup_failed' }

    const { data: profile, error: profileError } = await sb.from('source_profiles').upsert({
      owner_id: ownerId,
      source: normalized.source,
      source_profile_id: normalized.sourceProfileId,
      profile_url: normalized.profileUrl || null,
      display_name: normalized.displayName,
      headline: normalized.headline || null,
      location: normalized.location || null,
      organization: normalized.organization || null,
      raw: normalized,
      status: 'pending',
      match_score: 0,
      match_reasons: [reason],
      last_seen_at: normalized.refreshedAt || new Date().toISOString(),
    }, { onConflict: 'owner_id,source,source_profile_id' }).select('id,candidate_id').single()

    if (profileError || !profile) return { ok: false, reused: false, errorCode: 'source_profile_write_failed' }

    const sourceProfileId = String(profile.id)
    let candidateId = profile.candidate_id ? String(profile.candidate_id) : existing?.candidate_id ? String(existing.candidate_id) : ''
    const reused = Boolean(candidateId)

    if (!candidateId) {
      const { data: candidate, error: candidateError } = await sb.from('candidates').insert({
        owner_id: ownerId,
        canonical_name: normalized.displayName,
        headline: normalized.headline || null,
        location: normalized.location || null,
        current_company: normalized.organization || null,
        skills: normalized.skills,
        summary: `Automatically captured ${normalized.source} observation. Pending recruiter review. Not verified.`,
        merge_status: 'pending',
      }).select('id').single()

      if (candidateError || !candidate?.id) return { ok: false, reused: false, sourceProfileId, errorCode: 'candidate_write_failed' }
      const createdCandidateId = String(candidate.id)

      const { data: linked, error: linkError } = await sb
        .from('source_profiles')
        .update({ candidate_id: createdCandidateId })
        .eq('id', sourceProfileId)
        .eq('owner_id', ownerId)
        .is('candidate_id', null)
        .select('candidate_id')
        .maybeSingle()

      if (linkError) return { ok: false, reused: false, sourceProfileId, errorCode: 'source_profile_link_failed' }

      if (linked?.candidate_id) {
        candidateId = String(linked.candidate_id)
      } else {
        const { data: reconciled, error: reconcileError } = await sb
          .from('source_profiles')
          .select('candidate_id')
          .eq('id', sourceProfileId)
          .eq('owner_id', ownerId)
          .single()

        if (reconcileError || !reconciled?.candidate_id) {
          return { ok: false, reused: false, sourceProfileId, errorCode: 'source_profile_reconcile_failed' }
        }
        candidateId = String(reconciled.candidate_id)
        if (candidateId !== createdCandidateId) {
          await sb.from('candidates').delete().eq('id', createdCandidateId).eq('owner_id', ownerId)
        }
      }
    }

    const { data: existingEvidence, error: evidenceLookupError } = await sb
      .from('evidence_items')
      .select('source,label,detail,url')
      .eq('owner_id', ownerId)
      .eq('source_profile_id', sourceProfileId)

    if (!evidenceLookupError) {
      const keys = new Set((existingEvidence || []).map(item => [item.source, item.label, item.detail, item.url || ''].join('\u0000')))
      const newEvidence = normalized.evidence.filter(item => !keys.has([item.source, item.label, item.detail, item.url || ''].join('\u0000')))
      if (newEvidence.length) {
        await sb.from('evidence_items').insert(newEvidence.map(item => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          source: item.source,
          label: item.label,
          detail: item.detail,
          confidence: item.confidence,
          url: item.url || null,
        })))
      }
    }

    const proposal = await createDeterministicIdentityProposals({
      sb,
      ownerId,
      incomingSourceProfileId: sourceProfileId,
      incomingCandidateId: candidateId,
      incomingResult: normalized,
      maxProposals: 3,
    })

    return {
      ok: true,
      reused,
      candidateId,
      sourceProfileId,
      identityReviewProposalsCreated: proposal.created.length,
      identityProposalWarning: proposal.warning,
    }
  } catch {
    return { ok: false, reused: false, errorCode: 'capture_failed' }
  }
}
