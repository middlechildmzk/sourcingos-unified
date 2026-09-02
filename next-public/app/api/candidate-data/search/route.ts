import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { executableCandidateSearchProvidersV36_8 } from '@/lib/candidate-data/provider-registry-v36-8'
import { runCandidateDataSearchV36_8 } from '@/lib/candidate-data/orchestrator-v36-8'
import { searchPearchV36_8 } from '@/lib/candidate-data/providers/pearch-v36-8'
import { searchDataVertexV36_8 } from '@/lib/candidate-data/providers/data-vertex-v36-8'
import type { CandidateDataSearchAdapterV36_8, CandidateDataProviderV36_8 } from '@/lib/candidate-data/types-v36-8'

export const dynamic = 'force-dynamic'

const providerEnum = z.enum(['pearch', 'people_data_labs', 'coresignal', 'data_vertex', 'contactout'])
const bodySchema = z.object({
  query: z.string().trim().min(2).max(3000),
  requirements: z.array(z.object({ text: z.string().trim().min(1).max(300), mustHave: z.boolean() })).max(30).optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(100000).default(0),
  providerPersonBlacklist: z.array(z.string().trim().min(1).max(200)).max(1000).optional(),
  providers: z.array(providerEnum).max(5).optional(),
  highFreshness: z.boolean().default(false),
}).strict()

function adapter(provider: CandidateDataProviderV36_8): CandidateDataSearchAdapterV36_8 | undefined {
  if (provider === 'pearch') return { provider, search: searchPearchV36_8 }
  if (provider === 'data_vertex') return { provider, search: searchDataVertexV36_8 }
  return undefined
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid candidate-data search request.', details: parsed.error.flatten() }, { status: 400 })

  const configured = executableCandidateSearchProvidersV36_8()
  const requested = new Set(parsed.data.providers || configured.map(item => item.provider))
  const adapters = configured
    .filter(item => requested.has(item.provider))
    .map(item => adapter(item.provider))
    .filter(Boolean) as CandidateDataSearchAdapterV36_8[]

  if (!adapters.length) {
    return NextResponse.json({
      ok: false,
      code: 'candidate_provider_not_configured',
      error: 'No executable candidate-search provider is configured for this request.',
      providerStatus: configured,
    }, { status: 503 })
  }

  const result = await runCandidateDataSearchV36_8({
    query: parsed.data.query,
    requirements: parsed.data.requirements,
    locations: parsed.data.locations,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    providerPersonBlacklist: parsed.data.providerPersonBlacklist,
    highFreshness: parsed.data.highFreshness,
    revealContact: false,
  }, adapters, parsed.data.limit)

  return NextResponse.json({
    ok: true,
    observations: result.observations,
    telemetry: result.telemetry,
    providerMix: result.providerMix,
    warnings: result.warnings,
    trust: {
      providerObservationsAreCandidateFacts: false,
      providerScoresAreQualificationScores: false,
      contactRevealDuringSearch: false,
      identityMergePerformed: false,
      recruiterDecisionPerformed: false,
    },
  })
}
