import { NextRequest, NextResponse } from 'next/server'
import { atsTargets } from '@/data/ats-targets'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { dedupeJobs, fetchAshbyJobs, fetchGreenhouseJobs, fetchLeverJobs, isRecruitingRole, cleanText, NormalizedJob } from '@/lib/jobs-ingestion'
import { fetchPersistedJobs, jobMatches } from '@/lib/jobs-v2'
import { sourceLabelsFor } from '@/lib/job-source-registry'

type LiveJob = NormalizedJob

function toBool(value: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
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

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, 'public')
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
  const selectedSources = (sp.get('sources') || 'persisted,ats,remotive,arbeitnow,usajobs').split(',').map(s => s.trim()).filter(Boolean)
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

  const [remotive, arbeitnow, usajobs] = await Promise.all([
    selectedSources.includes('remotive') ? fetchRemotive(query) : Promise.resolve([]),
    selectedSources.includes('arbeitnow') ? fetchArbeitnow(query) : Promise.resolve([]),
    selectedSources.includes('usajobs') ? fetchUsaJobs(query, location) : Promise.resolve([])
  ])

  const jobs = dedupeJobs([...persisted, ...atsJobs, ...remotive, ...arbeitnow, ...usajobs])
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
    sources: sourceLabelsFor(selectedSources),
    notes: [
      'Only recruiter, sourcer, talent acquisition, recruiting operations, healthcare recruiting, GovCon recruiting, AI recruiting, and related TA roles are shown.',
      'Uses metadata and short snippets only.',
      'Apply buttons link to the original job source.',
      'Persisted jobs are a hybrid cache layer when Supabase job_postings exists.',
      'ATS targets are curated public job-board feeds, not protected sources.'
    ]
  })
}
