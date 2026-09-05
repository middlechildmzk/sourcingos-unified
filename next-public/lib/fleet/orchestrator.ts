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
const NOVELTY_REFRESH_DAYS = 30

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

async function sourceCycleV40_4(sb: SupabaseClient, lane: FleetLaneV40, source: SourceName): Promise<number> {
  const { data, error } = await sb.from('fleet_source_cursors')
    .select('cursor')
    .eq('owner_id', lane.owner_id)
    .eq('lane_id', lane.id)
    .eq('source', source)
    .maybeSingle()
  if (error || !data?.cursor || typeof data.cursor !== 'object') return 0
  const cycle = Number((data.cursor as Record<string, unknown>).cycle || 0)
  return Number.isFinite(cycle) && cycle >= 0 ? Math.trunc(cycle) : 0
}

async function advanceSourceCycleV40_4(sb: SupabaseClient, lane: FleetLaneV40, source: SourceName, cycle: number) {
  const { error } = await sb.from('fleet_source_cursors').upsert({
    owner_id: lane.owner_id,
    lane_id: lane.id,
    source,
    cursor: { cycle: cycle + 1, lastRunId: lane.run_id, strategy: 'capability_rotation_v40_4' },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,lane_id,source' })
  return error?.message || null
}

function rotatedIntentV40_4(lane: FleetLaneV40, capabilities: string[], source: SourceName, cycle: number) {
  const cleanCapabilities = capabilities.map(value => value.trim()).filter(Boolean)
  const offset = cleanCapabilities.length ? cycle % cleanCapabilities.length : 0
  const rotated = cleanCapabilities.length
    ? [...cleanCapabilities.slice(offset), ...cleanCapabilities.slice(0, offset)]
    : []
  // Put the rotating capability focus before the standing hypothesis so source
  // planners that take the first few search terms do not repeatedly request the
  // same top page forever. The role hypothesis remains present for relevance.
  const focus = rotated.slice(0, 2).join(' ')
  const hypothesis = focus ? `${focus} ${lane.hypothesis}` : lane.hypothesis
  return discoveryIntent({
    hypothesis,
    capabilityTerms: rotated,
    location: lane.location || undefined,
    limit: lane.people_limit,
    runId: lane.run_id,
  })
}

async function recentlySeenSourceProfilesV40_4(
  sb: SupabaseClient,
  lane: FleetLaneV40,
  source: SourceName,
  sourceProfileIds: string[],
): Promise<Set<string>> {
  if (!sourceProfileIds.length) return new Set()
  const cutoff = new Date(Date.now() - NOVELTY_REFRESH_DAYS * 86400_000).toISOString()
  const { data, error } = await sb.from('fleet_seen_source_profiles')
    .select('source_profile_id,last_seen_at')
    .eq('owner_id', lane.owner_id)
    .eq('lane_id', lane.id)
    .eq('source', source)
    .in('source_profile_id', sourceProfileIds)
    .gte('last_seen_at', cutoff)
  if (error) return new Set()
  return new Set((data || []).map(row => String(row.source_profile_id)))
}

async function markSourceProfileSeenV40_4(sb: SupabaseClient, lane: FleetLaneV40, source: SourceName, sourceProfileId: string) {
  const { error } = await sb.rpc('note_fleet_source_profile_seen_v40_4', {
    p_owner_id: lane.owner_id,
    p_lane_id: lane.id,
    p_source: source,
    p_source_profile_id: sourceProfileId,
    p_seen_at: new Date().toISOString(),
  })
  return error?.message || null
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
    return { runId: lane.run_id, found: 0, persisted: 0, proposals: 0, errors: 1, credits: 0, skippedPreviouslySeen: 0, warnings: ['Lane has no executable public-source scouts.'] }
  }

  const capabilities = Array.isArray(lane.capability_terms)
    ? lane.capability_terms.filter((item): item is string => typeof item === 'string')
    : []

  const landingZone = createSupabaseFleetLandingZone(sb, lane.owner_id)
  const credits = createSupabaseFleetCreditLedger({
    sb,
    ownerId: lane.owner_id,
    monthlyGrant: input.monthlyCreditGrant ?? Number(process.env.FLEET_MONTHLY_CREDIT_GRANT || 5000),
    runBudget: lane.credits_per_run,
  })

  const dispatched = await Promise.all(scouts.map(async scout => {
    const cycle = await sourceCycleV40_4(sb, lane, scout.source)
    const intent = rotatedIntentV40_4(lane, capabilities, scout.source, cycle)
    const result = await scout.run(intent, { landingZone, credits })
    const cursorWarning = await advanceSourceCycleV40_4(sb, lane, scout.source, cycle)
    return { result, cursorWarning }
  }))

  let persisted = 0
  let proposals = 0
  let errors = 0
  let creditsSpent = 0
  let skippedPreviouslySeen = 0
  const warnings: string[] = []

  for (const item of dispatched) {
    const result = item.result
    creditsSpent += result.creditsSpent
    const sourceScoutErrors = result.report.apiErrors + (result.haltReason === 'source_error' ? 1 : 0)
    let sourcePersisted = 0
    let sourceProposals = 0
    let sourceCaptureErrors = 0
    errors += sourceScoutErrors
    warnings.push(...result.report.warnings)
    if (item.cursorWarning) warnings.push(`${result.source}: novelty cursor update failed (${item.cursorWarning}).`)

    const profileIds = result.dossiers.map(dossier => String(dossier.person.sourceProfileId)).filter(Boolean)
    const recentSeen = await recentlySeenSourceProfilesV40_4(sb, lane, result.source, profileIds)
    const sourceSkipped = result.dossiers.filter(dossier => recentSeen.has(String(dossier.person.sourceProfileId))).length
    skippedPreviouslySeen += sourceSkipped

    for (const dossier of result.dossiers) {
      const profileId = String(dossier.person.sourceProfileId)
      if (recentSeen.has(profileId)) continue

      const captured = await captureSourceResultV40(
        sb,
        lane.owner_id,
        technicalDossierToSourceResultV40(dossier),
        `Automatically captured by standing fleet lane ${lane.label}.`,
      )
      if (captured.ok) {
        persisted += 1
        sourcePersisted += 1
        const created = Number(captured.identityReviewProposalsCreated || 0)
        proposals += created
        sourceProposals += created
        const seenWarning = await markSourceProfileSeenV40_4(sb, lane, result.source, profileId)
        if (seenWarning) warnings.push(`${result.source}:${profileId} novelty memory update failed (${seenWarning}).`)
      } else {
        errors += 1
        sourceCaptureErrors += 1
        warnings.push(`${dossier.source}:${dossier.person.sourceProfileId} capture failed (${captured.errorCode || 'unknown'}).`)
      }
    }

    const telemetryWarnings = [...result.report.warnings]
    if (sourceSkipped) telemetryWarnings.push(`Skipped ${sourceSkipped} source profile${sourceSkipped === 1 ? '' : 's'} seen within the last ${NOVELTY_REFRESH_DAYS} days.`)
    await writeFleetTelemetryV40(sb, {
      ownerId: lane.owner_id,
      runId: lane.run_id,
      source: result.source,
      found: result.dossiers.length,
      persisted: sourcePersisted,
      proposals: sourceProposals,
      errors: sourceScoutErrors + sourceCaptureErrors,
      credits: result.creditsSpent,
      warnings: telemetryWarnings,
    })
  }

  return {
    runId: lane.run_id,
    found: dispatched.reduce((sum, item) => sum + item.result.dossiers.length, 0),
    persisted,
    proposals,
    errors,
    credits: creditsSpent,
    skippedPreviouslySeen,
    warnings: Array.from(new Set(warnings)).slice(0, 50),
  }
}
