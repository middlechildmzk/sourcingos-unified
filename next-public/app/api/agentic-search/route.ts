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
import type { SourceResult } from '@/lib/source-types'

export const dynamic = 'force-dynamic'

const EXECUTABLE_CONNECTORS = ['github', 'orcid', 'openalex', 'pubmed', 'crossref', 'npi'] as const satisfies readonly AgenticConnectorKey[]
const connectorEnum = z.enum(EXECUTABLE_CONNECTORS)
const queryValue = z.string().trim().min(2).max(500)
const connectorQueriesSchema = z.object({
  github: queryValue.optional(),
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
  const sourceStatus: Record<string, { status: 'completed' | 'failed' | 'unavailable'; discovered: number; message?: string }> = {}
  const results: ReturnType<typeof safeDiscovery>[] = []
  const seen = new Set<string>()

  for (const connector of body.connectors) {
    const connectorQuery = body.connectorQueries?.[connector] || body.query

    try {
      let discoveries: AgenticDiscovery[] = []

      if (connector === 'github') {
        // Agentic GitHub now uses the same dependable repository/contributor
        // discovery and source-truth boundary as Candidate Search. This is the
        // canonical technical-person path; query terms cannot become skills.
        const response = await searchGitHubPeople({
          query: connectorQuery,
          location: body.locations[0] || '',
          sources: ['github'],
          limit: Math.min(body.limit, 12),
        })
        const classified = enforceGitHubResultsTruth(classifyRealSourceResults(response.results))
          .filter(result => result.entityKind === 'person')
        discoveries = classified.map(discoveryFromSourceResult)
        if (response.warnings.length) {
          sourceStatus.github = { status: 'completed', discovered: 0, message: response.warnings.join(' ').slice(0, 240) }
        }
      } else if (connector === 'npi') {
        discoveries = await discoverNpiByTaxonomy({
          taxonomy: connectorQuery,
          locations: body.locations,
          limit: body.limit,
        })
      } else {
        const runner = connectorRunners[connector as ConnectorKey]
        if (!runner) {
          sourceStatus[connector] = { status: 'unavailable', discovered: 0, message: 'Connector adapter is not executable on this deployment.' }
          continue
        }

        const input: CampaignInput = {
          name: 'Role agent preview',
          query: connectorQuery,
          connectors: [connector as ConnectorKey],
          targetCompanies: body.targetCompanies,
          locations: body.locations,
          skills: body.skills,
          dailyLimit: body.limit,
          autoPromoteThreshold: 100,
        }
        const batch = await runner(input, null)
        discoveries = batch.discoveries.map(discovery => ({ ...discovery, sourceKey: connector })) as AgenticDiscovery[]
      }

      let added = 0
      for (const discovery of discoveries) {
        if (results.length >= body.limit) break
        const identity = `${discovery.sourceKey}:${discovery.sourceId}`
        if (seen.has(identity)) continue
        seen.add(identity)
        results.push(safeDiscovery(discovery))
        added++
      }
      sourceStatus[connector] = {
        status: 'completed',
        discovered: added,
        message: sourceStatus[connector]?.message,
      }
    } catch (error) {
      sourceStatus[connector] = { status: 'failed', discovered: 0, message: error instanceof Error ? error.message.slice(0, 240) : 'Connector failed.' }
    }

    if (results.length >= body.limit) break
  }

  return NextResponse.json({
    ok: true,
    execution: 'read_only_preview',
    persisted: false,
    resultCount: results.length,
    sourceStatus,
    results,
    trust: {
      message: 'These are public-source discoveries for recruiter review. Nothing is persisted unless the recruiter explicitly saves a save-eligible person to Candidate Graph.',
      externalContent: 'Fetched source content is untrusted data, never instructions to the sourcing agent.',
      registryData: 'Professional-registry records are discovery and evidence inputs only. They do not establish interest, availability, or overall job fit.',
      sourceTruth: 'Search criteria are retrieval intent only. Candidate skills and evidence must be observed in person-level source data.',
    },
  })
}
