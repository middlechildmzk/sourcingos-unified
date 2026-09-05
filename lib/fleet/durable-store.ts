import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreditLedger, LandingZone, RawDiscoveryRecord } from './types'
import type { SourceName } from '@/lib/source-types'

function scrubContacts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubContacts)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/(?:^|_)(?:e?mail|phone|telephone|fax)(?:$|_)/i.test(key)) continue
    out[key] = scrubContacts(child)
  }
  return out
}

export function createSupabaseFleetLandingZone(sb: SupabaseClient, ownerId: string): LandingZone {
  return {
    async append(source: SourceName, records: readonly RawDiscoveryRecord[]) {
      if (!records.length) return `supabase://${ownerId}/${source}/empty`
      const rows = records.map(record => ({
        owner_id: ownerId,
        source: record.source,
        source_profile_id: record.sourceProfileId,
        source_url: record.sourceUrl,
        raw_data: scrubContacts(record.rawData),
        retrieval_terms: record.retrievalTerms.map(String),
        discovered_at: record.discoveredAt,
        run_id: record.runId,
      }))
      const { error } = await sb.from('fleet_raw_discoveries').insert(rows)
      if (error) throw new Error(`Fleet landing write failed: ${error.message}`)
      return `supabase://${ownerId}/${source}/${records[0].runId}`
    },
  }
}

export function createSupabaseFleetCreditLedger(input: {
  sb: SupabaseClient
  ownerId: string
  monthlyGrant: number
  runBudget: number
}): CreditLedger {
  const reservations = new Map<string, number>()
  let runRemaining = Math.max(0, Math.trunc(input.runBudget))

  return {
    async reserve(request) {
      const estimated = Math.max(0, Math.trunc(request.estimatedCredits))
      const reservationId = crypto.randomUUID()
      if (estimated > runRemaining) {
        return { reservationId, granted: false, balanceAfter: runRemaining }
      }

      const { data, error } = await input.sb.rpc('reserve_fleet_credits_v40', {
        p_owner_id: input.ownerId,
        p_reservation_id: reservationId,
        p_run_id: request.runId,
        p_operation: request.operation,
        p_source: request.source,
        p_reserved_credits: estimated,
        p_monthly_grant: Math.max(0, Math.trunc(input.monthlyGrant)),
      })
      if (error) return { reservationId, granted: false, balanceAfter: 0 }
      const row = Array.isArray(data) ? data[0] : data
      const granted = Boolean(row?.granted)
      const balanceAfter = Number(row?.balance_after ?? 0)
      if (granted) {
        reservations.set(reservationId, estimated)
        runRemaining -= estimated
      }
      return { reservationId, granted, balanceAfter: Math.min(runRemaining, balanceAfter) }
    },

    async settle(request) {
      const reserved = reservations.get(request.reservationId) || 0
      const actual = request.succeeded ? Math.max(0, Math.trunc(request.actualCredits)) : 0
      const { error } = await input.sb
        .from('fleet_credit_reservations')
        .update({ settled_credits: actual, succeeded: request.succeeded, settled_at: new Date().toISOString() })
        .eq('owner_id', input.ownerId)
        .eq('reservation_id', request.reservationId)
      if (error) throw new Error(`Fleet credit settlement failed: ${error.message}`)
      runRemaining += Math.max(0, reserved - actual)
      reservations.delete(request.reservationId)
    },
  }
}

export async function claimDueFleetLanesV40(sb: SupabaseClient, limit = 4) {
  const { data, error } = await sb.rpc('claim_due_fleet_lanes_v40', {
    p_limit: Math.max(1, Math.min(Math.trunc(limit), 4)),
    p_now: new Date().toISOString(),
  })
  if (error) throw new Error(`Fleet lane claim failed: ${error.message}`)
  return Array.isArray(data) ? data : []
}

export async function finishFleetLaneV40(input: {
  sb: SupabaseClient
  ownerId: string
  intentId: string
  runId: string
  found: number
  errors: number
  warnings: string[]
}) {
  const { data: lane } = await input.sb
    .from('fleet_standing_intents')
    .select('consecutive_empty_runs,consecutive_error_runs')
    .eq('owner_id', input.ownerId)
    .eq('id', input.intentId)
    .maybeSingle()

  const emptyRuns = input.found === 0 ? Number(lane?.consecutive_empty_runs || 0) + 1 : 0
  const errorRuns = input.errors > 0 ? Number(lane?.consecutive_error_runs || 0) + 1 : 0
  const pausedReason = errorRuns >= 5
    ? 'Auto-paused after 5 consecutive error runs.'
    : emptyRuns >= 10
      ? 'Auto-paused after 10 consecutive empty runs.'
      : null

  await input.sb.from('fleet_standing_intents').update({
    last_run_id: input.runId,
    consecutive_empty_runs: emptyRuns,
    consecutive_error_runs: errorRuns,
    paused_reason: pausedReason,
    last_result_summary: {
      found: input.found,
      errors: input.errors,
      warnings: input.warnings.slice(0, 20),
      completedAt: new Date().toISOString(),
    },
  }).eq('owner_id', input.ownerId).eq('id', input.intentId)
}

export async function writeFleetTelemetryV40(sb: SupabaseClient, row: {
  ownerId: string
  runId: string
  source: string
  found: number
  persisted: number
  proposals: number
  errors: number
  credits: number
  warnings: string[]
}) {
  await sb.from('fleet_run_telemetry').insert({
    owner_id: row.ownerId,
    run_id: row.runId,
    stage: 'scout',
    source: row.source,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 0,
    count_found: row.found,
    count_persisted: row.persisted,
    count_awaiting_review: row.proposals,
    count_auto_promoted: 0,
    credits_spent: row.credits,
    api_errors: row.errors,
    warnings: row.warnings.slice(0, 30),
  })
}
