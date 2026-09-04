/**
 * Standing intents: what the fleet crawls when nobody is asking.
 *
 * This is the piece that makes the fleet continuous rather than on-demand, and
 * it is the piece most likely to cause harm if it is written carelessly. Three
 * failure modes it is built to avoid:
 *
 *   1. Stampede. A naive scheduler fires every lane on every tick and burns a
 *      month of quota in an afternoon. Lanes carry a cadence and are only due
 *      after it elapses.
 *
 *   2. Starvation. A scheduler that always picks the highest-priority lane
 *      never runs the others. Selection is by staleness, so an unpicked lane
 *      becomes more urgent every tick until it runs.
 *
 *   3. Silent overrun. A scheduler that admits lanes without checking the
 *      budget leaves the budget check to the scouts, which halt mid-run and
 *      waste the calls already made. Admission is budget-aware up front.
 *
 * Everything here is a pure function over an explicit clock, so the whole
 * 24/7 behaviour is testable without waiting 24 hours.
 */

import { discoveryIntent, type DiscoveryIntent } from '../connectors/contract-v33-3'
import type { SourceName } from '../source-types'

export type StandingIntent = {
  readonly id: string
  readonly label: string
  /** Retrieval-only. Becomes a DiscoveryIntent at dispatch time. */
  readonly hypothesis: string
  readonly capabilityTerms: readonly string[]
  readonly location?: string
  /** Which scouts this lane runs against. Empty means all enabled scouts. */
  readonly sources: readonly SourceName[]
  /** Minimum gap between runs, in minutes. */
  readonly cadenceMinutes: number
  /** People requested per run. */
  readonly limit: number
  /** Credits this lane may consume per run. */
  readonly creditsPerRun: number
  readonly enabled: boolean
  /** Null when the lane has never run. */
  readonly lastRunAt: string | null
  /** Set when an operator pauses a lane, with the reason shown in the UI. */
  readonly pausedReason?: string
}

export type SchedulerTick = {
  readonly now: Date
  readonly intents: readonly StandingIntent[]
  /** Credits available for this tick across all lanes. */
  readonly availableCredits: number
  /** Ceiling on lanes dispatched per tick, so one tick cannot fan out wide. */
  readonly maxLanesPerTick: number
}

export type ScheduledLane = {
  readonly intent: StandingIntent
  readonly dispatch: DiscoveryIntent
  readonly runId: string
  readonly stalenessMinutes: number
}

export type SchedulerDecision = {
  readonly dispatched: readonly ScheduledLane[]
  /** Lanes that were due but could not run, with the reason, for operator display. */
  readonly deferred: readonly { intentId: string; reason: string }[]
  readonly creditsCommitted: number
}

export function minutesSince(from: string | null, now: Date): number {
  if (!from) return Number.POSITIVE_INFINITY
  const then = Date.parse(from)
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (now.getTime() - then) / 60_000
}

export function isDue(intent: StandingIntent, now: Date): boolean {
  if (!intent.enabled) return false
  if (intent.pausedReason) return false
  return minutesSince(intent.lastRunAt, now) >= intent.cadenceMinutes
}

export function makeRunId(intentId: string, now: Date): string {
  const stamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const safe = intentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)
  return `run_${safe}_${stamp}`
}

/**
 * Choose which lanes run on this tick.
 *
 * Ordering is by staleness descending, which is what prevents starvation: a
 * lane that keeps losing gets more stale and eventually wins. Priority is
 * deliberately not a field, because a priority number would let one lane
 * monopolise the fleet forever and no operator would notice.
 */
export function selectDueLanes(tick: SchedulerTick): SchedulerDecision {
  const due = tick.intents
    .filter(intent => isDue(intent, tick.now))
    .map(intent => ({ intent, stalenessMinutes: minutesSince(intent.lastRunAt, tick.now) }))
    .sort((a, b) => {
      if (b.stalenessMinutes !== a.stalenessMinutes) {
        return b.stalenessMinutes - a.stalenessMinutes
      }
      // Deterministic tiebreak so a tick is reproducible in a replay.
      return a.intent.id.localeCompare(b.intent.id)
    })

  const dispatched: ScheduledLane[] = []
  const deferred: { intentId: string; reason: string }[] = []
  let remaining = Math.max(0, tick.availableCredits)

  for (const candidate of due) {
    if (dispatched.length >= tick.maxLanesPerTick) {
      deferred.push({
        intentId: candidate.intent.id,
        reason: 'Tick lane limit reached. This lane runs on the next tick.',
      })
      continue
    }

    const cost = Math.max(0, Math.trunc(candidate.intent.creditsPerRun))
    if (cost > remaining) {
      deferred.push({
        intentId: candidate.intent.id,
        reason: `Needs ${cost} credits, ${remaining} available. Deferred rather than started and halted mid-run.`,
      })
      continue
    }

    remaining -= cost
    dispatched.push({
      intent: candidate.intent,
      stalenessMinutes: candidate.stalenessMinutes,
      runId: makeRunId(candidate.intent.id, tick.now),
      dispatch: discoveryIntent({
        hypothesis: candidate.intent.hypothesis,
        capabilityTerms: candidate.intent.capabilityTerms,
        location: candidate.intent.location,
        limit: candidate.intent.limit,
        runId: makeRunId(candidate.intent.id, tick.now),
      }),
    })
  }

  return {
    dispatched,
    deferred,
    creditsCommitted: Math.max(0, tick.availableCredits) - remaining,
  }
}

/**
 * Guard against a lane that keeps running and never finds anyone.
 *
 * A standing lane that returns nothing for many consecutive runs is either
 * badly specified or pointed at a source that no longer answers. Either way it
 * should stop spending. This returns a pause reason rather than pausing
 * directly, so the operator sees why.
 */
export function evaluateLaneHealth(input: {
  consecutiveEmptyRuns: number
  consecutiveErrorRuns: number
}): string | null {
  if (input.consecutiveErrorRuns >= 5) {
    return 'Paused after 5 consecutive source errors. The source or credential likely needs attention.'
  }
  if (input.consecutiveEmptyRuns >= 10) {
    return 'Paused after 10 consecutive runs returning nobody. The lane terms probably need rewriting.'
  }
  return null
}
