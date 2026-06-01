import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { buildSourceQueries, recommendSourcesFromChips, type ComposerChip } from '@/lib/search-query-builder'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(2).max(200),
  location: z.string().max(100).optional().default(''),
  chips: z.array(z.object({
    canonical: z.string(),
    type: z.string(),
  })).optional().default([]),
  sources: z.array(sourceEnum).optional(),
  limit: z.number().int().min(1).max(8).optional().default(5),
  projectId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const chips = body.chips as ComposerChip[]

    // Build source-specific queries from chips rather than passing one raw query everywhere
    const sourceQueries = buildSourceQueries(chips, body.query)

    // Recommend which sources to search if not explicitly provided
    const sourcesToSearch = body.sources ||
      (chips.length > 0 ? recommendSourcesFromChips(chips) : undefined)

    // Run live connector search, with per-source query optimization
    // For sources that have specific queries, we make separate calls and merge
    const results: unknown[] = []
    const warnings: string[] = []
    const searchedSources: string[] = []

    // Batch sources that can share the raw query vs. sources that need specific queries
    const LIVE_SOURCES: SourceName[] = ['github', 'openalex', 'npm', 'pypi', 'huggingface', 'crates', 'rubygems']
    const activeSources = (sourcesToSearch || LIVE_SOURCES).filter((s): s is SourceName => LIVE_SOURCES.includes(s as SourceName))

    // For each live source, use the appropriate query
    const sourceQueryMap: Record<string, string> = {
      github: sourceQueries.github,
      openalex: sourceQueries.openalex,
      npm: sourceQueries.npm,
      pypi: sourceQueries.pypi,
      huggingface: sourceQueries.huggingface,
      npi: sourceQueries.npi,
      pubmed: sourceQueries.pubmed,
      orcid: sourceQueries.orcid,
      stackoverflow: sourceQueries.stackOverflow,
    }

    // Group sources that share the same query to reduce API calls
    const queryGroups: Record<string, SourceName[]> = {}
    for (const source of activeSources) {
      const q = sourceQueryMap[source] || body.query
      if (!queryGroups[q]) queryGroups[q] = []
      queryGroups[q].push(source)
    }

    // Execute searches in parallel per query group
    await Promise.all(
      Object.entries(queryGroups).map(async ([q, sources]) => {
        try {
          const { results: r, warnings: w, searchedSources: s } = await searchSources({
            query: q,
            location: body.location,
            sources,
            limit: body.limit,
          })
          results.push(...r)
          warnings.push(...w)
          searchedSources.push(...s)
        } catch (err) {
          warnings.push(`Search failed for sources [${sources.join(', ')}]: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      })
    )

    // No-results enrichment
    const noResultsSources = activeSources.filter(s => !searchedSources.includes(s))

    return NextResponse.json({
      ok: true,
      query: body.query,
      sourceSpecificQueries: sourceQueryMap,
      searchedSources: [...new Set(searchedSources)],
      noResultsSources,
      results,
      resultCount: results.length,
      warnings,
      guardrails: [
        'Source profiles are unconfirmed — recruiter review required before saving.',
        'Contact signals are unverified by default.',
        'Open-to-work is a signal, not a verified claim.',
        'Public clearance mentions are unverified breadcrumbs.',
        'No auto-merge at any confidence level.',
      ],
      suggestions: results.length === 0 ? buildNoResultsSuggestions(body.query, chips) : [],
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Search failed.' }, { status: 400 })
  }
}

function buildNoResultsSuggestions(query: string, chips: ComposerChip[]): string[] {
  const suggestions: string[] = [
    'Try broader terms — remove rare certifications or specific company names.',
    'Check spelling of technical terms (e.g., "Kubernetes" not "Kubernates").',
  ]

  if (chips.some(c => c.type === 'location' && c.canonical.toLowerCase() !== 'remote')) {
    suggestions.push('Try adding "remote" to expand beyond geographic constraints.')
  }
  if (chips.some(c => c.type === 'clearance')) {
    suggestions.push('Cleared talent is underrepresented on public sources. Try ClearanceJobs (manual-safe) for cleared searches.')
  }
  if (chips.some(c => c.type === 'title' && c.canonical.includes('Recruiter'))) {
    suggestions.push('Recruiters and sourcers are often not on technical sources. Try LinkedIn X-Ray (manual-safe).')
  }
  if (chips.some(c => c.canonical.toLowerCase() === 'healthcare') || chips.some(c => c.canonical === 'Epic' || c.canonical === 'NPI')) {
    suggestions.push('Healthcare professionals may be found via NPI Registry or LinkedIn X-Ray search.')
  }

  suggestions.push('Use the X-Ray Launcher for manual open-web searches that complement live connectors.')

  return suggestions
}
