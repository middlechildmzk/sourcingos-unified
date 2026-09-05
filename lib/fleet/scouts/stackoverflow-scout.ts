/**
 * Stack Overflow Scout (Fleet 1).
 *
 * Wraps `discoverStackOverflowTalent` from the V33.3 connector layer. Stack
 * Exchange publishes a documented API with a stated quota, so this scout uses
 * it rather than an X-Ray search that would guess at profile URLs.
 *
 * The second scout exists in this first loop for one reason: cross-source
 * identity is the whole point of the stitcher fleet, and it cannot be
 * exercised end to end with a single source.
 */

import { newRunReport, type DiscoveryIntent, type TechnicalDossier } from '../../connectors/contract-v33-3'
import { ConnectorRequestLedger } from '../../connectors/request-ledger-v33-3'
import {
  discoverStackOverflowTalent,
  stackOverflowConnectorMetadata,
} from '../../connectors/stackoverflow-v2'
import { OPERATION_CREDIT_COST } from '../credit-ledger'
import { dossierToRawRecord } from './github-scout'
import type { ScoutAgent, ScoutDeps, ScoutResult } from '../types'

export type StackOverflowScoutOptions = {
  maxPeople?: number
  fetchImpl?: typeof fetch
}

export function createStackOverflowScout(options: StackOverflowScoutOptions = {}): ScoutAgent {
  return {
    key: 'scout.stackoverflow',
    source: 'stackoverflow',
    label: stackOverflowConnectorMetadata.label,

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport('stackoverflow')

      const estimated = OPERATION_CREDIT_COST.source_discovery * Math.max(1, intent.limit)
      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source: 'stackoverflow',
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.warnings.push(
          `Halted before calling Stack Overflow: run budget could not cover ${estimated} credits.`,
        )
        report.partial = true
        return {
          source: 'stackoverflow',
          runId,
          dossiers: [],
          rawRecords: [],
          report,
          landingPath: null,
          creditsSpent: 0,
          haltReason: 'budget_exhausted',
        }
      }

      const ledger = new ConnectorRequestLedger({
        sourceKey: 'stackoverflow',
        report,
        fetchImpl: options.fetchImpl,
      })

      let dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null

      try {
        const outcome = await discoverStackOverflowTalent(intent, {
          ledger,
          maxPeople: options.maxPeople ?? intent.limit,
        })
        dossiers = outcome.dossiers
        if (!outcome.strategies.length) {
          report.warnings.push(
            'No Stack Overflow tag could be derived from this intent. Recorded as a source limit, not as an absence of people.',
          )
        }
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `Stack Overflow discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        haltReason = 'source_error'
      }

      const actualCredits = OPERATION_CREDIT_COST.source_discovery * dossiers.length
      await deps.credits.settle({
        reservationId: reservation.reservationId,
        actualCredits,
        succeeded: haltReason === null,
      })

      const rawRecords = dossiers.map(dossier => dossierToRawRecord(dossier, intent, runId))
      let landingPath: string | null = null
      if (rawRecords.length) {
        try {
          landingPath = await deps.landingZone.append('stackoverflow', rawRecords)
        } catch (error) {
          report.warnings.push(
            `Raw landing write failed, dossiers are in-memory only: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }

      report.durationMs = Date.now() - startedAt

      return {
        source: 'stackoverflow',
        runId,
        dossiers,
        rawRecords,
        report,
        landingPath,
        creditsSpent: haltReason === null ? actualCredits : 0,
        haltReason,
      }
    },
  }
}
