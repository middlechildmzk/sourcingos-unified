import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { emptyOnetRoleIntelligence, type OnetRoleIntelligence } from '@/lib/onet-role-intelligence'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  title: z.string().trim().min(2).max(120),
})

const ONET_ORIGIN = 'https://api-v2.onetcenter.org'
const ATTRIBUTION = 'O*NET® is a trademark of the U.S. Department of Labor, Employment and Training Administration. O*NET data is used under its applicable Creative Commons license.'

type OccupationRef = { code?: string; title?: string }
type SearchResponse = { occupation?: OccupationRef[] }
type OccupationResponse = { code?: string; title?: string; sample_of_reported_titles?: unknown[] }
type RelatedResponse = { occupation?: Array<OccupationRef & { supplemental?: boolean }> }
type TechnologyResponse = { category?: Array<{ example?: Array<{ title?: string }>; example_more?: Array<{ title?: string }> }> }

function text(value: unknown, max = 150): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function uniq(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, max)
}

async function onetJson<T>(path: string, apiKey: string): Promise<T> {
  if (!path.startsWith('/online/')) throw new Error('Unsupported O*NET path.')
  const response = await fetch(`${ONET_ORIGIN}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json', 'x-api-key': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`O*NET returned ${response.status}.`)
  return response.json() as Promise<T>
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid role-intelligence request.' }, { status: 400 })

  const apiKey = process.env.ONET_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      intelligence: emptyOnetRoleIntelligence('O*NET enrichment is ready but ONET_API_KEY is not configured on this deployment.'),
    })
  }

  try {
    // Send only the role title. Full job descriptions, employer notes, candidate
    // data, and recruiter data are never sent to O*NET by this endpoint.
    const search = await onetJson<SearchResponse>(`/online/search?keyword=${encodeURIComponent(parsed.data.title)}&start=1&end=5`, apiKey)
    const first = search.occupation?.find(item => text(item.code) && text(item.title))
    if (!first?.code || !first.title) {
      const intelligence: OnetRoleIntelligence = {
        ...emptyOnetRoleIntelligence(),
        configured: true,
        error: 'No O*NET occupation match was returned for this role title.',
      }
      return NextResponse.json({ ok: true, intelligence })
    }

    const code = encodeURIComponent(first.code)
    const [overview, related, technology] = await Promise.all([
      onetJson<OccupationResponse>(`/online/occupations/${code}/`, apiKey),
      onetJson<RelatedResponse>(`/online/occupations/${code}/summary/related_occupations?start=1&end=10`, apiKey),
      onetJson<TechnologyResponse>(`/online/occupations/${code}/details/technology_skills?start=1&end=10`, apiKey),
    ])

    const reportedTitles = uniq((overview.sample_of_reported_titles || []).map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'title' in item) return text((item as { title?: unknown }).title)
      return ''
    }), 10)

    const relatedOccupations = (related.occupation || []).map(item => ({
      code: text(item.code, 20),
      title: text(item.title),
    })).filter(item => item.code && item.title).slice(0, 10)

    const technologyExamples = uniq((technology.category || []).flatMap(category => [
      ...(category.example || []),
      ...(category.example_more || []),
    ]).map(item => text(item.title)), 16)

    const intelligence: OnetRoleIntelligence = {
      provider: 'onet',
      version: '31.0',
      configured: true,
      matchedOccupation: { code: text(overview.code || first.code, 20), title: text(overview.title || first.title) },
      reportedTitles,
      relatedOccupations,
      technologyExamples,
      attribution: ATTRIBUTION,
    }

    return NextResponse.json({ ok: true, intelligence })
  } catch (error) {
    const intelligence: OnetRoleIntelligence = {
      ...emptyOnetRoleIntelligence(),
      configured: true,
      error: error instanceof Error ? error.message.slice(0, 240) : 'O*NET enrichment failed.',
    }
    return NextResponse.json({ ok: true, intelligence })
  }
}
