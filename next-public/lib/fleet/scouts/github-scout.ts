/**
 * GitHub Scout (Fleet 1).
 *
 * This does not reimplement GitHub discovery. It wraps `discoverGitHubTalent`
 * from the V33.3 connector layer, which already enforces the contract rules:
 * observed technologies carry provenance, retrieval terms are branded, forks
 * and archived repositories are marked, and "appears in activity history" is
 * kept distinct from "maintains".
 *
 * What the scout adds is fleet concern only: budget reservation before the
 * call, a durable raw write, and run telemetry.
 *
 * GitHub has a documented REST and GraphQL API. There is no reason to point a
 * headless browser or a scraping actor at it, and doing so would trade a
 * supported quota for an unsupported one.
 */

import {
  newRunReport,
  type DiscoveryIntent,
  type TechnicalDossier,
} from '../../connectors/contract-v33-3'
import { ConnectorRequestLedger } from '../../connectors/request-ledger-v33-3'
import { discoverGitHubTalent, githubConnectorMetadata } from '../../connectors/github-v2'
import { OPERATION_CREDIT_COST } from '../credit-ledger'
import type { RawDiscoveryRecord, ScoutAgent, ScoutDeps, ScoutResult } from '../types'

export function dossierToRawRecord(
  dossier: TechnicalDossier,
  intent: DiscoveryIntent,
  runId: string,
): RawDiscoveryRecord {
  return {
    source: dossier.source,
    sourceProfileId: dossier.person.sourceProfileId,
    sourceUrl: dossier.person.profileUrl,
    rawData: dossier.raw,
    discoveredAt: dossier.observedAt,
    runId,
    // Audit trail. Branded RetrievalTerm, so the type system refuses any
    // attempt to assign these onto an evidence field downstream.
    retrievalTerms: [intent.hypothesis, ...intent.capabilityTerms],
  }
}

export type GitHubScoutOptions = {
  token?: string
  maxRepositories?: number
  maxPeople?: number
  fetchImpl?: typeof fetch
}

export function createGitHubScout(options: GitHubScoutOptions = {}): ScoutAgent {
  return {
    key: 'scout.github',
    source: 'github',
    label: githubConnectorMetadata.label,

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport('github')

      const estimated = OPERATION_CREDIT_COST.source_discovery * Math.max(1, intent.limit)
      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source: 'github',
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.warnings.push(
          `Halted before calling GitHub: run budget could not cover ${estimated} credits.`,
        )
        report.partial = true
        return {
          source: 'github',
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
        sourceKey: 'github',
        report,
        fetchImpl: options.fetchImpl,
      })

      let dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null

      try {
        const outcome = await discoverGitHubTalent(intent, {
          ledger,
          token: options.token,
          maxRepositories: options.maxRepositories,
          maxPeople: options.maxPeople ?? intent.limit,
        })
        dossiers = outcome.dossiers
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `GitHub discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        haltReason = 'source_error'
      }

      // Actual spend is per person genuinely returned, not per person asked
      // for. A source that returns nothing does not bill the operator.
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
          landingPath = await deps.landingZone.append('github', rawRecords)
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
        source: 'github',
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
