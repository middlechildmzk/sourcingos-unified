import { NextRequest, NextResponse } from 'next/server'

type LiveJob = {
  id: string
  title: string
  company: string
  location: string
  remoteType: string
  employmentType: string
  salaryRange: string
  source: string
  applyUrl: string
  postedDate: string
  description: string
  tags: string[]
}

const recruiterTerms = ['recruiter','sourcer','talent acquisition','recruiting operations','technical recruiter','technical sourcer','healthcare recruiter','nurse recruiter','people ops']

function isRecruitingRole(title = '', description = '') {
  const haystack = `${title} ${description}`.toLowerCase()
  return recruiterTerms.some(term => haystack.includes(term))
}

function cleanText(value: unknown) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchRemotive(query: string): Promise<LiveJob[]> {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query || 'recruiter')}`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    return (json.jobs || []).filter((j: any) => isRecruitingRole(j.title, j.description)).slice(0, 12).map((j: any) => ({
      id: `remotive-${j.id}`,
      title: cleanText(j.title),
      company: cleanText(j.company_name),
      location: cleanText(j.candidate_required_location || 'Remote'),
      remoteType: 'Remote',
      employmentType: cleanText(j.job_type || 'Remote'),
      salaryRange: cleanText(j.salary || 'Not listed'),
      source: 'Remotive',
      applyUrl: j.url,
      postedDate: cleanText(j.publication_date || ''),
      description: cleanText(j.description).slice(0, 360),
      tags: (j.tags || []).slice(0, 5).map((t: any) => cleanText(t))
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
      const text = `${j.title} ${j.description} ${(j.tags || []).join(' ')}`.toLowerCase()
      return isRecruitingRole(j.title, j.description) && (!q || text.includes(q) || q.split(/\s+/).some((part: string) => text.includes(part)))
    }).slice(0, 10).map((j: any) => ({
      id: `arbeitnow-${j.slug}`,
      title: cleanText(j.title),
      company: cleanText(j.company_name),
      location: cleanText(j.location || 'Remote/varies'),
      remoteType: j.remote ? 'Remote' : 'Hybrid/Onsite',
      employmentType: 'Full-time',
      salaryRange: 'Not listed',
      source: 'Arbeitnow',
      applyUrl: j.url,
      postedDate: j.created_at ? new Date(j.created_at * 1000).toISOString() : '',
      description: cleanText(j.description).slice(0, 360),
      tags: (j.tags || []).slice(0, 5).map((t: any) => cleanText(t))
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
    url.searchParams.set('ResultsPerPage', '10')
    const res = await fetch(url, { headers: { 'Authorization-Key': key, 'User-Agent': userAgent }, next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    const items = json.SearchResult?.SearchResultItems || []
    return items.filter((it: any) => isRecruitingRole(it.MatchedObjectDescriptor?.PositionTitle, it.MatchedObjectDescriptor?.UserArea?.Details?.JobSummary)).map((it: any) => {
      const d = it.MatchedObjectDescriptor
      return {
        id: `usajobs-${d.PositionID}`,
        title: cleanText(d.PositionTitle),
        company: cleanText(d.OrganizationName || d.DepartmentName),
        location: cleanText((d.PositionLocation || []).map((l: any) => l.LocationName).join(', ')),
        remoteType: 'Federal',
        employmentType: cleanText((d.PositionSchedule || [])[0]?.Name || 'Federal'),
        salaryRange: d.PositionRemuneration?.[0] ? `${d.PositionRemuneration[0].MinimumRange}-${d.PositionRemuneration[0].MaximumRange}` : 'Not listed',
        source: 'USAJOBS',
        applyUrl: d.PositionURI,
        postedDate: cleanText(d.PublicationStartDate),
        description: cleanText(d.UserArea?.Details?.JobSummary).slice(0, 360),
        tags: ['Federal', 'USAJOBS']
      }
    })
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || 'recruiter sourcer talent acquisition'
  const location = searchParams.get('location') || ''
  const [remotive, arbeitnow, usajobs] = await Promise.all([fetchRemotive(query), fetchArbeitnow(query), fetchUsaJobs(query, location)])
  const seen = new Set<string>()
  const jobs = [...remotive, ...arbeitnow, ...usajobs].filter(job => {
    const key = `${job.title}-${job.company}-${job.applyUrl}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return Boolean(job.applyUrl && job.title && job.company)
  })
  return NextResponse.json({ ok: true, query, location, count: jobs.length, jobs, sources: ['Remotive', 'Arbeitnow', 'USAJOBS optional via env'] })
}
