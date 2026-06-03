import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { buildSourceQueries, classifyChips, type ComposerChip } from '@/lib/search-query-builder'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Single-source search — enables the client to run sources in parallel with
// independent timeouts and per-source status. Backward-compatible: the existing
// /api/workbench/search (all-sources) route remains for non-progressive callers.
const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(1).max(200),
  source: sourceEnum,
  chips: z.array(z.object({ canonical: z.string(), type: z.string() })).optional().default([]),
  location: z.string().max(100).optional().default(''),
  limit: z.number().int().min(1).max(8).optional().default(5),
})

// Per-source query selection — same routing logic as the all-sources route.
function queryForSource(source: SourceName, chips: ComposerChip[], rawQuery: string): string {
  const q = buildSourceQueries(chips, rawQuery)
  const map: Record<string, string> = {
    github: q.github, openalex: q.openalex, npm: q.npm, pypi: q.pypi,
    huggingface: q.huggingface, npi: q.npi, pubmed: q.pubmed, orcid: q.orcid,
    stackoverflow: q.stackOverflow, crates: q.npm, rubygems: q.npm,
  }
  return (map[source] || rawQuery).trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const chips = body.chips as ComposerChip[]
    const effectiveQuery = queryForSource(body.source, chips, body.query)

    if (!effectiveQuery) {
      return NextResponse.json({
        ok: true, source: body.source, status: 'no_results',
        results: [], effectiveQuery: '', resultCount: 0,
      })
    }

    const { results, warnings, searchedSources } = await searchSources({
      query: effectiveQuery,
      location: body.location,
      sources: [body.source],
      limit: body.limit,
    })

    const reached = searchedSources.includes(body.source)
    const status = results.length > 0 ? 'found' : (reached ? 'no_results' : 'error')

    return NextResponse.json({
      ok: true,
      source: body.source,
      status,
      effectiveQuery,
      results,
      resultCount: results.length,
      warnings,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Source search failed.', status: 'error' },
      { status: 400 }
    )
  }
}
