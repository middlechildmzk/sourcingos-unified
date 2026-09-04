import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createDeterministicIdentityProposals } from '@/lib/identity-proposal-service-v33-2'
import { providerObservationToSourceResultV36_8 } from './provider-observation-bridge-v36-8'
import type { CandidateProviderObservationV36_8 } from './types-v36-8'

export type AutoCaptureItemV40 = {
  provider: string
  providerPersonId: string
  ok: boolean
  reused: boolean
  candidateId?: string
  sourceProfileId?: string
  identityReviewProposalsCreated?: number
  identityProposalWarning?: string
  errorCode?: string
}

export type AutoCaptureSummaryV40 = {
  enabled: boolean
  attempted: number
  persisted: number
  created: number
  reused: number
  failed: number
  identityReviewProposalsCreated: number
  identityProposalWarnings: number
  identityResolutionDeferred: true
  contactValuesCaptured: false
  results: AutoCaptureItemV40[]
}

function keyFor(item: CandidateProviderObservationV36_8) {
  return `${item.provider}:${item.providerPersonId}`
}

async function captureOne(
  sb: SupabaseClient,
  ownerId: string,
  observation: CandidateProviderObservationV36_8,
): Promise<AutoCaptureItemV40> {
  const normalized = providerObservationToSourceResultV36_8(observation)
  const base = {
    provider: observation.provider,
    providerPersonId: observation.providerPersonId,
  }

  try {
    const { data: existing, error: lookupError } = await sb
      .from('source_profiles')
      .select('id,candidate_id')
      .eq('owner_id', ownerId)
      .eq('source', normalized.source)
      .eq('source_profile_id', normalized.sourceProfileId)
      .maybeSingle()

    if (lookupError) return { ...base, ok: false, reused: false, errorCode: 'source_profile_lookup_failed' }

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
      match_reasons: ['Automatically captured from an executed SourcingOS people search.'],
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,source,source_profile_id' }).select('id,candidate_id').single()

    if (profileError || !profile) return { ...base, ok: false, reused: false, errorCode: 'source_profile_write_failed' }

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
        summary: `Automatically captured provider observation from ${normalized.source}. Pending recruiter review. Not verified.`,
        merge_status: 'pending',
      }).select('id').single()

      if (candidateError || !candidate?.id) return { ...base, ok: false, reused: false, sourceProfileId, errorCode: 'candidate_write_failed' }
      const createdCandidateId = String(candidate.id)

      const { data: linked, error: linkError } = await sb
        .from('source_profiles')
        .update({ candidate_id: createdCandidateId })
        .eq('id', sourceProfileId)
        .eq('owner_id', ownerId)
        .is('candidate_id', null)
        .select('candidate_id')
        .maybeSingle()

      if (linkError) return { ...base, ok: false, reused: false, sourceProfileId, errorCode: 'source_profile_link_failed' }

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
          return { ...base, ok: false, reused: false, sourceProfileId, errorCode: 'source_profile_reconcile_failed' }
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

    // Persisting the observation is not permission to fuse it with another
    // human. After the source identity has its own durable candidate record,
    // the existing proposal-only resolver may compare it with other owned
    // source profiles. It creates a recruiter-review row only when independently
    // observed deterministic anchors exist; it never changes candidate IDs.
    // Names, companies, locations, skills, and LinkedIn overlap cannot satisfy
    // that proposal gate on their own.
    const proposal = await createDeterministicIdentityProposals({
      sb,
      ownerId,
      incomingSourceProfileId: sourceProfileId,
      incomingCandidateId: candidateId,
      incomingResult: normalized,
      maxProposals: 3,
    })

    // Search execution intentionally runs with revealContact=false. Automatic
    // capture persists professional evidence and identity observations only;
    // contact values remain behind the explicit recruiter-approved waterfall.
    return {
      ...base,
      ok: true,
      reused,
      candidateId,
      sourceProfileId,
      identityReviewProposalsCreated: proposal.created.length,
      identityProposalWarning: proposal.warning,
    }
  } catch {
    return { ...base, ok: false, reused: false, errorCode: 'capture_failed' }
  }
}

/**
 * Persist every retained source-native observation from an executed search.
 * This is system memory, not a recruiter disposition: candidates remain pending,
 * deterministic cross-source anchors may create inert recruiter-review proposals,
 * persistent identity fusion remains deferred to explicit recruiter confirmation,
 * and contact values are excluded.
 */
export async function autoCaptureSearchObservationsV40(
  sb: SupabaseClient,
  ownerId: string,
  observations: CandidateProviderObservationV36_8[],
): Promise<AutoCaptureSummaryV40> {
  const unique = Array.from(new Map(observations.map(item => [keyFor(item), item])).values())
  const results: AutoCaptureItemV40[] = []
  const concurrency = 6

  for (let index = 0; index < unique.length; index += concurrency) {
    const batch = unique.slice(index, index + concurrency)
    results.push(...await Promise.all(batch.map(item => captureOne(sb, ownerId, item))))
  }

  const persisted = results.filter(item => item.ok).length
  const reused = results.filter(item => item.ok && item.reused).length
  return {
    enabled: true,
    attempted: results.length,
    persisted,
    created: persisted - reused,
    reused,
    failed: results.length - persisted,
    identityReviewProposalsCreated: results.reduce((sum, item) => sum + Number(item.identityReviewProposalsCreated || 0), 0),
    identityProposalWarnings: results.filter(item => Boolean(item.identityProposalWarning)).length,
    identityResolutionDeferred: true,
    contactValuesCaptured: false,
    results,
  }
}
