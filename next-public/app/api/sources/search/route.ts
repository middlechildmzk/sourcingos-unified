import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildCandidateGraph } from '@/lib/candidate-graph'
import { searchSources } from '@/lib/source-connectors'
import { allSourceNames, SourceName } from '@/lib/source-types'

const sourceEnum = z.enum(allSourceNames as [SourceName, ...SourceName[]])
const schema = z.object({
  query: z.string().min(2).max(120),
  location: z.string().max(80).optional().default(''),
  roleMode: z.string().max(80).optional().default('General Technical'),
  sources: z.array(sourceEnum).optional(),
  limit: z.number().int().min(1).max(8).optional().default(5),
  buildGraph: z.boolean().optional().default(true)
})

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json())
    const { results, warnings, searchedSources } = await searchSources({
      query: body.query,
      location: body.location,
      roleMode: body.roleMode,
      sources: body.sources,
      limit: body.limit
    })
    const candidateGraph = body.buildGraph ? buildCandidateGraph(results) : []
    return NextResponse.json({
      ok: true,
      query: body.query,
      searchedSources,
      results,
      candidateGraph,
      warnings,
      generatedAt: new Date().toISOString(),
      guardrails: [
        'Public source evidence only.',
        'No auto-merge. Recruiter confirms linked profiles.',
        'Contact signals are unverified until manually checked.',
        'NPI is a provider/specialty signal, not outreach permission.',
        'Research/publication sources identify evidence, not employment availability.'
      ]
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Source search failed' }, { status: 400 })
  }
}
