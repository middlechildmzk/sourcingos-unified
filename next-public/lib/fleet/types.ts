/**
 * SourcingOS Autonomous Fleet - shared types (V33.4F).
 *
 * The fleet is an orchestration layer over the V33.3 connector contract. It
 * adds scheduling, concurrency, retries, cost metering, and a durable raw
 * landing zone. It deliberately adds no new authority.
 *
 * Two rules are encoded structurally rather than by convention:
 *
 *   1. Retrieval terms travel with the raw record but are typed as
 *      `RetrievalTerm`, so a scout cannot write a query term onto a person.
 *   2. There is no fleet-level merge authority. Deterministic anchors may
 *      create a recruiter-review proposal, but only the existing recruiter
 *      Identity Review flow may link two source identities.
 */

import type {
  DiscoveryIntent,
  RetrievalTerm,
  TechnicalDossier,
  ConnectorRunReport,
} from '../connectors/contract-v33-3'
import type { SourceName } from '../source-types'

/* ------------------------------------------------------------------ *
 * Raw landing zone
 * ------------------------------------------------------------------ */

/**
 * A single discovered record, exactly as the source returned it, plus the
 * provenance needed to replay it. Written before any interpretation happens.
 *
 * `retrievalTerms` is stored so an operator can audit *why* this record was
 * fetched. It is typed `RetrievalTerm[]` so it cannot be assigned into any
 * evidence field downstream.
 */
export type RawDiscoveryRecord = {
  readonly source: SourceName
  readonly sourceProfileId: string
  readonly sourceUrl: string
  readonly rawData: Record<string, unknown>
  readonly discoveredAt: string
  readonly runId: string
  /** Audit trail only. Never candidate evidence. */
  readonly retrievalTerms: readonly RetrievalTerm[]
}

/** Port for the raw landing zone so tests do not require @vercel/blob. */
export type LandingZone = {
  /** Append records for one source/day partition. Returns the written path. */
  append(source: SourceName, records: readonly RawDiscoveryRecord[]): Promise<string>
}

/* ------------------------------------------------------------------ *
 * Cost metering
 * ------------------------------------------------------------------ */

export type CreditOperation =
  | 'source_discovery'
  | 'source_enrichment'
  | 'model_inference'
  | 'embedding'

/**
 * Reserve-then-settle metering. Credits are reserved *before* the provider
 * call so an over-budget run cannot spend first and account later. A failed
 * call settles at zero and releases the reservation.
 */
export type CreditLedger = {
  reserve(input: {
    runId: string
    operation: CreditOperation
    source: SourceName
    estimatedCredits: number
  }): Promise<{ reservationId: string; granted: boolean; balanceAfter: number }>
  settle(input: {
    reservationId: string
    actualCredits: number
    succeeded: boolean
  }): Promise<void>
}

/* ------------------------------------------------------------------ *
 * Scout output
 * ------------------------------------------------------------------ */

export type ScoutResult = {
  readonly source: SourceName
  readonly runId: string
  readonly dossiers: readonly TechnicalDossier[]
  readonly rawRecords: readonly RawDiscoveryRecord[]
  readonly report: ConnectorRunReport
  readonly landingPath: string | null
  readonly creditsSpent: number
  /** Set when the scout stopped early rather than completing the intent. */
  readonly haltReason: 'budget_exhausted' | 'credential_missing' | 'source_error' | null
}

export type ScoutDeps = {
  readonly landingZone: LandingZone
  readonly credits: CreditLedger
  readonly now?: () => string
}

/** Every scout is this shape. Pure async function, no framework coupling. */
export type ScoutAgent = {
  readonly key: string
  readonly source: SourceName
  readonly label: string
  run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult>
}

/* ------------------------------------------------------------------ *
 * Identity observations
 * ------------------------------------------------------------------ */

/**
 * Fleet-level identity output is proposal-only. A scout or stitcher may explain
 * why two observations deserve review, but there is deliberately no outcome
 * that can mutate canonical identity.
 */
export type IdentityDecision =
  | { kind: 'review_proposal'; leftKey: string; rightKey: string; priority: number; reasons: string[] }
  | { kind: 'blocked'; leftKey: string; rightKey: string; conflicts: string[] }
  | { kind: 'no_link'; leftKey: string; rightKey: string }

export type StitcherResult = {
  readonly runId: string
  readonly decisions: readonly IdentityDecision[]
  readonly proposalsCreated: number
  readonly blocked: number
  readonly evaluated: number
}

/* ------------------------------------------------------------------ *
 * Fleet run telemetry
 * ------------------------------------------------------------------ */

export type FleetRunTelemetry = {
  readonly runId: string
  readonly stage: 'scout' | 'normalize' | 'resolve' | 'promote'
  readonly source: SourceName | 'multi'
  readonly startedAt: string
  readonly finishedAt: string
  readonly durationMs: number
  readonly countFound: number
  /** Deterministic anchors observed; still recruiter-review only. */
  readonly countDeterministicAnchors: number
  readonly countAwaitingReview: number
  readonly countBlocked: number
  /** Records written to canonical storage with no human in the loop. */
  readonly countAutoPromoted: number
  readonly creditsSpent: number
  readonly apiErrors: number
  readonly warnings: readonly string[]
}

export type FleetIntentEnvelope = {
  readonly runId: string
  readonly intent: DiscoveryIntent
  readonly requestedBy: string
  readonly requestedAt: string
  /** Hard ceiling for the whole run. Scouts halt rather than exceed it. */
  readonly creditBudget: number
}
