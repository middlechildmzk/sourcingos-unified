import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sourcingOsInngest } from '@/lib/inngest/client'
import {
  createFleetDispatchBatchV40_7b,
  persistFleetWorkItemsV40_7b,
} from '@/lib/fleet/runtime-v40-7b'

export const dynamic = 'force-dynamic'

const OWNER_ID = '__v40_7b_preview_canary__'
const BATCH_ID = 'v40-7b-preview-canary-1'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, error: 'Preview-only canary.' }, { status: 404 })
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'Supabase service persistence unavailable.' }, { status: 503 })
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
    id: `v40-7b-preview-canary:${item.id}`,
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
    dryRun: true,
    itemId: item.id,
    batchId: BATCH_ID,
    eventIds: sent.ids,
    externalProviderCallsAllowed: false,
    resumeSprintQueueAccess: false,
  })
}
