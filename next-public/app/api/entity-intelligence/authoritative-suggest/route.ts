import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import {
  rankOnetTitleSuggestionsV36_4,
  sanitizeAuthoritativeTitleQueryV36_4,
  type OnetJobTitleRowV36_4,
  type OnetOccupationRowV36_4,
} from '@/lib/entity-intelligence/onet-title-search-v36-4'
import {
  fetchOnetDatasetV36_4,
  ONET_ATTRIBUTION_V36_4,
  ONET_VERSION_V36_4,
} from '@/lib/onet-datasets-v36-4'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  q: z.string().trim().min(3).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = requestSchema.safeParse({
    q: req.nextUrl.searchParams.get('q') || '',
    limit: req.nextUrl.searchParams.get('limit') || '10',
  })
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid authoritative-suggestion request.' }, { status: 400 })
  }

  const query = sanitizeAuthoritativeTitleQueryV36_4(parsed.data.q)
  if (!query) {
    return NextResponse.json({
      ok: true,
      suggestions: [],
      source: 'onet',
      sourceVersion: ONET_VERSION_V36_4,
      searchOnly: true,
      note: 'Verification-only or ambiguous terms are not sent to O*NET title search.',
    })
  }

  try {
    const [occupations, jobTitles] = await Promise.all([
      fetchOnetDatasetV36_4<OnetOccupationRowV36_4>('occupation_data.json'),
      fetchOnetDatasetV36_4<OnetJobTitleRowV36_4>('job_titles.json'),
    ])
    const suggestions = rankOnetTitleSuggestionsV36_4({
      query,
      occupations: occupations.row || [],
      jobTitles: jobTitles.row || [],
      limit: parsed.data.limit,
    })

    return NextResponse.json({
      ok: true,
      suggestions,
      source: 'onet',
      sourceVersion: ONET_VERSION_V36_4,
      searchOnly: true,
      attribution: ONET_ATTRIBUTION_V36_4,
      note: 'O*NET suggestions broaden recruiter title vocabulary. They are not candidate evidence and do not mutate role requirements.',
    })
  } catch (error) {
    // Authoritative enrichment is additive. Local reviewed RIG suggestions remain
    // usable if O*NET is temporarily unavailable.
    return NextResponse.json({
      ok: true,
      suggestions: [],
      source: 'onet',
      sourceVersion: ONET_VERSION_V36_4,
      searchOnly: true,
      degraded: true,
      error: error instanceof Error ? error.message.slice(0, 240) : 'O*NET authoritative suggestions unavailable.',
    })
  }
}
