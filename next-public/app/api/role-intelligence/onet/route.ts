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

const ONET_DATA_ORIGIN = 'https://www.onetcenter.org'
const ONET_DATA_ROOT = '/dl_files/database/db_31_0_json'
const ATTRIBUTION = 'O*NET® is a trademark of the U.S. Department of Labor, Employment and Training Administration. O*NET 31.0 Database data is used under the Creative Commons Attribution 4.0 International license.'
const CACHE_SECONDS = 60 * 60 * 24 * 7

type Dataset<T> = { row?: T[] }
type OccupationRow = { onetsoc_code?: string; title?: string; description?: string }
type ReportedTitleRow = { onetsoc_code?: string; title?: string; reported_job_title?: string; shown_in_my_next_move?: string }
type RelatedRow = { onetsoc_code?: string; related_onetsoc_code?: string; related_title?: string; relatedness_tier?: string; related_index?: number | string }
type SoftwareSkillRow = { onetsoc_code?: string; workplace_example?: string; hot_technology?: string; in_demand?: string }

type MatchCandidate = { code: string; title: string; score: number }

function text(value: unknown, max = 150): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function uniq(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => text(value)).filter(Boolean))).slice(0, max)
}

function normalized(value: string): string {
  return text(value, 250)
    .toLowerCase()
    .replace(/\b(?:senior|sr|junior|jr|principal|staff|lead)\.?\b/g, ' ')
    .replace(/[^a-z0-9+#./ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalized(value).split(' ').filter(token => token.length > 1 && !['and', 'the', 'of', 'for'].includes(token))
}

function titleSimilarity(query: string, candidate: string): number {
  const q = normalized(query)
  const c = normalized(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.includes(q) || q.includes(c)) return 0.88

  const qTokens = new Set(tokens(q))
  const cTokens = new Set(tokens(c))
  if (!qTokens.size || !cTokens.size) return 0
  let intersection = 0
  for (const token of qTokens) if (cTokens.has(token)) intersection++
  const recall = intersection / qTokens.size
  const precision = intersection / cTokens.size
  return recall * 0.7 + precision * 0.3
}

async function datasetJson<T>(file: string): Promise<Dataset<T>> {
  if (!/^[a-z0-9_]+\.json$/.test(file)) throw new Error('Unsupported O*NET data file.')
  const url = `${ONET_DATA_ORIGIN}${ONET_DATA_ROOT}/${file}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 role-intelligence' },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`O*NET dataset returned ${response.status}.`)
  return response.json() as Promise<Dataset<T>>
}

function bestOccupation(title: string, occupations: OccupationRow[], reportedTitles: ReportedTitleRow[]): MatchCandidate | null {
  const bestByCode = new Map<string, MatchCandidate>()
  const consider = (codeValue: unknown, canonicalValue: unknown, aliasValue: unknown, boost = 0) => {
    const code = text(codeValue, 20)
    const canonical = text(canonicalValue)
    const alias = text(aliasValue)
    if (!code || !canonical || !alias) return
    const score = Math.min(1, titleSimilarity(title, alias) + boost)
    const previous = bestByCode.get(code)
    if (!previous || score > previous.score) bestByCode.set(code, { code, title: canonical, score })
  }

  for (const row of occupations) consider(row.onetsoc_code, row.title, row.title, 0.03)
  for (const row of reportedTitles) consider(row.onetsoc_code, row.title, row.reported_job_title, row.shown_in_my_next_move === 'Y' ? 0.02 : 0)

  const best = [...bestByCode.values()].sort((a, b) => b.score - a.score)[0]
  return best && best.score >= 0.46 ? best : null
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid role-intelligence request.' }, { status: 400 })

  try {
    // Only the normalized role title is used to select records from the public,
    // downloadable O*NET database. Full job descriptions, employer notes,
    // candidate data, and recruiter data are never sent to O*NET.
    const [occupationData, reportedData] = await Promise.all([
      datasetJson<OccupationRow>('occupation_data.json'),
      datasetJson<ReportedTitleRow>('sample_of_reported_titles.json'),
    ])
    const occupations = occupationData.row || []
    const reportedTitles = reportedData.row || []
    const match = bestOccupation(parsed.data.title, occupations, reportedTitles)

    if (!match) {
      const intelligence: OnetRoleIntelligence = {
        ...emptyOnetRoleIntelligence(),
        configured: true,
        error: 'No sufficiently close O*NET occupation match was found for this role title.',
      }
      return NextResponse.json({ ok: true, intelligence })
    }

    const [relatedData, softwareData] = await Promise.all([
      datasetJson<RelatedRow>('related_occupations.json'),
      datasetJson<SoftwareSkillRow>('software_skills.json'),
    ])

    const reportedForOccupation = reportedTitles
      .filter(row => text(row.onetsoc_code, 20) === match.code)
      .sort((a, b) => Number(b.shown_in_my_next_move === 'Y') - Number(a.shown_in_my_next_move === 'Y'))

    const relatedOccupations = (relatedData.row || [])
      .filter(row => text(row.onetsoc_code, 20) === match.code)
      .sort((a, b) => Number(a.related_index || 999) - Number(b.related_index || 999))
      .map(row => ({ code: text(row.related_onetsoc_code, 20), title: text(row.related_title) }))
      .filter(item => item.code && item.title)
      .slice(0, 10)

    const softwareForOccupation = (softwareData.row || [])
      .filter(row => text(row.onetsoc_code, 20) === match.code)
      .sort((a, b) => {
        const rank = (row: SoftwareSkillRow) => Number(row.hot_technology === 'Y') * 2 + Number(row.in_demand === 'Y')
        return rank(b) - rank(a)
      })

    const intelligence: OnetRoleIntelligence = {
      provider: 'onet',
      version: '31.0',
      configured: true,
      matchedOccupation: { code: match.code, title: match.title },
      reportedTitles: uniq(reportedForOccupation.map(row => text(row.reported_job_title)), 10),
      relatedOccupations,
      technologyExamples: uniq(softwareForOccupation.map(row => text(row.workplace_example)), 16),
      attribution: ATTRIBUTION,
    }

    return NextResponse.json({ ok: true, intelligence })
  } catch (error) {
    const intelligence: OnetRoleIntelligence = {
      ...emptyOnetRoleIntelligence(),
      configured: false,
      error: error instanceof Error ? error.message.slice(0, 240) : 'O*NET dataset enrichment failed.',
    }
    return NextResponse.json({ ok: true, intelligence })
  }
}
