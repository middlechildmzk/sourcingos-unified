import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { claimDueFleetLanesV40, finishFleetLaneV40 } from '@/lib/fleet/durable-store'
import { runFleetLaneV40, type FleetLaneV40 } from '@/lib/fleet/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req)
  if (auth === 'unavailable') return NextResponse.json({ ok: false, error: 'Cron authentication is unavailable.' }, { status: 503 })
  if (auth !== 'authorized') return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 503 })

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })

  const claimed = await claimDueFleetLanesV40(sb, 4)
  const runs = []

  // Sequential lane execution keeps one 30-minute tick bounded and avoids a
  // quota stampede across unrelated standing searches. Scouts inside a lane
  // still execute concurrently.
  for (const raw of claimed) {
    const lane = raw as FleetLaneV40
    try {
      const result = await runFleetLaneV40({ sb, lane })
      await finishFleetLaneV40({
        sb,
        ownerId: lane.owner_id,
        intentId: lane.id,
        runId: lane.run_id,
        found: result.found,
        errors: result.errors,
        warnings: result.warnings,
      })
      runs.push({ intentId: lane.id, label: lane.label, ok: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fleet lane failed.'
      await finishFleetLaneV40({
        sb,
        ownerId: lane.owner_id,
        intentId: lane.id,
        runId: lane.run_id,
        found: 0,
        errors: 1,
        warnings: [message],
      })
      runs.push({ intentId: lane.id, label: lane.label, ok: false, error: message })
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: claimed.length,
    runs,
    trust: {
      identityMergeAuthorized: false,
      contactValuesCaptured: false,
      recruiterDecisionAutomated: false,
      rawProviderContactValuesPersisted: false,
    },
  })
}
