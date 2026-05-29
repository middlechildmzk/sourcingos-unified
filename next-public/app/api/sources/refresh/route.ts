import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildCandidateGraph } from '@/lib/candidate-graph'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  canonicalName: z.string().min(2).max(120),
  location: z.string().max(80).optional().default(''),
  sources: z.array(sourceEnum).optional(),
  limit: z.number().int().min(1).max(8).optional().default(4)
})

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json())
    const { results, warnings, searchedSources } = await searchSources({
      query: body.canonicalName,
      location: body.location,
      sources: body.sources,
      limit: body.limit
    })
    return NextResponse.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
      searchedSources,
      results,
      candidateGraph: buildCandidateGraph(results),
      warnings,
      note: 'Preview refresh route. V17.2 adds a persistent candidate graph adapter and scheduled-refresh scaffold for cron or queue workers.'
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Refresh failed' }, { status: 400 })
  }
}
