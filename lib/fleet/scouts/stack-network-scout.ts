/**
 * Stack Exchange Network Scout (Fleet 1).
 *
 * Six sites beyond Stack Overflow, all through the same official API and the
 * same V33.3 connector. This is the cheapest coverage expansion available:
 * one parameter, no new API contract, no new failure mode.
 *
 * Why these six and not the whole network. Stack Overflow is where application
 * developers answer. It is not where system administrators, network engineers,
 * or security practitioners answer, and those are different populations. For
 * federal and cleared infrastructure work, Server Fault and Unix & Linux carry
 * evidence that Stack Overflow structurally does not have.
 *
 * A note on identity across the network. Stack Exchange gives a person one
 * network account with a distinct per-site user id. Two accounts on two sites
 * are therefore very often the same human, and this scout still does not merge
 * them. The API exposes `/users/{ids}/associated` for exactly this, and until
 * that route is wired and its response verified, a same-display-name match
 * across two sites is a resemblance. It goes to the review queue like any
 * other, which is the correct answer even though it will feel pedantic when
 * the two accounts obviously belong to one person.
 *
 * Per-site budgeting matters here. Stack Exchange quota is per application key
 * across the whole network, not per site. Running six sites at full width on
 * one tick would exhaust a daily quota that Stack Overflow alone would not
 * have touched, so the scout takes a site list and the caller decides width.
 */

import { newRunReport, type DiscoveryIntent, type TechnicalDossier } from '../../connectors/contract-v33-3'
import { ConnectorRequestLedger } from '../../connectors/request-ledger-v33-3'
import {
  STACK_NETWORK_SITES,
  discoverStackOverflowTalent,
  type StackSite,
} from '../../connectors/stackoverflow-v2'
import type { SourceName } from '../../source-types'
import { OPERATION_CREDIT_COST } from '../credit-ledger'
import { dossierToRawRecord } from './github-scout'
import type { ScoutAgent, ScoutDeps, ScoutResult } from '../types'

export { STACK_NETWORK_SITES }

/** Look up a network site by its SourceName. */
export function findStackSite(source: SourceName): StackSite | undefined {
  return STACK_NETWORK_SITES.find(site => site.source === source)
}

/**
 * Sites whose populations are most relevant to a given intent.
 *
 * This is a routing decision over retrieval terms, not a claim about anyone.
 * Getting it wrong wastes quota; it cannot contaminate a candidate record.
 */
export function rankSitesForIntent(intent: DiscoveryIntent): StackSite[] {
  const haystack = [String(intent.hypothesis), ...intent.capabilityTerms.map(String)]
    .join(' ')
    .toLowerCase()

  // Word boundaries are mandatory here, not stylistic. Short acronyms are
  // routinely substrings of unrelated words: an unbounded /nist/ matches
  // "admi(nist)rator" and routes every sysadmin search to the security site.
  const affinity: Record<SourceName, RegExp[]> = {
    serverfault: [/\b(linux|rhel|windows server|sysadmin|infrastructure|ansible|vmware|active directory|dns|nginx|apache)\b/],
    unix_se: [/\b(linux|rhel|unix|bash|shell|solaris|centos|debian|systemd|kernel)\b/],
    devops_se: [/\b(devops|kubernetes|docker|terraform|ci\/cd|jenkins|pipeline|helm|gitops)\b/],
    security_se: [/\b(security|infosec|cissp|soc|siem|penetration|vulnerability|cryptography|zero trust|nist|rmf)\b/],
    dba_se: [/\b(sql|database|postgres|oracle|mysql|dba|data warehouse|etl)\b/],
    networkeng_se: [/\b(network|networking|cisco|bgp|ospf|routing|switch|firewall|juniper|ccna|ccnp)\b/],
  } as Record<SourceName, RegExp[]>

  const scored = STACK_NETWORK_SITES.map(site => {
    const patterns = affinity[site.source] || []
    const score = patterns.filter(pattern => pattern.test(haystack)).length
    return { site, score }
  })

  const matched = scored.filter(entry => entry.score > 0)
  // No affinity signal is not evidence that no site fits. Fall back to the two
  // broadest sites rather than returning nothing.
  if (!matched.length) {
    return STACK_NETWORK_SITES.filter(
      site => site.source === 'serverfault' || site.source === 'unix_se',
    ).slice()
  }
  return matched.sort((a, b) => b.score - a.score).map(entry => entry.site)
}

export type StackNetworkScoutOptions = {
  /** Explicit site list. When omitted, sites are ranked from the intent. */
  sites?: readonly StackSite[]
  /** Sites queried per run. Kept low because network quota is shared. */
  maxSites?: number
  maxPeoplePerSite?: number
  fetchImpl?: typeof fetch
}

/**
 * One scout per site, so telemetry and provenance stay per-source.
 *
 * A single scout emitting dossiers from six sources would make
 * `ConnectorRunReport.sourceKey` a lie and would hide which site is failing.
 */
export function createStackSiteScout(
  site: StackSite,
  options: { maxPeople?: number; fetchImpl?: typeof fetch } = {},
): ScoutAgent {
  return {
    key: `scout.${site.source}`,
    source: site.source,
    label: site.label,

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport(site.source)
      const observedAt = deps.now?.() || new Date().toISOString()

      const limit = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 25))
      const estimated = OPERATION_CREDIT_COST.source_discovery * limit

      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source: site.source,
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.partial = true
        report.warnings.push(
          `Halted before calling ${site.label}: budget could not cover ${estimated} credits.`,
        )
        return {
          source: site.source,
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
        sourceKey: site.source,
        report,
        fetchImpl: options.fetchImpl,
      })

      let dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null

      try {
        const outcome = await discoverStackOverflowTalent(intent, {
          ledger,
          observedAt,
          maxPeople: limit,
          site,
        })
        dossiers = outcome.dossiers

        if (!outcome.strategies.length) {
          report.warnings.push(
            `No ${site.label} tag matched this intent. Recorded as a tag-coverage limit, not as an absence of practitioners.`,
          )
        }
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `${site.label} discovery failed: ${error instanceof Error ? error.message : String(error)}`,
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
          landingPath = await deps.landingZone.append(site.source, rawRecords)
        } catch (error) {
          report.warnings.push(
            `Raw landing write failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      report.peopleDiscovered = dossiers.length
      report.artifactsObserved = dossiers.reduce((sum, dossier) => sum + dossier.artifacts.length, 0)
      report.durationMs = Date.now() - startedAt

      return {
        source: site.source,
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

/**
 * Build the scouts for one run.
 *
 * Returned rather than executed so the orchestrator keeps control of
 * concurrency. The whole network shares one quota, so fanning out six sites
 * from inside a scout would bypass the fleet's own throttle.
 */
export function createStackNetworkScouts(
  intent: DiscoveryIntent,
  options: StackNetworkScoutOptions = {},
): ScoutAgent[] {
  const chosen = options.sites?.length ? [...options.sites] : rankSitesForIntent(intent)
  const width = Math.max(1, Math.min(options.maxSites ?? 2, STACK_NETWORK_SITES.length))
  return chosen
    .slice(0, width)
    .map(site =>
      createStackSiteScout(site, {
        maxPeople: options.maxPeoplePerSite,
        fetchImpl: options.fetchImpl,
      }),
    )
}
