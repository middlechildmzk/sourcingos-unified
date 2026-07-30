import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { z } from 'zod'
import { buildIdentityResolutionDraft } from '@/lib/candidate-graph'
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
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'sources', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())
    const { results, warnings, searchedSources } = await searchSources({
      query: body.canonicalName,
      location: body.location,
      sources: body.sources,
      limit: body.limit
    })
    const draft = buildIdentityResolutionDraft(results)
    return NextResponse.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
      searchedSources,
      results,
      candidateGraph: draft.candidates,
      identityProposals: draft.proposals,
      nonPersonResults: draft.excluded,
      resolverVersion: draft.resolverVersion,
      warnings,
      note: 'Preview refresh route. Name-based re-search returns separate records per source profile. Nothing is linked to an existing candidate without recruiter approval.'
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Refresh failed' }, { status: 400 })
  }
}
