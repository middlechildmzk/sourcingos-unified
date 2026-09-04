import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CountResult = { count: number | null; error: { message: string } | null }

async function exactCount(query: PromiseLike<CountResult>): Promise<number> {
  const result = await query
  if (result.error) throw new Error(result.error.message)
  return Number(result.count || 0)
}

function nextDueAt(lastRunAt: string | null | undefined, cadenceMinutes: number): string {
  if (!lastRunAt) return new Date().toISOString()
  return new Date(new Date(lastRunAt).getTime() + cadenceMinutes * 60_000).toISOString()
}

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      preview: true,
      scheduler: { state: 'preview', cadenceMinutes: 30, activeLanes: 0, pausedLanes: 0, lastRunAt: null, nextDueAt: null },
      graph: { candidates: 0, sourceProfiles: 0, evidenceItems: 0, candidates24h: 0, sourceProfiles24h: 0, evidence24h: 0 },
      fleet: { rawDiscoveries24h: 0, persisted24h: 0, proposals24h: 0, errors24h: 0, credits24h: 0, pendingIdentityReviews: 0 },
      lanes: [],
      sources: [],
    })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })

  const now = Date.now()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const [
      lanesResult,
      telemetryResult,
      candidates,
      sourceProfiles,
      evidenceItems,
      candidates24h,
      sourceProfiles24h,
      evidence24h,
      rawDiscoveries24h,
      pendingIdentityReviews,
    ] = await Promise.all([
      sb.from('fleet_standing_intents')
        .select('id,label,sources,cadence_minutes,people_limit,credits_per_run,enabled,last_run_at,last_run_id,paused_reason,consecutive_empty_runs,consecutive_error_runs,last_result_summary,created_at')
        .eq('owner_id', gate.userId)
        .order('created_at', { ascending: true }),
      sb.from('fleet_run_telemetry')
        .select('run_id,source,started_at,count_found,count_persisted,count_awaiting_review,credits_spent,api_errors,warnings')
        .eq('owner_id', gate.userId)
        .gte('started_at', since7d)
        .order('started_at', { ascending: false })
        .limit(1000),
      exactCount(sb.from('candidates').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId)),
      exactCount(sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId)),
      exactCount(sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId)),
      exactCount(sb.from('candidates').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId).gte('created_at', since24h)),
      exactCount(sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId).gte('created_at', since24h)),
      exactCount(sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId).gte('created_at', since24h)),
      exactCount(sb.from('fleet_raw_discoveries').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId).gte('created_at', since24h)),
      exactCount(sb.from('identity_match_reviews').select('id', { count: 'exact', head: true }).eq('owner_id', gate.userId).is('decision', null)),
    ])

    if (lanesResult.error) throw new Error(lanesResult.error.message)
    if (telemetryResult.error) throw new Error(telemetryResult.error.message)

    const lanes = (lanesResult.data || []).map(lane => ({
      ...lane,
      next_due_at: lane.enabled && !lane.paused_reason
        ? nextDueAt(lane.last_run_at, Number(lane.cadence_minutes || 30))
        : null,
    }))
    const telemetry = telemetryResult.data || []
    const dayRows = telemetry.filter(row => new Date(row.started_at).getTime() >= now - 24 * 60 * 60 * 1000)

    const sourceMap = new Map<string, { source: string; found: number; persisted: number; proposals: number; errors: number; credits: number; lastRunAt: string | null }>()
    for (const row of telemetry) {
      const current = sourceMap.get(row.source) || { source: row.source, found: 0, persisted: 0, proposals: 0, errors: 0, credits: 0, lastRunAt: null }
      current.found += Number(row.count_found || 0)
      current.persisted += Number(row.count_persisted || 0)
      current.proposals += Number(row.count_awaiting_review || 0)
      current.errors += Number(row.api_errors || 0)
      current.credits += Number(row.credits_spent || 0)
      if (!current.lastRunAt || new Date(row.started_at).getTime() > new Date(current.lastRunAt).getTime()) current.lastRunAt = row.started_at
      sourceMap.set(row.source, current)
    }

    const enabledLanes = lanes.filter(lane => lane.enabled)
    const runnableLanes = enabledLanes.filter(lane => !lane.paused_reason)
    const lastRunAt = runnableLanes.map(lane => lane.last_run_at).filter((value): value is string => Boolean(value)).sort().at(-1) || null
    const nextTimes = runnableLanes.map(lane => lane.next_due_at).filter((value): value is string => Boolean(value)).map(value => new Date(value).getTime())

    return NextResponse.json({
      ok: true,
      scheduler: {
        state: runnableLanes.length ? (lastRunAt ? 'active' : 'armed') : 'idle',
        cadenceMinutes: 30,
        activeLanes: runnableLanes.length,
        pausedLanes: enabledLanes.length - runnableLanes.length,
        lastRunAt,
        nextDueAt: nextTimes.length ? new Date(Math.min(...nextTimes)).toISOString() : null,
      },
      graph: { candidates, sourceProfiles, evidenceItems, candidates24h, sourceProfiles24h, evidence24h },
      fleet: {
        rawDiscoveries24h,
        persisted24h: dayRows.reduce((sum, row) => sum + Number(row.count_persisted || 0), 0),
        proposals24h: dayRows.reduce((sum, row) => sum + Number(row.count_awaiting_review || 0), 0),
        errors24h: dayRows.reduce((sum, row) => sum + Number(row.api_errors || 0), 0),
        credits24h: dayRows.reduce((sum, row) => sum + Number(row.credits_spent || 0), 0),
        pendingIdentityReviews,
      },
      lanes,
      sources: [...sourceMap.values()].sort((a, b) => b.persisted - a.persisted || b.found - a.found),
      trust: {
        identityMergeAuthorized: false,
        contactValuesCaptured: false,
        recruiterDecisionAutomated: false,
        rawProviderContactValuesPersisted: false,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Fleet status failed.' }, { status: 500 })
  }
}
