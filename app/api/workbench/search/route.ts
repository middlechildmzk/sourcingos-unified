import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { buildSourceQueries, classifyChips, recommendSourcesFromChips, type ComposerChip } from '@/lib/search-query-builder'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(1).max(200),
  location: z.string().max(100).optional().default(''),
  chips: z.array(z.object({ canonical: z.string(), type: z.string() })).optional().default([]),
  sources: z.array(sourceEnum).optional(),
  limit: z.number().int().min(1).max(8).optional().default(5),
  projectId: z.string().uuid().optional(),
})

const LIVE_SOURCES: SourceName[] = ['github', 'openalex', 'npm', 'pypi', 'huggingface', 'crates', 'rubygems']

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())
    const chips = body.chips as ComposerChip[]
    const classified = classifyChips(chips)
    const sourceQueries = buildSourceQueries(chips, body.query)

    // Determine which live sources to actually query
    const requestedSources = body.sources?.filter(s => LIVE_SOURCES.includes(s)) ||
      (chips.length > 0 ? recommendSourcesFromChips(chips).filter(s => LIVE_SOURCES.includes(s as SourceName)) as SourceName[] : LIVE_SOURCES.slice(0, 4))

    // Group sources by the query they'd receive (reduces redundant API calls)
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
      crates: sourceQueries.npm,
      rubygems: sourceQueries.npm,
    }

    const results: unknown[] = []
    const warnings: string[] = []
    const searchedSources: string[] = []

    // Group by query to batch identical queries
    const queryGroups: Record<string, SourceName[]> = {}
    for (const source of requestedSources) {
      const q = (sourceQueryMap[source] || body.query).trim()
      if (!q) continue
      if (!queryGroups[q]) queryGroups[q] = []
      queryGroups[q].push(source)
    }

    // Execute searches in parallel
    await Promise.all(
      Object.entries(queryGroups).map(async ([q, sources]) => {
        if (!q.trim()) return
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
          warnings.push(`Search failed for [${sources.join(', ')}]: ${err instanceof Error ? err.message : 'Error'}`)
        }
      })
    )

    // ── Broadening retry when initial search returns no results ────────────────
    let broadResults: unknown[] = []
    let broadQuery = ''
    let usedBroadQuery = false

    if (results.length === 0 && sourceQueries.broadFallback && sourceQueries.broadFallback !== body.query) {
      broadQuery = sourceQueries.broadFallback
      try {
        const { results: br } = await searchSources({
          query: broadQuery,
          sources: ['github', 'openalex'],
          limit: body.limit,
        })
        broadResults = br
        usedBroadQuery = br.length > 0
      } catch { /* ignore broad retry errors */ }
    }

    const finalResults = results.length > 0 ? results : broadResults
    const noResultsSources = requestedSources.filter(s => !searchedSources.includes(s))

    // Clearance guidance
    const hasClearance = classified.manualSafe.some(c => c.type === 'clearance')
    const hasLocation = classified.softFilters.some(c => c.type === 'location')
    const isSkillLight = classified.hardTerms.length === 0

    const suggestions: string[] = []
    if (hasClearance) {
      suggestions.push('Clearance is not visible on GitHub, npm, or OpenAlex. Those sources returned technical skill evidence only. Verify clearance through approved channels (e.g., ClearanceJobs).')
    }
    if (hasLocation && finalResults.length === 0) {
      suggestions.push('Location data is sparse on public technical sources. Try searching without location and use location as a manual review filter.')
    }
    if (isSkillLight && finalResults.length === 0) {
      suggestions.push('Tip: Skill-first searches work better on public sources than title-first searches. Add a specific skill like React, Python, or Kubernetes.')
    }
    if (finalResults.length === 0) {
      suggestions.push('Try the X-Ray Launcher for manual open-web searches that complement live connectors.')
    }

    return NextResponse.json({
      ok: true,
      query: body.query,
      effectiveQueries: sourceQueryMap,
      searchedSources: [...new Set(searchedSources)],
      noResultsSources,
      results: finalResults,
      resultCount: finalResults.length,
      usedBroadQuery,
      broadQuery: usedBroadQuery ? broadQuery : undefined,
      warnings,
      chipContext: {
        hardTerms: classified.hardTerms.map(c => c.canonical),
        softFilters: classified.softFilters.map(c => ({ canonical: c.canonical, type: c.type })),
        manualSafe: classified.manualSafe.map(c => c.canonical),
        hasClearance,
        hasLocation,
        isSkillLight,
      },
      suggestions,
      guardrails: [
        'Source profiles are unconfirmed — recruiter review required before saving.',
        'Contact signals are unverified by default.',
        'Open-to-work is a signal, not a verified claim.',
        'Public clearance mentions are unverified breadcrumbs — never treat as confirmed clearance.',
        'No auto-merge at any confidence level.',
      ],
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Search failed.' }, { status: 400 })
  }
}
