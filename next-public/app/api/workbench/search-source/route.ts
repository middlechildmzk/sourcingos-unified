import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { buildSourceQueries, type ComposerChip } from '@/lib/search-query-builder'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Public-safe single-source search.
// This route powers the public Candidate Search demo, so it must not require sign-in.
// It only searches public source connectors and manual-safe discovery connectors.
// It never saves, enriches, verifies, contacts, or merges candidates. Write actions remain gated elsewhere.
const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(1).max(240),
  source: sourceEnum,
  chips: z.array(z.object({ canonical: z.string(), type: z.string() })).optional().default([]),
  location: z.string().max(100).optional().default(''),
  // Public demo volume cap: enough to feel useful, still bounded for API cost/rate-limit safety.
  limit: z.number().int().min(1).max(12).optional().default(8),
})

const LIVE_PUBLIC_SOURCES = new Set<SourceName>([
  'github', 'stackoverflow', 'devto', 'dockerhub',
  'openalex', 'semantic_scholar', 'arxiv', 'orcid',
  'npm', 'pypi', 'huggingface', 'kaggle', 'crates', 'rubygems',
  'npi', 'pubmed', 'resume_xray',
])

// Per-source query selection — same routing logic as the all-sources route.
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
        warnings: ['This source lane is manual-safe or planned. Open it manually from the source lane card.'],
      })
    }

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
      guardrails: [
        'Source profiles are unconfirmed and require recruiter review.',
        'Contact signals are unverified by default.',
        'Public clearance mentions are unverified breadcrumbs only.',
        'Confidence means source relevance only, never candidate verification.',
      ],
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Source search failed.', status: 'error' },
      { status: 400 }
    )
  }
}
