import 'server-only'

import { sourcingOsInngest } from '../client'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  claimFleetWorkItemV40_7b,
  executeFleetWorkItemV40_7b,
  finishFleetWorkItemV40_7b,
  type FleetRuntimeEventDataV40_7b,
} from '@/lib/fleet/runtime-v40-7b'

function originalFailureData(event: unknown): FleetRuntimeEventDataV40_7b | null {
  if (!event || typeof event !== 'object') return null
  const eventRecord = event as Record<string, unknown>
  const data = eventRecord.data && typeof eventRecord.data === 'object'
    ? eventRecord.data as Record<string, unknown>
    : {}
  const originalEvent = data.event && typeof data.event === 'object'
    ? data.event as Record<string, unknown>
    : {}
  const originalData = originalEvent.data
  if (!originalData || typeof originalData !== 'object') return null
  return originalData as FleetRuntimeEventDataV40_7b
}

export const runFleetImprovementWorkV40_7b = sourcingOsInngest.createFunction(
  {
    id: 'v40-7b-governed-fleet-work-item',
    name: 'V40.7b governed fleet work item',
    concurrency: { limit: 4 },
    retries: 2,
    timeouts: { finish: '12m' },
    onFailure: async ({ event, error }) => {
      const original = originalFailureData(event)
      const itemId = original?.item?.id
      if (!itemId) return
      const sb = createServerSupabaseClient()
      if (!sb) return
      await finishFleetWorkItemV40_7b({
        sb,
        itemId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Inngest fleet work item exhausted retries.',
      })
    },
  },
  { event: 'sourcingos/fleet.v40_7.work.requested' },
  async ({ event, step, runId }) => {
    const data = event.data as FleetRuntimeEventDataV40_7b
    const item = data?.item
    const ownerId = String(data?.ownerId || '').trim()
    if (!item?.id || !ownerId) throw new Error('V40.7b work event is missing ownerId or item.')

    const claim = await step.run('claim-work-item', async () => {
      const sb = createServerSupabaseClient()
      if (!sb) throw new Error('Supabase service-role persistence is unavailable.')
      return claimFleetWorkItemV40_7b({
        sb,
        itemId: item.id,
        eventId: String(event.id || runId || ''),
      })
    })

    if (!claim.claimed) {
      return {
        ok: true,
        skipped: true,
        itemId: item.id,
        reason: claim.status,
        attempts: claim.attempts,
      }
    }

    const result = await step.run('execute-bounded-work', async () => {
      return executeFleetWorkItemV40_7b({ item, dryRun: Boolean(data.dryRun) })
    })

    await step.run('persist-completion', async () => {
      const sb = createServerSupabaseClient()
      if (!sb) throw new Error('Supabase service-role persistence is unavailable.')
      await finishFleetWorkItemV40_7b({
        sb,
        itemId: item.id,
        status: 'completed',
        result,
      })
      return { saved: true }
    })

    await step.sendEvent('emit-work-completed', {
      id: `completed:${item.id}`,
      name: 'sourcingos/fleet.v40_7.work.completed',
      data: {
        itemId: item.id,
        ownerId,
        batchId: item.id.split(':')[0],
        agentId: item.agentId,
        pod: item.pod,
        status: 'completed',
        summary: result.summary,
        findings: result.findings,
        recommendedNextActions: result.recommendedNextActions,
        providerUsed: result.providerUsed,
        dryRun: result.dryRun,
      },
    })

    return {
      ok: true,
      itemId: item.id,
      attempts: claim.attempts,
      providerUsed: result.providerUsed,
      dryRun: result.dryRun,
    }
  },
)
