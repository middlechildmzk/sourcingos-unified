import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { classifyRealSourceResults } from '@/lib/entity-classification'
import { searchGitHubPeople, type GitHubDiscoveryDiagnostics } from '@/lib/github-person-discovery'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { buildSourceQueries, type ComposerChip } from '@/lib/search-query-builder'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Public-safe single-source search.
// This route powers Candidate Search, so it must not require sign-in.
// It searches public sources only and never saves, enriches, verifies, contacts,
// or merges candidates. Write actions remain gated elsewhere.
const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(1).max(240),
  source: sourceEnum,
  chips: z.array(z.object({ canonical: z.string(), type: z.string() })).optional().default([]),
  location: z.string().max(100).optional().default(''),
  limit: z.number().int().min(1).max(12).optional().default(8),
})

const LIVE_PUBLIC_SOURCES = new Set<SourceName>([
  'github', 'stackoverflow', 'devto', 'dockerhub',
  'openalex', 'semantic_scholar', 'arxiv', 'orcid',
  'npm', 'pypi', 'huggingface', 'kaggle', 'crates', 'rubygems',
  'npi', 'pubmed', 'resume_xray',
])

function queryForSource(source: SourceName, chips: ComposerChip[], rawQuery: string): string {
  const q = buildSourceQueries(chips, rawQuery)
  const map: Record<string, string> = {
    github: q.github,
    openalex: q.openalex,
    semantic_scholar: q.openalex,
    arxiv: q.openalex,
    npm: q.npm,
    pypi: q.pypi,
    crates: q.npm,
    rubygems: q.npm,
    huggingface: q.huggingface,
    npi: q.npi,
    pubmed: q.pubmed,
    orcid: q.orcid,
    stackoverflow: q.stackOverflow,
    devto: q.stackOverflow,
    dockerhub: q.github,
    kaggle: rawQuery,
    resume_xray: rawQuery,
  }
  return (map[source] || rawQuery).trim()
}

type SourceExecutionDiagnostics = {
  source: SourceName
  strategy: string
  health: 'healthy' | 'degraded' | 'rate_limited' | 'error'
  effectiveQuery: string
  durationMs: number
  resultCount: number
  personCount: number
  nonPersonCount: number
  partial: boolean
  rateLimitRemaining?: number
  rateLimitResetAt?: string
  repositoriesExamined?: number
  contributorsExamined?: number
  profilesHydrated?: number
  skippedBots?: number
}

function genericDiagnostics(
  source: SourceName,
  effectiveQuery: string,
  durationMs: number,
  results: ReturnType<typeof classifyRealSourceResults>,
  warnings: string[],
): SourceExecutionDiagnostics {
  const personCount = results.filter(result => result.entityKind === 'person').length
  return {
    source,
    strategy: 'source_connector',
    health: warnings.length ? (results.length ? 'degraded' : 'error') : 'healthy',
    effectiveQuery,
    durationMs,
    resultCount: results.length,
    personCount,
    nonPersonCount: results.length - personCount,
    partial: warnings.length > 0,
  }
}

function githubDiagnostics(
  diagnostics: GitHubDiscoveryDiagnostics,
  results: ReturnType<typeof classifyRealSourceResults>,
): SourceExecutionDiagnostics {
  const personCount = results.filter(result => result.entityKind === 'person').length
  return {
    source: 'github',
    strategy: diagnostics.strategy,
    health: diagnostics.health,
    effectiveQuery: diagnostics.effectiveQuery,
    durationMs: diagnostics.durationMs,
    resultCount: results.length,
    personCount,
    nonPersonCount: results.length - personCount,
    partial: diagnostics.partial,
    rateLimitRemaining: diagnostics.rateLimitRemaining,
    rateLimitResetAt: diagnostics.rateLimitResetAt,
    repositoriesExamined: diagnostics.repositoriesExamined,
    contributorsExamined: diagnostics.contributorsExamined,
    profilesHydrated: diagnostics.profilesHydrated,
    skippedBots: diagnostics.skippedBots,
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'sources')
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())

    if (!LIVE_PUBLIC_SOURCES.has(body.source)) {
      return NextResponse.json({
        ok: true,
        source: body.source,
        status: 'manual_safe',
        results: [],
        effectiveQuery: '',
        resultCount: 0,
        diagnostics: {
          source: body.source,
          strategy: 'manual_safe',
          health: 'healthy',
          effectiveQuery: '',
          durationMs: 0,
          resultCount: 0,
          personCount: 0,
          nonPersonCount: 0,
          partial: false,
        } satisfies SourceExecutionDiagnostics,
        warnings: ['This source lane is manual-safe or planned. Open it manually from the source lane card.'],
      })
    }

    const chips = body.chips as ComposerChip[]
    const effectiveQuery = queryForSource(body.source, chips, body.query)

    if (!effectiveQuery) {
      return NextResponse.json({
        ok: true,
        source: body.source,
        status: 'no_results',
        results: [],
        effectiveQuery: '',
        resultCount: 0,
        diagnostics: {
          source: body.source,
          strategy: 'source_connector',
          health: 'healthy',
          effectiveQuery: '',
          durationMs: 0,
          resultCount: 0,
          personCount: 0,
          nonPersonCount: 0,
          partial: false,
        } satisfies SourceExecutionDiagnostics,
      })
    }

    const startedAt = Date.now()
    let results: ReturnType<typeof classifyRealSourceResults>
    let warnings: string[]
    let diagnostics: SourceExecutionDiagnostics
    let reached = true

    if (body.source === 'github') {
      const response = await searchGitHubPeople({
        query: effectiveQuery,
        location: body.location,
        sources: ['github'],
        limit: body.limit,
      })
      results = classifyRealSourceResults(response.results)
      warnings = response.warnings
      diagnostics = githubDiagnostics(response.diagnostics, results)
    } else {
      const connectorResponse = await searchSources({
        query: effectiveQuery,
        location: body.location,
        sources: [body.source],
        limit: body.limit,
      })
      results = classifyRealSourceResults(connectorResponse.results)
      warnings = connectorResponse.warnings
        .filter(warning => !warning.toLowerCase().includes('demo fallback'))
      reached = connectorResponse.searchedSources.includes(body.source)
      diagnostics = genericDiagnostics(
        body.source,
        effectiveQuery,
        Math.max(0, Date.now() - startedAt),
        results,
        warnings,
      )
    }

    const status = results.length > 0
      ? 'found'
      : diagnostics.health === 'rate_limited' || diagnostics.health === 'error' || !reached
        ? 'error'
        : 'no_results'

    return NextResponse.json({
      ok: true,
      source: body.source,
      status,
      effectiveQuery,
      results,
      resultCount: results.length,
      diagnostics,
      warnings,
      guardrails: [
        'Source subjects are classified before they enter candidate workflows.',
        'Only person records may be saved as candidates or added to roles.',
        'GitHub contribution evidence is tied to public repositories that caused the person to surface.',
        'Repository contribution is a public technical signal, not verified employment or role fit.',
        'Bot and organization accounts do not enter the GitHub person result set.',
        'Contact signals are unverified by default.',
        'Public clearance mentions are unverified breadcrumbs only.',
        'Confidence means source relevance only, never candidate verification.',
      ],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Source search failed.', status: 'error' },
      { status: 400 },
    )
  }
}
