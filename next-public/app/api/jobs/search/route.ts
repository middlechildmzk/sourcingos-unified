import { NextRequest, NextResponse } from 'next/server'
import { atsTargets } from '@/data/ats-targets'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { dedupeJobs, fetchAshbyJobs, fetchGreenhouseJobs, fetchLeverJobs, isRecruitingRole, cleanText, inferCategory, inferRemoteType, NormalizedJob } from '@/lib/jobs-ingestion'
import { fetchPersistedJobs, jobMatches } from '@/lib/jobs-v2'
import { sourceLabelsFor } from '@/lib/job-source-registry'

type LiveJob = NormalizedJob

function toBool(value: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function salaryRange(min: unknown, max: unknown, period?: unknown, currency = '$') {
  const low = Number(min)
  const high = Number(max)
  if (!Number.isFinite(low) && !Number.isFinite(high)) return 'Not listed'
  const suffix = String(period || '').toUpperCase() === 'HOUR' ? '/hr' : String(period || '').toUpperCase() === 'MONTH' ? '/mo' : '/yr'
  const format = (value: number) => `${currency}${Math.round(value).toLocaleString('en-US')}`
  if (Number.isFinite(low) && Number.isFinite(high)) return `${format(low)}-${format(high)}${suffix}`
  return `${format(Number.isFinite(low) ? low : high)}${suffix}`
}

async function fetchRemotive(query: string): Promise<LiveJob[]> {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query || 'recruiter')}`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    return (json.jobs || []).filter((j: any) => isRecruitingRole(j.title, j.description)).slice(0, 25).map((j: any) => ({
      id: `remotive-${j.id}`,
      title: cleanText(j.title, 160),
      company: cleanText(j.company_name, 120),
      location: cleanText(j.candidate_required_location || 'Remote', 120),
      remoteType: 'Remote',
      employmentType: cleanText(j.job_type || 'Remote', 120),
      salaryRange: cleanText(j.salary || 'Not listed', 120),
      source: 'Remotive',
      sourceType: 'remotive',
      sourceId: String(j.id),
      applyUrl: j.url,
      sourceUrl: j.url,
      postedDate: cleanText(j.publication_date || '', 80),
      lastCheckedAt: new Date().toISOString(),
      description: cleanText(j.description, 360),
      tags: Array.from(new Set([...(j.tags || []).slice(0, 4).map((t: any) => cleanText(t, 40)), 'remote job feed', 'source: Remotive'])),
      category: 'recruiter'
    }))
  } catch { return [] }
}

async function fetchArbeitnow(query: string): Promise<LiveJob[]> {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    const q = (query || '').toLowerCase()
    return (json.data || []).filter((j: any) => {
      const text = `${j.title} ${(j.tags || []).join(' ')}`.toLowerCase()
      return isRecruitingRole(j.title, j.description) && (!q || text.includes(q) || q.split(/\s+/).some((part: string) => text.includes(part)))
    }).slice(0, 25).map((j: any) => ({
      id: `arbeitnow-${j.slug}`,
      title: cleanText(j.title, 160),
      company: cleanText(j.company_name, 120),
      location: cleanText(j.location || 'Remote/varies', 120),
      remoteType: j.remote ? 'Remote' : 'Hybrid/Onsite',
      employmentType: 'Full-time',
      salaryRange: 'Not listed',
      source: 'Arbeitnow',
      sourceType: 'arbeitnow',
      sourceId: String(j.slug),
      applyUrl: j.url,
      sourceUrl: j.url,
      postedDate: j.created_at ? new Date(j.created_at * 1000).toISOString() : '',
      lastCheckedAt: new Date().toISOString(),
      description: cleanText(j.description, 360),
      tags: Array.from(new Set([...(j.tags || []).slice(0, 4).map((t: any) => cleanText(t, 40)), 'public job feed'])),
      category: 'recruiter'
    }))
  } catch { return [] }
}

async function fetchUsaJobs(query: string, location: string): Promise<LiveJob[]> {
  const key = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT
  if (!key || !userAgent) return []
  try {
    const url = new URL('https://data.usajobs.gov/api/search')
    url.searchParams.set('Keyword', query || 'recruiter')
    if (location) url.searchParams.set('LocationName', location)
    url.searchParams.set('ResultsPerPage', '25')
    const res = await fetch(url, { headers: { 'Authorization-Key': key, 'User-Agent': userAgent, Host: 'data.usajobs.gov' }, next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    const items = json.SearchResult?.SearchResultItems || []
    return items.filter((it: any) => isRecruitingRole(it.MatchedObjectDescriptor?.PositionTitle, it.MatchedObjectDescriptor?.UserArea?.Details?.JobSummary)).map((it: any) => {
      const d = it.MatchedObjectDescriptor
      const salary = d.PositionRemuneration?.[0] ? `${d.PositionRemuneration[0].MinimumRange}-${d.PositionRemuneration[0].MaximumRange}` : 'Not listed'
      return {
        id: `usajobs-${d.PositionID}`,
        title: cleanText(d.PositionTitle, 160),
        company: cleanText(d.OrganizationName || d.DepartmentName, 120),
        location: cleanText((d.PositionLocation || []).map((l: any) => l.LocationName).join(', '), 160),
        remoteType: 'Federal',
        employmentType: cleanText((d.PositionSchedule || [])[0]?.Name || 'Federal', 120),
        salaryRange: salary,
        source: 'USAJOBS',
        sourceType: 'usajobs',
        sourceId: String(d.PositionID),
        applyUrl: d.PositionURI,
        sourceUrl: d.PositionURI,
        postedDate: cleanText(d.PublicationStartDate, 80),
        lastCheckedAt: new Date().toISOString(),
        description: cleanText(d.UserArea?.Details?.JobSummary, 360),
        tags: ['Federal', 'USAJOBS', 'GovCon-adjacent'],
        category: 'govcon-recruiter'
      } satisfies LiveJob
    })
  } catch { return [] }
}

async function fetchAdzuna(query: string, location: string): Promise<LiveJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []
  try {
    const url = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1')
    url.searchParams.set('app_id', appId)
    url.searchParams.set('app_key', appKey)
    url.searchParams.set('results_per_page', '50')
    url.searchParams.set('content-type', 'application/json')
    url.searchParams.set('what_or', query || 'recruiter sourcer talent acquisition recruiting')
    if (location) url.searchParams.set('where', location)
    const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    return (Array.isArray(json.results) ? json.results : [])
      .filter((job: any) => isRecruitingRole(job.title, job.description))
      .map((job: any) => {
        const title = cleanText(job.title, 160)
        const body = cleanText(job.description, 360)
        const place = cleanText(job.location?.display_name || (job.location?.area || []).join(', ') || 'Location not listed', 160)
        const salary = salaryRange(job.salary_min, job.salary_max, 'YEAR')
        return {
          id: `adzuna-${job.id}`,
          title,
          company: cleanText(job.company?.display_name || 'Company not listed', 120),
          location: place,
          remoteType: inferRemoteType(`${place} ${body}`),
          employmentType: cleanText([job.contract_time, job.contract_type].filter(Boolean).join(' · ') || 'Not listed', 120),
          salaryRange: salary === 'Not listed' ? salary : `${salary}${job.salary_is_predicted ? ' est.' : ''}`,
          source: 'Adzuna',
          sourceType: 'adzuna',
          sourceId: String(job.id),
          applyUrl: job.redirect_url,
          sourceUrl: job.redirect_url,
          postedDate: cleanText(job.created || '', 80),
          lastCheckedAt: new Date().toISOString(),
          description: body,
          tags: Array.from(new Set([inferCategory(title, body), cleanText(job.category?.label || '', 60), 'Jobs by Adzuna'].filter(Boolean))),
          category: inferCategory(title, body),
        } satisfies LiveJob
      })
  } catch { return [] }
}

async function fetchOpenWebNinja(query: string, location: string, remoteOnly: boolean): Promise<LiveJob[]> {
  const key = process.env.OPENWEBNINJA_API_KEY
  if (!key) return []
  try {
    const url = new URL('https://api.openwebninja.com/jsearch/search-v2')
    const locationPart = location ? ` in ${location}` : ' in United States'
    url.searchParams.set('query', `${query || 'recruiter sourcer talent acquisition'}${locationPart}`)
    url.searchParams.set('country', 'us')
    url.searchParams.set('language', 'en')
    if (remoteOnly) url.searchParams.set('work_from_home', 'true')
    const res = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' }, next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    const data = Array.isArray(json.data) ? json.data : Array.isArray(json.data?.jobs) ? json.data.jobs : Array.isArray(json.jobs) ? json.jobs : []
    return data.filter((job: any) => isRecruitingRole(job.job_title, job.job_description)).slice(0, 50).map((job: any) => {
      const title = cleanText(job.job_title, 160)
      const body = cleanText(job.job_description || Object.values(job.job_highlights || {}).flat().join(' '), 360)
      const place = cleanText(job.job_location || [job.job_city, job.job_state].filter(Boolean).join(', ') || 'Location not listed', 160)
      const applyUrl = job.job_apply_link || job.apply_options?.find((option: any) => option?.is_direct)?.apply_link || job.apply_options?.[0]?.apply_link || job.job_google_link
      return {
        id: `openwebninja-${job.job_id}`,
        title,
        company: cleanText(job.employer_name || 'Company not listed', 120),
        location: place,
        remoteType: job.job_is_remote === true ? 'Remote' : inferRemoteType(`${place} ${body}`),
        employmentType: cleanText(job.job_employment_type || (job.job_employment_types || []).join(', ') || 'Not listed', 120),
        salaryRange: salaryRange(job.job_min_salary, job.job_max_salary, job.job_salary_period),
        source: 'OpenWebNinja',
        sourceType: 'openwebninja',
        sourceId: String(job.job_id),
        applyUrl,
        sourceUrl: job.job_google_link || applyUrl,
        postedDate: cleanText(job.job_posted_at_datetime_utc || job.job_posted_at || '', 80),
        lastCheckedAt: new Date().toISOString(),
        description: body,
        tags: Array.from(new Set([inferCategory(title, body), cleanText(job.job_publisher || '', 60), job.job_onet_soc ? `O*NET ${job.job_onet_soc}` : '', 'real-time jobs'].filter(Boolean))),
        category: inferCategory(title, body),
      } satisfies LiveJob
    }).filter((job: LiveJob) => Boolean(job.applyUrl))
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, 'jobsSearch')
  if (!rl.ok) return rl.response

  const qpSchema = z.object({
    q: z.string().max(120).optional().default(''),
    location: z.string().max(120).optional().default(''),
    category: z.string().max(120).optional().default(''),
  })
  const sp = req.nextUrl.searchParams
  const qp = qpSchema.safeParse({ q: sp.get('q') ?? undefined, location: sp.get('location') ?? undefined, category: sp.get('category') ?? undefined })
  if (!qp.success) return NextResponse.json({ ok: false, code: 'invalid_query', error: 'Invalid query parameters.' }, { status: 400 })

  const query = qp.data.q || 'recruiter sourcer talent acquisition'
  const location = qp.data.location
  const category = qp.data.category
  const selectedSources = (sp.get('sources') || 'persisted,ats,openwebninja,adzuna,remotive,arbeitnow,usajobs').split(',').map(s => s.trim()).filter(Boolean)
  const limit = Math.min(Number(sp.get('limit') || 250), 250)
  const remoteOnly = toBool(sp.get('remoteOnly'))
  const salaryOnly = toBool(sp.get('salaryOnly'))

  const persisted = selectedSources.includes('persisted')
    ? await fetchPersistedJobs({ query, location, category, remoteOnly, salaryOnly, limit })
    : []

  const atsJobs = selectedSources.includes('ats') ? await Promise.all(atsTargets.map(target => {
    if (target.ats === 'greenhouse') return fetchGreenhouseJobs(target)
    if (target.ats === 'lever') return fetchLeverJobs(target)
    return fetchAshbyJobs(target)
  })).then(groups => groups.flat()) : []

  const [openwebninja, adzuna, remotive, arbeitnow, usajobs] = await Promise.all([
    selectedSources.includes('openwebninja') ? fetchOpenWebNinja(query, location, remoteOnly) : Promise.resolve([]),
    selectedSources.includes('adzuna') ? fetchAdzuna(query, location) : Promise.resolve([]),
    selectedSources.includes('remotive') ? fetchRemotive(query) : Promise.resolve([]),
    selectedSources.includes('arbeitnow') ? fetchArbeitnow(query) : Promise.resolve([]),
    selectedSources.includes('usajobs') ? fetchUsaJobs(query, location) : Promise.resolve([])
  ])

  const jobs = dedupeJobs([...persisted, ...atsJobs, ...openwebninja, ...adzuna, ...remotive, ...arbeitnow, ...usajobs])
    .filter(job => jobMatches(job, { query, location, category, remoteOnly, salaryOnly }))
    .slice(0, limit)

  return NextResponse.json({
    ok: true,
    query,
    location,
    category,
    count: jobs.length,
    targetPoolSize: atsTargets.length,
    persistence: persisted.length ? 'hybrid' : 'live',
    jobs,
    sourceCounts: {
      persisted: persisted.length,
      ats: atsJobs.length,
      openwebninja: openwebninja.length,
      adzuna: adzuna.length,
      remotive: remotive.length,
      arbeitnow: arbeitnow.length,
      usajobs: usajobs.length,
    },
    sources: sourceLabelsFor(selectedSources),
    notes: [
      'Only recruiter, sourcer, talent acquisition, recruiting operations, healthcare recruiting, GovCon recruiting, AI recruiting, and related TA roles are shown.',
      'Uses metadata and short snippets only.',
      'Apply buttons link to the original/provider-authorized posting path.',
      'Adzuna results retain Jobs by Adzuna attribution and redirect URLs.',
      'OpenWebNinja is used as live hiring-market data, not candidate evidence.',
      'Persisted jobs are a hybrid cache layer when Supabase job_postings exists.',
      'ATS targets are curated public job-board feeds, not protected sources.'
    ]
  })
}
