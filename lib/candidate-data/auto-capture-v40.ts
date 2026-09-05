import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { captureSourceResultV40 } from './capture-source-result-v40'
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
  identityReviewProposalsCreated?: number
  identityProposalWarnings?: number
  identityResolutionDeferred: true
  contactValuesCaptured: false
  results: AutoCaptureItemV40[]
}

function keyFor(item: CandidateProviderObservationV36_8) {
  return `${item.provider}:${item.providerPersonId}`
}

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
    const captured = await Promise.all(batch.map(async observation => {
      const normalized = providerObservationToSourceResultV36_8(observation)
      const item = await captureSourceResultV40(
        sb,
        ownerId,
        normalized,
        'Automatically captured from an executed SourcingOS people search.',
      )
      return { provider: observation.provider, providerPersonId: observation.providerPersonId, ...item }
    }))
    results.push(...captured)
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
