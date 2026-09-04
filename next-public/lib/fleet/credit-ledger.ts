/**
 * Fleet credit metering.
 *
 * Reserve-then-settle, never spend-then-account. A provider call may only
 * happen after `reserve` returns `granted: true`. If the call fails, `settle`
 * with `succeeded: false` releases the reservation so a source outage does not
 * silently burn a budget.
 *
 * This runs on the existing Supabase Postgres instance. A second Postgres
 * (Neon) for a ledger this small buys nothing but migration drift.
 */

import type { SourceName } from '../source-types'
import type { CreditLedger, CreditOperation } from './types'

/** Published per-operation costs, kept in one place so pricing is auditable. */
export const OPERATION_CREDIT_COST: Record<CreditOperation, number> = {
  source_discovery: 1,
  source_enrichment: 1,
  model_inference: 2,
  embedding: 1,
}

export type CreditRow = {
  reservation_id: string
  run_id: string
  operation: CreditOperation
  source: string
  reserved_credits: number
  settled_credits: number | null
  succeeded: boolean | null
  created_at: string
}

/** Minimal port over the SQL client so this is testable without a database. */
export type LedgerStore = {
  balance(): Promise<number>
  insertReservation(row: Omit<CreditRow, 'created_at'>): Promise<void>
  settleReservation(reservationId: string, actual: number, succeeded: boolean): Promise<void>
}

export class MeteredCreditLedger implements CreditLedger {
  constructor(
    private readonly store: LedgerStore,
    private readonly makeId: () => string = () =>
      `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  ) {}

  async reserve(input: {
    runId: string
    operation: CreditOperation
    source: SourceName
    estimatedCredits: number
  }): Promise<{ reservationId: string; granted: boolean; balanceAfter: number }> {
    const cost = Math.max(0, Math.trunc(input.estimatedCredits))
    const balance = await this.store.balance()
    const reservationId = this.makeId()

    if (cost > balance) {
      return { reservationId, granted: false, balanceAfter: balance }
    }

    await this.store.insertReservation({
      reservation_id: reservationId,
      run_id: input.runId,
      operation: input.operation,
      source: input.source,
      reserved_credits: cost,
      settled_credits: null,
      succeeded: null,
    })

    return { reservationId, granted: true, balanceAfter: balance - cost }
  }

  async settle(input: {
    reservationId: string
    actualCredits: number
    succeeded: boolean
  }): Promise<void> {
    const actual = input.succeeded ? Math.max(0, Math.trunc(input.actualCredits)) : 0
    await this.store.settleReservation(input.reservationId, actual, input.succeeded)
  }
}

/**
 * In-memory ledger for tests and for local-first runs where a budget still
 * needs to be enforced but nothing should be persisted.
 */
export class MemoryCreditLedger implements CreditLedger {
  private remaining: number
  readonly reservations = new Map<string, { cost: number; settled: boolean }>()
  private counter = 0

  constructor(startingBalance: number) {
    this.remaining = startingBalance
  }

  async reserve(input: {
    runId: string
    operation: CreditOperation
    source: SourceName
    estimatedCredits: number
  }) {
    const cost = Math.max(0, Math.trunc(input.estimatedCredits))
    const reservationId = `mem_${++this.counter}`
    if (cost > this.remaining) {
      return { reservationId, granted: false, balanceAfter: this.remaining }
    }
    this.remaining -= cost
    this.reservations.set(reservationId, { cost, settled: false })
    return { reservationId, granted: true, balanceAfter: this.remaining }
  }

  async settle(input: { reservationId: string; actualCredits: number; succeeded: boolean }) {
    const held = this.reservations.get(input.reservationId)
    if (!held || held.settled) return
    held.settled = true
    if (!input.succeeded) {
      this.remaining += held.cost
      return
    }
    const actual = Math.max(0, Math.trunc(input.actualCredits))
    this.remaining += held.cost - actual
  }

  get balance(): number {
    return this.remaining
  }
}
