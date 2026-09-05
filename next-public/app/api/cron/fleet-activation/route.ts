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
  type FleetAgentResultV40_7b,
} from '@/lib/fleet/runtime-v40-7b'
import { experimentalProviderFlagsV40_7 } from '@/lib/fleet/governance-v40-7'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PARALLEL_BATCH = 'v40-7c-parallel-canary-2'
const FIVE_BATCH = 'v40-7d-live-5'
const TEN_BATCH = 'v40-7d-live-10'
const FIFTY_BATCH = 'v40-7d-live-50'
const CONTEXT_REFS = ['#171', '#172'] as const
const LIVE_TARGET = 'Audit current SourcingOS search intelligence, candidate intelligence, recruiter UX, product engineering, and QA readiness. Produce concrete, attributable findings and next actions without production writes.'

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

function parallelProbeItem() {
  const batch = createImprovementFleetBatchV40_7({
    batchId: PARALLEL_BATCH,
    target: 'Validate the explicitly approved Parallel production connection before staged governed-fleet activation.',
    contextRefs: [...CONTEXT_REFS, 'activation-approved:parallel'],
  })
  const item = batch.items.find(candidate => candidate.pod === 'search_intelligence' && candidate.seat === 1)
  if (!item) throw new Error('Could not select Search Intelligence seat 1 for Parallel connectivity canary.')
  return item
}

async function runParallelConnectivityProbe(key: string): Promise<FleetAgentResultV40_7b> {
  const response = await fetch('https://api.parallel.ai/v1/search', {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      objective: 'Find current primary-source information relevant to evaluating AI-native recruiter sourcing workbenches, evidence-first candidate review, and public-web talent discovery.',
      search_queries: [
        'AI recruiter sourcing workbench',
        'evidence candidate review',
      ],
      max_chars_total: 6000,
      mode: 'basic',
      advanced_settings: {
        max_results: 4,
        excerpt_settings: { max_chars_per_result: 1500 },
      },
    }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Parallel connectivity canary returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 500)}` : '.'}`)
  }
  const payload = await response.json() as Record<string, unknown>
  const results = Array.isArray(payload.results) ? payload.results : []
  const sources = results.slice(0, 4).map(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const excerpts = Array.isArray(row.excerpts)
      ? row.excerpts.map(value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 600)).filter(Boolean).join(' ')
      : ''
    return {
      provider: 'parallel' as const,
      title: String(row.title || 'Parallel result').slice(0, 300),
      url: typeof row.url === 'string' && /^https?:\/\//.test(row.url) ? row.url : undefined,
      excerpt: excerpts.slice(0, 1500),
    }
  })
  return {
    summary: `Explicit Parallel production connectivity canary completed with ${sources.length} attributable result(s). This probe validates the configured provider connection; staged Inngest fleet workers are validated in the following 5 -> 10 -> 50 stages.`,
    findings: [
      'Parallel production API authentication succeeded.',
      `Parallel returned ${sources.length} attributable result(s).`,
      'No Resume/CV queue authority was granted or exercised.',
    ],
    recommendedNextActions: ['Proceed to the five-worker live Inngest stage.'],
    sources,
    model: null,
    providerUsed: 'parallel',
    dryRun: false,
  }
}

async function executeParallelProbe(input: {
  sb: NonNullable<ReturnType<typeof createServerSupabaseClient>>
  ownerId: string
  key: string
}) {
  const item = parallelProbeItem()
  await persistFleetWorkItemsV40_7b({
    sb: input.sb,
    ownerId: input.ownerId,
    batchId: PARALLEL_BATCH,
    items: [item],
  })
  await input.sb.from('fleet_improvement_work_items').update({
    status: 'running',
    attempt_count: 1,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', item.id)

  try {
    const result = await runParallelConnectivityProbe(input.key)
    await finishFleetWorkItemV40_7b({ sb: input.sb, itemId: item.id, status: 'completed', result })
    return result
  } catch (error) {
    await finishFleetWorkItemV40_7b({
      sb: input.sb,
      itemId: item.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Parallel connectivity canary failed.',
    })
    throw error
  }
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

    const readiness = fleetProviderReadinessV40_7b()
    const flags = experimentalProviderFlagsV40_7()
    if (!readiness.parallel || !process.env.PARALLEL_API_KEY) {
      return NextResponse.json({ ok: false, stage: 'parallel_canary', hold: true, reason: 'PARALLEL_API_KEY is not available in production.', readiness, experimentalProviderFlags: flags }, { status: 409 })
    }

    const parallelRows = await batchRows(sb, PARALLEL_BATCH)
    const parallelState = batchState(parallelRows as Array<Record<string, unknown>>, 1)
    if (parallelState.state === 'absent') {
      const result = await executeParallelProbe({ sb, ownerId, key: process.env.PARALLEL_API_KEY })
      return NextResponse.json({ ok: true, stage: 'parallel_canary', action: 'completed', providerUsed: result.providerUsed, sources: result.sources.length, generalFleetParallelFlag: flags.parallel })
    }
    if (parallelState.state === 'running') return NextResponse.json({ ok: true, stage: 'parallel_canary', action: 'waiting', rows: parallelRows })
    if (parallelState.state === 'failed' || !parallelSucceeded(parallelRows as Array<Record<string, unknown>>)) {
      return NextResponse.json({ ok: false, stage: 'parallel_canary', hold: true, reason: 'Parallel production connectivity canary did not complete successfully.', rows: parallelRows }, { status: 409 })
    }

    if (!readiness.synthesisGateway && !readiness.anthropic) {
      return NextResponse.json({ ok: false, stage: 'live_fleet', hold: true, reason: 'No live fleet synthesis provider is configured. Vercel AI Gateway OIDC/API-key auth or Anthropic is required.', readiness }, { status: 409 })
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

    return NextResponse.json({ ok: true, stage: 'complete', action: 'done', rollout: 'Parallel connectivity -> 5 -> 10 -> 50 live Inngest work items', executionConcurrency: 4 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fleet activation cron failed.' }, { status: 500 })
  }
}
