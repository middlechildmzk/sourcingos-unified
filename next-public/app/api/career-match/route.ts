import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { parseRecruitingResumeProfile } from '@/lib/career-match/parse-profile'
import {
  buildCareerMatchQueries,
  buildRoleUniverse,
  dedupeMatchableJobs,
  groupJobMatches,
  rankJobMatches,
  suggestAdjacentRoles,
} from '@/lib/career-match/match-engine'
import { extractResumeTextFromUpload } from '@/lib/career-match/extract-upload'
import type { CareerMatchErrorResponse, CareerMatchResponse, CareerPreferences, MatchableJob } from '@/lib/career-match/types'
import { normalizeFamily } from '@/lib/career-match/role-taxonomy'

export const runtime = 'nodejs'

const preferencesSchema = z.object({
  desiredRoleType: z.string().max(80).optional(),
  workMode: z.enum(['any', 'remote', 'hybrid', 'onsite']).optional().default('any'),
  location: z.string().max(120).optional().default(''),
  salaryMin: z.number().int().min(0).max(1_000_000).nullable().optional(),
  salaryMax: z.number().int().min(0).max(1_000_000).nullable().optional(),
  industryFocus: z.string().max(120).optional().default(''),
  openToAdjacentRoles: z.boolean().optional().default(true),
  clearedFederalInterest: z.boolean().optional().default(false),
})

const requestSchema = z.object({
  resumeText: z.string().min(180).max(80_000),
  preferences: preferencesSchema.optional().default({}),
})

type IncomingCareerMatchRequest = {
  resumeText: string
  preferences: z.infer<typeof preferencesSchema>
  uploadNotes: string[]
}

type JobsSearchResponse = {
  ok?: boolean
  jobs?: MatchableJob[]
  count?: number
}

function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ ok: false, code, error } satisfies CareerMatchErrorResponse, { status })
}

function normalizePreferences(raw: z.infer<typeof preferencesSchema>): CareerPreferences {
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

function parsePreferencesFromForm(value: FormDataEntryValue | null): z.infer<typeof preferencesSchema> {
  if (typeof value !== 'string' || !value.trim()) return preferencesSchema.parse({})
  const parsed = JSON.parse(value)
  return preferencesSchema.parse(parsed)
}

async function parseIncomingRequest(req: NextRequest): Promise<IncomingCareerMatchRequest> {
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const preferences = parsePreferencesFromForm(form.get('preferences'))
    const resumeTextValue = form.get('resumeText')
    const pastedText = typeof resumeTextValue === 'string' ? resumeTextValue.trim() : ''
    const fileValue = form.get('resumeFile')

    if (fileValue && typeof fileValue !== 'string' && fileValue.size > 0) {
      const extraction = await extractResumeTextFromUpload(fileValue)
      return {
        resumeText: extraction.text,
        preferences,
        uploadNotes: [`Uploaded file: ${extraction.sourceName}`, ...extraction.notes],
      }
    }

    const result = requestSchema.safeParse({ resumeText: pastedText, preferences })
    if (!result.success) throw new Error('Resume text or a supported resume file is required.')
    return { resumeText: result.data.resumeText, preferences: result.data.preferences, uploadNotes: ['Pasted resume text parsed.'] }
  }

  const json = await req.json()
  const result = requestSchema.safeParse(json)
  if (!result.success) throw new Error('Resume text and preferences are required in a valid format.')
  return { resumeText: result.data.resumeText, preferences: result.data.preferences, uploadNotes: ['Pasted resume text parsed.'] }
}

async function fetchLiveRecruitingJobs(req: NextRequest, query: string, preferences: CareerPreferences, relaxLocation = false): Promise<MatchableJob[]> {
  const url = new URL('/api/jobs/search', req.nextUrl.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '120')
  if (!relaxLocation && preferences.location) url.searchParams.set('location', preferences.location)
  if (!relaxLocation && preferences.workMode === 'remote') url.searchParams.set('remoteOnly', 'true')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as JobsSearchResponse
  return Array.isArray(data.jobs) ? data.jobs : []
}

async function fetchJobsForQueries(req: NextRequest, queries: string[], preferences: CareerPreferences, relaxLocation = false): Promise<MatchableJob[]> {
  const allJobs: MatchableJob[] = []
  const batchSize = 6
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(query => fetchLiveRecruitingJobs(req, query, preferences, relaxLocation)))
    allJobs.push(...results.flat())
  }
  return allJobs
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'public')
  if (!rl.ok) return rl.response

  let incoming: IncomingCareerMatchRequest
  try {
    incoming = await parseIncomingRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resume text and preferences are required in a valid format.'
    return jsonError(400, 'invalid_payload', message)
  }

  const profile = parseRecruitingResumeProfile(incoming.resumeText)
  const preferences = normalizePreferences(incoming.preferences)

  let rescueTierUsed: 0 | 1 | 2 = 0
  let queries = buildCareerMatchQueries(profile, preferences, 0)
  let rawJobs = await fetchJobsForQueries(req, queries, preferences, false)
  let dedupedJobs = dedupeMatchableJobs(rawJobs)

  if (dedupedJobs.length < 15) {
    rescueTierUsed = 1
    const tierOneQueries = buildCareerMatchQueries(profile, preferences, 1).filter(query => !queries.includes(query))
    rawJobs = [...rawJobs, ...(await fetchJobsForQueries(req, tierOneQueries, preferences, preferences.workMode === 'remote'))]
    queries = [...queries, ...tierOneQueries]
    dedupedJobs = dedupeMatchableJobs(rawJobs)
  }

  if (dedupedJobs.length < 30) {
    rescueTierUsed = 2
    const tierTwoQueries = buildCareerMatchQueries(profile, preferences, 2).filter(query => !queries.includes(query))
    rawJobs = [...rawJobs, ...(await fetchJobsForQueries(req, tierTwoQueries, preferences, true))]
    queries = [...queries, ...tierTwoQueries]
    dedupedJobs = dedupeMatchableJobs(rawJobs)
  }

  const rankedMatches = rankJobMatches(profile, preferences, dedupedJobs, 25)
  const visibleMatches = rankedMatches.slice(0, 10)
  const matchGroups = groupJobMatches(rankedMatches, profile)
  const adjacentRoles = preferences.openToAdjacentRoles === false ? [] : suggestAdjacentRoles(profile, preferences, 6)
  const roleUniverse = buildRoleUniverse(profile, preferences, rankedMatches, queries)

  const { rawText: _rawText, ...safeProfile } = profile

  return NextResponse.json({
    ok: true,
    profile: safeProfile,
    preferences,
    matches: visibleMatches,
    matchGroups,
    adjacentRoles,
    roleUniverse,
    jobCount: dedupedJobs.length,
    debug: {
      queriesRun: queries,
      rawJobsFound: rawJobs.length,
      dedupedJobs: dedupedJobs.length,
      scoredJobs: rankedMatches.length,
      shownJobs: rankedMatches.length,
      rescueTierUsed,
    },
    notes: [
      'This free report uses deterministic parsing and transparent scoring. It does not invent resume facts.',
      'V1.1 runs multi-query fan-out and low-result rescue across recruiter, sourcer, TA, ops, intelligence, RPO, and cleared lanes.',
      'Jobs are pulled from the existing SourcingOS recruiter job search surface and original apply links.',
      'Resume text and uploaded files are processed for this request only and raw resume text is not returned in the response.',
      ...incoming.uploadNotes,
    ],
  } satisfies CareerMatchResponse)
}
