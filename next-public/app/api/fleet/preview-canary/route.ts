import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sourcingOsInngest } from '@/lib/inngest/client'
import {
  createFleetDispatchBatchV40_7b,
  persistFleetWorkItemsV40_7b,
} from '@/lib/fleet/runtime-v40-7b'

export const dynamic = 'force-dynamic'

// Temporary fixed-ID canary. It is safe to expose briefly in production because
// every invocation targets the same idempotent row and dryRun=true prevents
// provider/AI spend. This route is removed immediately after verification.
const OWNER_ID = '__v40_7b_runtime_canary__'
const BATCH_ID = 'v40-7b-runtime-canary-1'
const PUBLIC_INNGEST_URL = 'https://www.getsourcingos.com/api/inngest'

export async function GET() {
  if (!['preview', 'production'].includes(String(process.env.VERCEL_ENV || ''))) {
    return NextResponse.json({ ok: false, error: 'Vercel canary only.' }, { status: 404 })
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'Supabase service persistence unavailable.' }, { status: 503 })
  }

  // Vercel Deployment Protection blocks Inngest's immutable deployment URL.
  // Trigger one registration through the public canonical production origin so
  // Inngest Cloud learns the function endpoint before this second dry-run event.
  const syncResponse = await fetch(PUBLIC_INNGEST_URL, {
    method: 'PUT',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  const syncText = await syncResponse.text().catch(() => '')
  if (!syncResponse.ok) {
    return NextResponse.json({
      ok: false,
      error: 'Inngest app sync failed.',
      syncStatus: syncResponse.status,
      syncResponse: syncText.slice(0, 500),
    }, { status: 502 })
  }

  const dispatch = createFleetDispatchBatchV40_7b({
    batchId: BATCH_ID,
    target: 'Validate V40.7b durable orchestration only. Do not call external providers or AI.',
    count: 1,
    contextRefs: ['#176', '#177'],
  })
  const item = dispatch.selected[0]
  if (!item) return NextResponse.json({ ok: false, error: 'No canary item generated.' }, { status: 500 })

  await persistFleetWorkItemsV40_7b({
    sb,
    ownerId: OWNER_ID,
    batchId: BATCH_ID,
    items: [item],
  })

  const sent = await sourcingOsInngest.send({
    id: `v40-7b-runtime-canary-sync2:${item.id}`,
    name: 'sourcingos/fleet.v40_7.work.requested',
    data: {
      ownerId: OWNER_ID,
      item,
      dryRun: true,
    },
    user: { external_id: OWNER_ID },
  })

  return NextResponse.json({
    ok: true,
    environment: process.env.VERCEL_ENV,
    dryRun: true,
    itemId: item.id,
    batchId: BATCH_ID,
    eventIds: sent.ids,
    syncStatus: syncResponse.status,
    externalProviderCallsAllowed: false,
    resumeSprintQueueAccess: false,
  })
}
