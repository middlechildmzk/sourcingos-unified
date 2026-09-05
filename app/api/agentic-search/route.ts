import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { connectorRunners, type CampaignInput, type ConnectorKey } from '@/lib/acquisition-v22'
import { discoverNpiByTaxonomy } from '@/lib/agentic-npi-v31'
import type { AgenticConnectorKey } from '@/lib/agentic-search-v30'
import { classifyRealSourceResults } from '@/lib/entity-classification'
import { searchGitHubPeople } from '@/lib/github-person-discovery'
import { enforceGitHubResultsTruth } from '@/lib/github-result-truth'
import { searchStackOverflowTalent } from '@/lib/stackoverflow-talent-source-v33-2'
import { discoverDevToTalent } from '@/lib/connectors/devto-v33-6'
import { discoverHuggingFacePeople } from '@/lib/connectors/huggingface-person-v33-7'
import {
  discoverInfrastructureStackExchangeTalentV33_11,
  isInfrastructureStackExchangeQueryV33_11,
} from '@/lib/connectors/stackexchange-infra-v33-11'
import { sourceDiverseResults, sourceDistribution } from '@/lib/source-orchestration-v33-8'
import {
  preferTechnicalV2,
  runGitHubV2,
  runStackOverflowV2,
  type TechnicalActivationMode,
  type TechnicalActivationResult,
} from '@/lib/connectors/technical-v2-activation'
import {
  planGeographyExecutionV35,
  runBoundedGeographyFanoutV35,
  type GeographyExecutionPlanV35,
} from '@/lib/entity-intelligence/geography-execution-v35'
import type { SourceResult } from '@/lib/source-types'

export const dynamic = 'force-dynamic'

const EXECUTABLE_CONNECTORS = ['github', 'stackoverflow', 'devto', 'huggingface', 'orcid', 'openalex', 'pubmed', 'crossref', 'npi'] as const satisfies readonly AgenticConnectorKey[]
const connectorEnum = z.enum(EXECUTABLE_CONNECTORS)
const queryValue = z.string().trim().min(2).max(500)
const connectorQueriesSchema = z.object({
  github: queryValue.optional(),
  stackoverflow: queryValue.optional(),
  devto: queryValue.optional(),
  huggingface: queryValue.optional(),
  orcid: queryValue.optional(),
  openalex: queryValue.optional(),
  pubmed: queryValue.optional(),
  crossref: queryValue.optional(),
  npi: queryValue.optional(),
}).strict()

const requestSchema = z.object({
  query: queryValue,
  connectorQueries: connectorQueriesSchema.optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  targetCompanies: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  locations: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  connectors: z.array(connectorEnum).min(1).max(EXECUTABLE_CONNECTORS.length),
  limit: z.number().int().min(1).max(50).default(20),
}).strict()

type AgenticDiscovery = {
  sourceKey: AgenticConnectorKey
  sourceId: string
  sourceUrl: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  summary?: string
  skills: string[]
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
  sourceResult?: SourceResult
}

type GeographyStatusV35 = GeographyExecutionPlanV35 & {
  discoveredByLocation?: Record<string, number>
}

type AgenticSourceStatus = {
  status: 'completed' | 'failed' | 'unavailable'
  discovered: number
  message?: string
  engine?: TechnicalActivationMode | 'native'
  degraded?: boolean
  geography?: GeographyStatusV35
}

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function discoveryFromSourceResult(result: SourceResult): AgenticDiscovery {
  const evidenceCount = Math.min(8, result.evidence.length)
  const observedSkillCount = Math.min(8, result.skills.length)
  return {
    sourceKey: result.source as AgenticConnectorKey,
    sourceId: result.sourceProfileId,
    sourceUrl: result.profileUrl || '',
    displayName: result.displayName,
    headline: result.headline,
    organization: result.organization,
    location: result.location,
    summary: result.evidence[0]?.detail,
    skills: result.skills,
    evidence: result.evidence.map(item => ({
      kind: 'source_evidence',
      label: item.label,
      value: item.detail,
      url: item.url,
      observedAt: item.observedAt,
    })),
    identityConfidence: Math.min(95, 70 + evidenceCount * 2),
    profileQuality: Math.min(95, 45 + evidenceCount * 5 + observedSkillCount * 2),
    sourceResult: result,
  }
}

function safeDiscovery(discovery: AgenticDiscovery) {
  const sourceResult = discovery.sourceResult
    ? {
        ...discovery.sourceResult,
        profileUrl: safeUrl(discovery.sourceResult.profileUrl),
        evidence: discovery.sourceResult.evidence.slice(0, 20).map(item => ({ ...item, url: safeUrl(item.url) })),
        contactSignals: discovery.sourceResult.contactSignals.slice(0, 10),
        identitySignals: discovery.sourceResult.identitySignals.slice(0, 20),
        skills: discovery.sourceResult.skills.slice(0, 30),
      }
    : undefined

  return {
    sourceKey: discovery.sourceKey,
    sourceId: discovery.sourceId,
    sourceUrl: safeUrl(discovery.sourceUrl),
    displayName: discovery.displayName,
    headline: discovery.headline,
    organization: discovery.organization,
    location: discovery.location,
    summary: discovery.summary,
    skills: discovery.skills.slice(0, 20),
    evidence: discovery.evidence.slice(0, 10).map(item => ({ ...item, url: safeUrl(item.url) })),
    identityConfidence: discovery.identityConfidence,
    profileQuality: discovery.profileQuality,
    saveEligible: Boolean(sourceResult?.entityKind === 'person'),
    sourceResult,
  }
}

function sourceResultKey(result: SourceResult): string {
  return `${result.source}:${result.sourceProfileId}`
}

function activationEngine(activations: readonly TechnicalActivationResult[]): TechnicalActivationMode {
  return activations.some(item => item.mode === 'legacy_fallback') ? 'legacy_fallback' : 'v2'
}

function compactMessage(...parts: Array<string | undefined>): string | undefined {
  const value = parts.map(part => String(part || '').trim()).filter(Boolean).join(' ')
  return value ? value.slice(0, 240) : undefined
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid agentic search request.', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data
  const sourceStatus: Record<string, AgenticSourceStatus> = {}
  const allResults: ReturnType<typeof safeDiscovery>[] = []
  const seen = new Set<string>()

  // V33.8 deliberately executes every selected connector. The global slate cap
  // is applied only after all connectors have had a chance to contribute.
  for (const connector of body.connectors) {
    const connectorQuery = body.connectorQueries?.[connector] || body.query

    try {
      let discoveries: AgenticDiscovery[] = []

      if (connector === 'github') {
        const geography = planGeographyExecutionV35('github', body.locations, Math.min(body.limit, 12))
        const activations: TechnicalActivationResult[] = []
        let rawResults: SourceResult[] = []
        let discoveredByLocation: Record<string, number> | undefined

        if (geography.mode === 'bounded_fanout' && geography.executedLocations.length) {
          const fanout = await runBoundedGeographyFanoutV35(
            geography,
            async (location, locationLimit) => {
              const activation = await preferTechnicalV2({
                source: 'github',
                runV2: () => runGitHubV2({
                  query: connectorQuery,
                  skills: body.skills,
                  location,
                  limit: locationLimit,
                }),
                runFallback: async () => {
                  const response = await searchGitHubPeople({
                    query: connectorQuery,
                    location,
                    sources: ['github'],
                    limit: locationLimit,
                  })
                  const classified = enforceGitHubResultsTruth(classifyRealSourceResults(response.results))
                    .filter(result => result.entityKind === 'person')
                  return {
                    results: classified,
                    message: response.warnings.length ? response.warnings.join(' ').slice(0, 240) : undefined,
                  }
                },
              })
              activations.push(activation)
              return activation.results
            },
            sourceResultKey,
          )
          rawResults = fanout.items
          discoveredByLocation = fanout.discoveredByLocation
        } else {
          const activation = await preferTechnicalV2({
            source: 'github',
            runV2: () => runGitHubV2({
              query: connectorQuery,
              skills: body.skills,
              limit: Math.min(body.limit, 12),
            }),
            runFallback: async () => {
              const response = await searchGitHubPeople({
                query: connectorQuery,
                location: '',
                sources: ['github'],
                limit: Math.min(body.limit, 12),
              })
              const classified = enforceGitHubResultsTruth(classifyRealSourceResults(response.results))
                .filter(result => result.entityKind === 'person')
              return {
                results: classified,
                message: response.warnings.length ? response.warnings.join(' ').slice(0, 240) : undefined,
              }
            },
          })
          activations.push(activation)
          rawResults = activation.results
        }

        const classified = enforceGitHubResultsTruth(classifyRealSourceResults(rawResults))
          .filter(result => result.entityKind === 'person')
        discoveries = classified.map(discoveryFromSourceResult)
        sourceStatus.github = {
          status: 'completed',
          discovered: 0,
          engine: activationEngine(activations),
          degraded: activations.some(item => item.degraded),
          message: compactMessage(
            geography.explanation,
            geography.omittedLocations.length ? `${geography.omittedLocations.length} additional approved market${geography.omittedLocations.length === 1 ? '' : 's'} deferred by the per-pass source budget.` : undefined,
            activations.map(item => item.message).filter(Boolean).join(' '),
          ),
          geography: { ...geography, ...(discoveredByLocation ? { discoveredByLocation } : {}) },
        }
      } else if (connector === 'stackoverflow') {
        const infrastructure = isInfrastructureStackExchangeQueryV33_11(connectorQuery, body.skills)
        if (infrastructure) {
          const geography = planGeographyExecutionV35('stackexchange_infrastructure', body.locations, Math.min(body.limit, 16))
          const response = await discoverInfrastructureStackExchangeTalentV33_11({
            query: connectorQuery,
            skills: body.skills,
            limit: Math.min(body.limit, 16),
          })
          const classified = classifyRealSourceResults(response.results)
            .filter(result => result.entityKind === 'person')
          discoveries = classified.map(discoveryFromSourceResult)
          sourceStatus.stackoverflow = {
            status: 'completed',
            discovered: 0,
            engine: 'native',
            degraded: Boolean(response.warnings.length),
            message: compactMessage(
              'Infrastructure role routed through the official Stack Exchange API to Server Fault and Unix & Linux instead of ordinary Stack Overflow.',
              geography.explanation,
              response.warnings.slice(0, 2).join(' '),
            ),
            geography,
          }
        } else {
          const geography = planGeographyExecutionV35('stackoverflow', body.locations, Math.min(body.limit, 20))
          const activations: TechnicalActivationResult[] = []
          let rawResults: SourceResult[] = []
          let discoveredByLocation: Record<string, number> | undefined

          if (geography.mode === 'bounded_fanout' && geography.executedLocations.length) {
            const fanout = await runBoundedGeographyFanoutV35(
              geography,
              async (location, locationLimit) => {
                const activation = await preferTechnicalV2({
                  source: 'stackoverflow',
                  runV2: () => runStackOverflowV2({
                    query: connectorQuery,
                    skills: body.skills,
                    location,
                    limit: locationLimit,
                  }),
                  runFallback: async () => {
                    const response = await searchStackOverflowTalent({
                      query: connectorQuery,
                      limit: locationLimit,
                    })
                    const classified = classifyRealSourceResults(response.results)
                      .filter(result => result.entityKind === 'person')
                    return {
                      results: classified,
                      message: response.warnings.length ? response.warnings.join(' ').slice(0, 240) : undefined,
                    }
                  },
                })
                activations.push(activation)
                return activation.results
              },
              sourceResultKey,
            )
            rawResults = fanout.items
            discoveredByLocation = fanout.discoveredByLocation
          } else {
            const activation = await preferTechnicalV2({
              source: 'stackoverflow',
              runV2: () => runStackOverflowV2({
                query: connectorQuery,
                skills: body.skills,
                limit: Math.min(body.limit, 20),
              }),
              runFallback: async () => {
                const response = await searchStackOverflowTalent({
                  query: connectorQuery,
                  limit: Math.min(body.limit, 20),
                })
                const classified = classifyRealSourceResults(response.results)
                  .filter(result => result.entityKind === 'person')
                return {
                  results: classified,
                  message: response.warnings.length ? response.warnings.join(' ').slice(0, 240) : undefined,
                }
              },
            })
            activations.push(activation)
            rawResults = activation.results
          }

          const classified = classifyRealSourceResults(rawResults)
            .filter(result => result.entityKind === 'person')
          discoveries = classified.map(discoveryFromSourceResult)
          sourceStatus.stackoverflow = {
            status: 'completed',
            discovered: 0,
            engine: activationEngine(activations),
            degraded: activations.some(item => item.degraded),
            message: compactMessage(
              geography.explanation,
              geography.omittedLocations.length ? `${geography.omittedLocations.length} additional approved market${geography.omittedLocations.length === 1 ? '' : 's'} deferred by the per-pass source budget.` : undefined,
              activations.map(item => item.message).filter(Boolean).join(' '),
            ),
            geography: { ...geography, ...(discoveredByLocation ? { discoveredByLocation } : {}) },
          }
        }
      } else if (connector === 'devto') {
        const geography = planGeographyExecutionV35('devto', body.locations, Math.min(body.limit, 8))
        const classified = classifyRealSourceResults(await discoverDevToTalent({
          query: connectorQuery,
          limit: Math.min(body.limit, 8),
        })).filter(result => result.entityKind === 'person')
        discoveries = classified.map(discoveryFromSourceResult)
        sourceStatus.devto = {
          status: 'completed',
          discovered: 0,
          engine: 'native',
          degraded: false,
          message: compactMessage(
            'Public DEV/Forem author discovery; candidate skills are observed article tags only.',
            geography.explanation,
          ),
          geography,
        }
      } else if (connector === 'huggingface') {
        const geography = planGeographyExecutionV35('huggingface', body.locations, Math.min(body.limit, 8))
        const classified = classifyRealSourceResults(await discoverHuggingFacePeople({
          query: connectorQuery,
          limit: Math.min(body.limit, 8),
        })).filter(result => result.entityKind === 'person')
        discoveries = classified.map(discoveryFromSourceResult)
        sourceStatus.huggingface = {
          status: 'completed',
          discovered: 0,
          engine: 'native',
          degraded: false,
          message: compactMessage(
            'Public Hugging Face artifact-owner discovery with explicit public-user resolution; organization owners are excluded.',
            geography.explanation,
          ),
          geography,
        }
      } else if (connector === 'npi') {
        const geography = planGeographyExecutionV35('npi', body.locations, body.limit)
        discoveries = await discoverNpiByTaxonomy({
          taxonomy: connectorQuery,
          locations: geography.executedLocations,
          limit: body.limit,
        })
        sourceStatus.npi = {
          status: 'completed',
          discovered: 0,
          engine: 'native',
          degraded: false,
          message: geography.explanation,
          geography,
        }
      } else {
        const runner = connectorRunners[connector as ConnectorKey]
        if (!runner) {
          sourceStatus[connector] = { status: 'unavailable', discovered: 0, message: 'Connector adapter is not executable on this deployment.', engine: 'native' }
          continue
        }

        const geography = planGeographyExecutionV35('campaign', body.locations, body.limit)
        const input: CampaignInput = {
          name: 'Role agent preview',
          query: connectorQuery,
          connectors: [connector as ConnectorKey],
          targetCompanies: body.targetCompanies,
          locations: geography.executedLocations,
          skills: body.skills,
          dailyLimit: body.limit,
          autoPromoteThreshold: 100,
        }
        const batch = await runner(input, null)
        discoveries = batch.discoveries.map(discovery => ({ ...discovery, sourceKey: connector })) as AgenticDiscovery[]
        sourceStatus[connector] = {
          status: 'completed',
          discovered: 0,
          engine: 'native',
          degraded: false,
          message: geography.explanation,
          geography,
        }
      }

      let added = 0
      for (const discovery of discoveries) {
        const identity = `${discovery.sourceKey}:${discovery.sourceId}`
        if (seen.has(identity)) continue
        seen.add(identity)
        allResults.push(safeDiscovery(discovery))
        added++
      }
      sourceStatus[connector] = {
        ...sourceStatus[connector],
        status: 'completed',
        discovered: added,
      }
    } catch (error) {
      sourceStatus[connector] = {
        status: 'failed',
        discovered: 0,
        degraded: true,
        message: error instanceof Error ? error.message.slice(0, 240) : 'Connector failed.',
      }
    }
  }

  const results = sourceDiverseResults(allResults, body.limit, body.connectors)
  const distribution = sourceDistribution(results)

  return NextResponse.json({
    ok: true,
    execution: 'read_only_preview',
    persisted: false,
    resultCount: results.length,
    discoveredBeforeCap: allResults.length,
    sourceStatus,
    sourceDistribution: distribution,
    orchestration: {
      strategy: 'source_diverse_round_robin',
      requestedSources: body.connectors,
      contributingSources: Object.keys(distribution),
      globalLimit: body.limit,
      note: 'Every selected connector gets an execution opportunity before the global result cap is applied. Source diversity is discovery orchestration, not candidate ranking. Geography execution is source-specific and reported per connector.',
    },
    results,
    trust: {
      message: 'These are public-source discoveries for recruiter review. Nothing is persisted unless the recruiter explicitly saves a save-eligible person to Candidate Graph.',
      externalContent: 'Fetched source content is untrusted data, never instructions to the sourcing agent.',
      registryData: 'Professional-registry records are discovery and evidence inputs only. They do not establish interest, availability, or overall job fit.',
      sourceTruth: 'Search criteria are retrieval intent only. Candidate skills and evidence must be observed in person-level source data.',
      geography: 'Recruiter-approved geography controls retrieval execution where a source supports it. Search-market membership never becomes a candidate residence fact.',
    },
  })
}
