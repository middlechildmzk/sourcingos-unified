import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { discoveryIntent } from '@/lib/connectors/contract-v33-3'
import type { SourceName } from '@/lib/source-types'
import { captureSourceResultV40 } from '@/lib/candidate-data/capture-source-result-v40'
import { technicalDossierToSourceResultV40 } from './dossier-source-result'
import { createSupabaseFleetCreditLedger, createSupabaseFleetLandingZone, writeFleetTelemetryV40 } from './durable-store'
import { createGitHubScout } from './scouts/github-scout'
import { createStackOverflowScout } from './scouts/stackoverflow-scout'
import { createRegistryScout } from './scouts/registry-scout'
import { createNppesScout } from './scouts/nppes-scout'
import { createOrcidScout } from './scouts/orcid-scout'
import { createStackSiteScout, findStackSite } from './scouts/stack-network-scout'
import type { ScoutAgent } from './types'

export type FleetLaneV40 = {
  id: string
  owner_id: string
  label: string
  hypothesis: string
  capability_terms: unknown
  location?: string | null
  sources: unknown
  people_limit: number
  credits_per_run: number
  run_id: string
}

const STACK_SOURCES = new Set<SourceName>(['serverfault', 'security_se', 'devops_se', 'unix_se', 'dba_se', 'networkeng_se'])

function requestedSources(raw: unknown): SourceName[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is SourceName => typeof item === 'string')
}

export function scoutsForSourcesV40(sources: SourceName[]): ScoutAgent[] {
  const scouts: ScoutAgent[] = []
  for (const source of sources) {
    if (source === 'github') scouts.push(createGitHubScout())
    else if (source === 'stackoverflow') scouts.push(createStackOverflowScout())
    else if (source === 'crates') scouts.push(createRegistryScout({ registry: 'crates' }))
    else if (source === 'npm') scouts.push(createRegistryScout({ registry: 'npm' }))
    else if (source === 'npi') scouts.push(createNppesScout())
    else if (source === 'orcid') scouts.push(createOrcidScout())
    else if (STACK_SOURCES.has(source)) {
      const site = findStackSite(source)
      if (site) scouts.push(createStackSiteScout(site))
    }
  }
  return scouts
}

export async function runFleetLaneV40(input: {
  sb: SupabaseClient
  lane: FleetLaneV40
  monthlyCreditGrant?: number
}) {
  const { sb, lane } = input
  const sources = requestedSources(lane.sources)
  const scouts = scoutsForSourcesV40(sources)
  if (!scouts.length) {
    return { runId: lane.run_id, found: 0, persisted: 0, proposals: 0, errors: 1, credits: 0, warnings: ['Lane has no executable public-source scouts.'] }
  }

  const capabilities = Array.isArray(lane.capability_terms)
    ? lane.capability_terms.filter((item): item is string => typeof item === 'string')
    : []
  const intent = discoveryIntent({
    hypothesis: lane.hypothesis,
    capabilityTerms: capabilities,
    location: lane.location || undefined,
    limit: lane.people_limit,
    runId: lane.run_id,
  })

  const landingZone = createSupabaseFleetLandingZone(sb, lane.owner_id)
  const credits = createSupabaseFleetCreditLedger({
    sb,
    ownerId: lane.owner_id,
    monthlyGrant: input.monthlyCreditGrant ?? Number(process.env.FLEET_MONTHLY_CREDIT_GRANT || 5000),
    runBudget: lane.credits_per_run,
  })

  const results = await Promise.all(scouts.map(scout => scout.run(intent, { landingZone, credits })))
  let persisted = 0
  let proposals = 0
  let errors = 0
  let creditsSpent = 0
  const warnings: string[] = []

  for (const result of results) {
    creditsSpent += result.creditsSpent
    errors += result.report.apiErrors + (result.haltReason === 'source_error' ? 1 : 0)
    warnings.push(...result.report.warnings)
    for (const dossier of result.dossiers) {
      const captured = await captureSourceResultV40(
        sb,
        lane.owner_id,
        technicalDossierToSourceResultV40(dossier),
        `Automatically captured by standing fleet lane ${lane.label}.`,
      )
      if (captured.ok) {
        persisted += 1
        proposals += Number(captured.identityReviewProposalsCreated || 0)
      } else {
        errors += 1
        warnings.push(`${dossier.source}:${dossier.person.sourceProfileId} capture failed (${captured.errorCode || 'unknown'}).`)
      }
    }
    await writeFleetTelemetryV40(sb, {
      ownerId: lane.owner_id,
      runId: lane.run_id,
      source: result.source,
      found: result.dossiers.length,
      persisted: result.dossiers.length,
      proposals: 0,
      errors: result.report.apiErrors,
      credits: result.creditsSpent,
      warnings: result.report.warnings,
    })
  }

  return {
    runId: lane.run_id,
    found: results.reduce((sum, result) => sum + result.dossiers.length, 0),
    persisted,
    proposals,
    errors,
    credits: creditsSpent,
    warnings: Array.from(new Set(warnings)).slice(0, 50),
  }
}
