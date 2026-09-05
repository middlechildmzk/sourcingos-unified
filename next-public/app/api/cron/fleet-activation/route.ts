import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sourcingOsInngest } from '@/lib/inngest/client'
import { createImprovementFleetBatchV40_7, type FleetWorkItemV40_7 } from '@/lib/fleet/improvement-workflow-v40-7'
import {
  createFleetDispatchBatchV40_7b,
  fleetProviderReadinessV40_7b,
  finishFleetWorkItemV40_7b,
  persistFleetWorkItemsV40_7b,
} from '@/lib/fleet/runtime-v40-7b'
import { experimentalProviderFlagsV40_7 } from '@/lib/fleet/governance-v40-7'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PARALLEL_BATCH = 'v40-7c-parallel-canary-1'
const FIVE_BATCH = 'v40-7c-live-5'
const TEN_BATCH = 'v40-7c-live-10'
const FIFTY_BATCH = 'v40-7c-live-50'
const CONTEXT_REFS = ['#171', '#172'] as const
const LIVE_TARGET = 'Audit current SourcingOS search intelligence, candidate intelligence, recruiter UX, product engineering, and QA readiness. Produce concrete, attributable findings and next actions without production writes.'

function enabled(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true'
}

async function latestOwnerId(sb: ReturnType<typeof createServerSupabaseClient>) {
  if (!sb) return null
  const { data, error } = await sb
    .from('fleet_improvement_work_items')
    .select('owner_id')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Could not resolve fleet owner: ${error.message}`)
  return typeof data?.owner_id === 'string' && data.owner_id ? data.owner_id : null
}

async function batchRows(sb: NonNullable<ReturnType<typeof createServerSupabaseClient>>, batchId: string) {
  const { data, error } = await sb
    .from('fleet_improvement_work_items')
    .select('id,status,result,error,attempt_count')
    .eq('batch_id', batchId)
    .order('seat', { ascending: true })
  if (error) throw new Error(`Could not read fleet batch ${batchId}: ${error.message}`)
  return Array.isArray(data) ? data : []
}

function batchState(rows: Array<Record<string, unknown>>, expected: number) {
  if (!rows.length) return { state: 'absent' as const }
  if (rows.length !== expected) return { state: 'running' as const, rows }
  const statuses = rows.map(row => String(row.status || 'unknown'))
  const terminal = statuses.every(status => ['completed', 'blocked', 'failed'].includes(status))
  if (!terminal) return { state: 'running' as const, rows }
  const failures = rows.filter(row => String(row.status) !== 'completed')
  return failures.length
    ? { state: 'failed' as const, rows, failures }
    : { state: 'completed' as const, rows }
}

async function dispatchItems(input: {
  sb: NonNullable<ReturnType<typeof createServerSupabaseClient>>
  ownerId: string
  batchId: string
  items: readonly FleetWorkItemV40_7[]
}) {
  await persistFleetWorkItemsV40_7b({
    sb: input.sb,
    ownerId: input.ownerId,
    batchId: input.batchId,
    items: input.items,
  })

  try {
    const sent = await sourcingOsInngest.send(input.items.map(item => ({
      id: `v40-7c:${item.id}`,
      name: 'sourcingos/fleet.v40_7.work.requested',
      data: { ownerId: input.ownerId, item, dryRun: false },
      user: { external_id: input.ownerId },
    })))
    return sent.ids
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inngest event dispatch failed.'
    await Promise.all(input.items.map(item => finishFleetWorkItemV40_7b({
      sb: input.sb,
      itemId: item.id,
      status: 'failed',
      error: `Activation dispatch failed before execution: ${message}`,
    }).catch(() => undefined)))
    throw error
  }
}

function parallelCanaryItem() {
  const readiness = fleetProviderReadinessV40_7b()
  const flags = experimentalProviderFlagsV40_7()
  const globalExperimental = enabled(process.env.AGENT_FLEET_EXPERIMENTAL_PROVIDERS)
  const providerOrder: string[] = []

  if (readiness.exa) providerOrder.push('exa')
  if (globalExperimental && enabled(process.env.AGENT_FLEET_PROVIDER_VERCEL_EXA) && readiness.vercelExa) providerOrder.push('vercel_exa')
  if (flags.firecrawl && readiness.firecrawl) providerOrder.push('firecrawl')
  if (flags.parallel && readiness.parallel) providerOrder.push('parallel')

  const parallelIndex = providerOrder.indexOf('parallel')
  if (!readiness.anthropic) {
    return { ok: false as const, reason: 'Anthropic is not configured for live fleet synthesis.', readiness, flags, providerOrder }
  }
  if (parallelIndex < 0) {
    return { ok: false as const, reason: 'Parallel is not both configured and enabled by the governed experimental-provider flags.', readiness, flags, providerOrder }
  }

  const batch = createImprovementFleetBatchV40_7({
    batchId: PARALLEL_BATCH,
    target: 'Validate one live Parallel-backed Search Intelligence fleet worker against current SourcingOS provider benchmarking and recruiter-workbench priorities.',
    contextRefs: CONTEXT_REFS,
  })
  const seat = parallelIndex + 1
  const item = batch.items.find(candidate => candidate.pod === 'search_intelligence' && candidate.seat === seat)
  if (!item) throw new Error(`Could not select Search Intelligence seat ${seat} for Parallel canary.`)
  return { ok: true as const, item, readiness, flags, providerOrder }
}

function parallelSucceeded(rows: Array<Record<string, unknown>>) {
  if (rows.length !== 1 || String(rows[0]?.status) !== 'completed') return false
  const result = rows[0]?.result && typeof rows[0].result === 'object'
    ? rows[0].result as Record<string, unknown>
    : {}
  return result.providerUsed === 'parallel' && result.dryRun === false
}

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req)
  if (auth === 'unavailable') return NextResponse.json({ ok: false, error: 'Cron authentication is unavailable.' }, { status: 503 })
  if (auth !== 'authorized') return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase service-role persistence is unavailable.' }, { status: 503 })

  try {
    const ownerId = await latestOwnerId(sb)
    if (!ownerId) return NextResponse.json({ ok: false, error: 'No existing governed-fleet owner could be resolved.' }, { status: 409 })

    const canary = parallelCanaryItem()
    if (!canary.ok) {
      return NextResponse.json({ ok: false, stage: 'parallel_canary', hold: true, reason: canary.reason, readiness: canary.readiness, experimentalProviderFlags: canary.flags, providerOrder: canary.providerOrder }, { status: 409 })
    }

    const parallelRows = await batchRows(sb, PARALLEL_BATCH)
    const parallelState = batchState(parallelRows as Array<Record<string, unknown>>, 1)
    if (parallelState.state === 'absent') {
      const eventIds = await dispatchItems({ sb, ownerId, batchId: PARALLEL_BATCH, items: [canary.item] })
      return NextResponse.json({ ok: true, stage: 'parallel_canary', action: 'dispatched', count: 1, eventIds, providerOrder: canary.providerOrder })
    }
    if (parallelState.state === 'running') return NextResponse.json({ ok: true, stage: 'parallel_canary', action: 'waiting', rows: parallelRows })
    if (parallelState.state === 'failed' || !parallelSucceeded(parallelRows as Array<Record<string, unknown>>)) {
      return NextResponse.json({ ok: false, stage: 'parallel_canary', hold: true, reason: 'Parallel live canary did not complete successfully with providerUsed=parallel.', rows: parallelRows }, { status: 409 })
    }

    const stages = [
      { batchId: FIVE_BATCH, count: 5, confirmFullFleet: false },
      { batchId: TEN_BATCH, count: 10, confirmFullFleet: false },
      { batchId: FIFTY_BATCH, count: 50, confirmFullFleet: true },
    ] as const

    for (const stage of stages) {
      const rows = await batchRows(sb, stage.batchId)
      const state = batchState(rows as Array<Record<string, unknown>>, stage.count)
      if (state.state === 'absent') {
        const dispatch = createFleetDispatchBatchV40_7b({
          batchId: stage.batchId,
          target: LIVE_TARGET,
          count: stage.count,
          confirmFullFleet: stage.confirmFullFleet,
          contextRefs: CONTEXT_REFS,
        })
        const eventIds = await dispatchItems({ sb, ownerId, batchId: stage.batchId, items: dispatch.selected })
        return NextResponse.json({ ok: true, stage: stage.batchId, action: 'dispatched', count: dispatch.selected.length, eventIds, pods: Array.from(new Set(dispatch.selected.map(item => item.pod))) })
      }
      if (state.state === 'running') return NextResponse.json({ ok: true, stage: stage.batchId, action: 'waiting', completed: rows.filter(row => row.status === 'completed').length, total: stage.count })
      if (state.state === 'failed') return NextResponse.json({ ok: false, stage: stage.batchId, hold: true, reason: 'One or more fleet items failed or were blocked; later stages were not dispatched.', rows }, { status: 409 })
    }

    return NextResponse.json({ ok: true, stage: 'complete', action: 'done', rollout: '1 Parallel -> 5 -> 10 -> 50', executionConcurrency: 4 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fleet activation cron failed.' }, { status: 500 })
  }
}
