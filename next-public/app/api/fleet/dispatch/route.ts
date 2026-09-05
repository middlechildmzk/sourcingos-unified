import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sourcingOsInngest } from '@/lib/inngest/client'
import {
  createFleetDispatchBatchV40_7b,
  finishFleetWorkItemV40_7b,
  persistFleetWorkItemsV40_7b,
} from '@/lib/fleet/runtime-v40-7b'

export const dynamic = 'force-dynamic'

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : []
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const dryRun = body.dryRun !== false
  const count = Number(body.count || 1)
  const confirmFullFleet = body.confirmFullFleet === true
  const production = process.env.VERCEL_ENV === 'production'

  // Preview bypass is intentionally limited to dry-run execution. A paid AI or
  // provider call requires a real authenticated session.
  if (gate.preview && !dryRun) {
    return NextResponse.json({ ok: false, error: 'Preview bypass may dispatch dry-run fleet work only.' }, { status: 403 })
  }
  if (production && !dryRun && !gate.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Admin access is required for live production fleet work.' }, { status: 403 })
  }
  if (count > 10 && !gate.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Admin access is required for fleet batches above 10 work items.' }, { status: 403 })
  }

  const target = String(body.target || '').trim()
  const batchId = String(body.batchId || '').trim() || `v40-7b-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

  let dispatch
  try {
    dispatch = createFleetDispatchBatchV40_7b({
      batchId,
      target,
      count,
      confirmFullFleet,
      contextRefs: strings(body.contextRefs),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid fleet dispatch request.',
    }, { status: 400 })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Durable fleet persistence is unavailable.' }, { status: 503 })

  try {
    await persistFleetWorkItemsV40_7b({
      sb,
      ownerId: gate.userId,
      batchId,
      items: dispatch.selected,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Could not persist fleet work items.',
    }, { status: 503 })
  }

  try {
    const sent = await sourcingOsInngest.send(dispatch.selected.map(item => ({
      id: `v40-7b:${item.id}`,
      name: 'sourcingos/fleet.v40_7.work.requested',
      data: {
        ownerId: gate.userId,
        item,
        dryRun,
      },
      user: { external_id: gate.userId },
    })))

    return NextResponse.json({
      ok: true,
      batchId,
      count: dispatch.selected.length,
      dryRun,
      eventIds: sent.ids,
      pods: Array.from(new Set(dispatch.selected.map(item => item.pod))),
      trust: {
        resumeSprintQueueAccess: false,
        productionWriteAuthority: false,
        autonomousOutreach: false,
        authenticatedScraping: false,
        paidProviderPurchase: false,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inngest event dispatch failed.'
    await Promise.all(dispatch.selected.map(item => finishFleetWorkItemV40_7b({
      sb,
      itemId: item.id,
      status: 'failed',
      error: `Dispatch failed before execution: ${message}`,
    }).catch(() => undefined)))
    return NextResponse.json({ ok: false, batchId, error: message }, { status: 503 })
  }
}
