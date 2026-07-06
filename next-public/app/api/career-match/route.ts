import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { parseRecruitingResumeProfile } from '@/lib/career-match/parse-profile'
import { buildJobSearchQuery, rankJobMatches, suggestAdjacentRoles } from '@/lib/career-match/match-engine'
import type { CareerMatchErrorResponse, CareerMatchResponse, CareerPreferences, MatchableJob } from '@/lib/career-match/types'
import { normalizeFamily } from '@/lib/career-match/role-taxonomy'

const requestSchema = z.object({
  resumeText: z.string().min(180).max(60_000),
  preferences: z.object({
    desiredRoleType: z.string().max(80).optional(),
    workMode: z.enum(['any', 'remote', 'hybrid', 'onsite']).optional().default('any'),
    location: z.string().max(120).optional().default(''),
    salaryMin: z.number().int().min(0).max(1_000_000).nullable().optional(),
    salaryMax: z.number().int().min(0).max(1_000_000).nullable().optional(),
    industryFocus: z.string().max(120).optional().default(''),
    openToAdjacentRoles: z.boolean().optional().default(true),
    clearedFederalInterest: z.boolean().optional().default(false),
  }).optional().default({}),
})

type JobsSearchResponse = {
  ok?: boolean
  jobs?: MatchableJob[]
  count?: number
}

function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error } satisfies CareerMatchErrorResponse, { status })
}

function normalizePreferences(raw: z.infer<typeof requestSchema>['preferences']): CareerPreferences {
  const desired = normalizeFamily(raw.desiredRoleType)
  return {
    desiredRoleType: desired || 'any',
    workMode: raw.workMode || 'any',
    location: raw.location || '',
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    industryFocus: raw.industryFocus || '',
    openToAdjacentRoles: raw.openToAdjacentRoles ?? true,
    clearedFederalInterest: raw.clearedFederalInterest ?? false,
  }
}

async function fetchLiveRecruitingJobs(req: NextRequest, query: string, preferences: CareerPreferences): Promise<MatchableJob[]> {
  const url = new URL('/api/jobs/search', req.nextUrl.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '120')
  if (preferences.location) url.searchParams.set('location', preferences.location)
  if (preferences.workMode === 'remote') url.searchParams.set('remoteOnly', 'true')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as JobsSearchResponse
  return Array.isArray(data.jobs) ? data.jobs : []
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'public')
  if (!rl.ok) return rl.response

  let parsedBody: z.infer<typeof requestSchema>
  try {
    const json = await req.json()
    const result = requestSchema.safeParse(json)
    if (!result.success) return jsonError(400, 'invalid_payload', 'Resume text and preferences are required in a valid format.')
    parsedBody = result.data
  } catch {
    return jsonError(400, 'invalid_json', 'Request body must be valid JSON.')
  }

  const profile = parseRecruitingResumeProfile(parsedBody.resumeText)
  const preferences = normalizePreferences(parsedBody.preferences)
  const query = buildJobSearchQuery(profile, preferences)
  const jobs = await fetchLiveRecruitingJobs(req, query, preferences)
  const matches = rankJobMatches(profile, preferences, jobs, 5)
  const adjacentRoles = preferences.openToAdjacentRoles === false ? [] : suggestAdjacentRoles(profile, preferences, 6)

  const { rawText: _rawText, ...safeProfile } = profile

  return NextResponse.json({
    ok: true,
    profile: safeProfile,
    preferences,
    matches,
    adjacentRoles,
    jobCount: jobs.length,
    notes: [
      'This free report uses deterministic parsing and transparent scoring. It does not invent resume facts.',
      'Jobs are pulled from the existing SourcingOS recruiter job search surface and original apply links.',
      'Resume text is not returned in the response. Full PDF/DOCX extraction can be added client-side in the next pass.',
    ],
  } satisfies CareerMatchResponse)
}
