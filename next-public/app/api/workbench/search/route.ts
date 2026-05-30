import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'
import { z } from 'zod'

// Thin proxy around /api/sources/search that accepts composer output
// and returns structured results for the workbench results panel.
// No auth required — search is read-only public data.

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(2).max(200),
  location: z.string().max(100).optional().default(''),
  sources: z.array(sourceEnum).optional(),
  limit: z.number().int().min(1).max(8).optional().default(5),
  projectId: z.string().uuid().optional(), // associated project (not required to search)
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())
    const { results, warnings, searchedSources } = await searchSources({
      query: body.query,
      location: body.location,
      sources: body.sources,
      limit: body.limit,
    })

    return NextResponse.json({
      ok: true,
      query: body.query,
      searchedSources,
      results,
      warnings,
      guardrails: [
        'Source profiles are unconfirmed — recruiter review required before saving.',
        'Contact signals are unverified by default.',
        'Open-to-work is a signal, not a verified claim.',
        'Public clearance mentions are unverified breadcrumbs.',
        'No auto-merge at any confidence level.',
      ],
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Search failed.' }, { status: 400 })
  }
}
