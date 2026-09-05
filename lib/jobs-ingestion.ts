export type JobSourceType = 'greenhouse' | 'lever' | 'ashby' | 'usajobs' | 'remotive' | 'arbeitnow' | 'employer-submission' | 'manual-curation'

export type NormalizedJob = {
  id: string
  title: string
  company: string
  location: string
  remoteType: string
  employmentType: string
  salaryRange: string
  source: string
  sourceType: JobSourceType
  sourceId: string
  applyUrl: string
  sourceUrl: string
  postedDate: string
  lastCheckedAt: string
  description: string
  tags: string[]
  category: string
}

export type AtsTarget = {
  company: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  token: string
  tags?: string[]
  categories?: string[]
  relevance?: 'High' | 'Medium' | 'Low'
  status?: 'untested' | 'valid' | 'invalid' | 'empty' | 'rate_limited' | 'needs_review'
}

const recruiterTitlePatterns = [
  'recruiter',
  'sourcer',
  'talent acquisition',
  'talent partner',
  'recruiting coordinator',
  'recruiting operations',
  'recruiting ops',
  'talent operations',
  'people operations',
  'people ops',
  'hr operations',
  'technical recruiting',
  'technical sourc',
  'technical recruiter',
  'healthcare recruiter',
  'nurse recruiter',
  'provider recruiter',
  'physician recruiter',
  'university recruiter',
  'campus recruiter',
  'executive recruiter',
  'recruitment consultant',
  'talent sourc'
]

const falsePositiveTitlePatterns = [
  'sales recruiter enablement',
  'recruiting software engineer',
  'recruiting platform engineer',
  'growth',
  'account executive',
  'customer success',
  'product manager',
  'software engineer',
  'backend engineer',
  'frontend engineer',
  'data engineer',
  'machine learning engineer',
  'devops engineer',
  'solutions engineer',
  'sales engineer',
  'security engineer',
  'designer',
  'marketing manager',
  'finance',
  'legal counsel'
]

export function cleanText(value: unknown, max = 500) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function isRecruitingRole(title = '', description = '') {
  const normalizedTitle = cleanText(title, 180).toLowerCase()
  if (!normalizedTitle) return false
  if (falsePositiveTitlePatterns.some(pattern => normalizedTitle.includes(pattern))) return false
  return recruiterTitlePatterns.some(pattern => normalizedTitle.includes(pattern))
}

export function inferCategory(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('sourcer') || text.includes('sourcing')) return 'sourcer'
  if (text.includes('recruiting operations') || text.includes('talent operations') || text.includes('recruiting ops')) return 'recruiting-ops'
  if (text.includes('healthcare') || text.includes('nurse') || text.includes('provider') || text.includes('physician') || text.includes('clinical')) return 'healthcare-recruiter'
  if (text.includes('federal') || text.includes('govcon') || text.includes('cleared') || text.includes('clearance')) return 'govcon-recruiter'
  if (text.includes('technical') || text.includes('engineering') || text.includes('ai') || text.includes('machine learning')) return 'technical-sourcer'
  return 'recruiter'
}

export function inferRemoteType(text = '') {
  const lower = text.toLowerCase()
  if (lower.includes('remote')) return 'Remote'
  if (lower.includes('hybrid')) return 'Hybrid'
  return 'Onsite/varies'
}

export function dedupeJobs(jobs: NormalizedJob[]) {
  const seen = new Set<string>()
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.applyUrl}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return Boolean(job.title && job.company && job.applyUrl && isRecruitingRole(job.title, job.description))
  })
}

export async function fetchGreenhouseJobs(target: AtsTarget): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(target.token)}/jobs?content=true`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.jobs || []).filter((job: any) => isRecruitingRole(job.title, job.content)).map((job: any) => {
      const title = cleanText(job.title, 160)
      const body = cleanText(job.content, 360)
      const location = cleanText(job.location?.name || 'Location not listed', 120)
      return {
        id: `greenhouse-${target.token}-${job.id}`,
        title,
        company: cleanText(target.company, 120),
        location,
        remoteType: inferRemoteType(`${location} ${body}`),
        employmentType: 'Not listed',
        salaryRange: 'Not listed',
        source: 'Greenhouse',
        sourceType: 'greenhouse',
        sourceId: String(job.id),
        applyUrl: job.absolute_url,
        sourceUrl: job.absolute_url,
        postedDate: cleanText(job.updated_at || '', 80),
        lastCheckedAt: new Date().toISOString(),
        description: body,
        tags: Array.from(new Set([...(target.tags || []), inferCategory(title, body), 'ATS public feed'])),
        category: inferCategory(title, body)
      } satisfies NormalizedJob
    })
  } catch { return [] }
}

export async function fetchLeverJobs(target: AtsTarget): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(target.token)}?mode=json`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).filter((job: any) => isRecruitingRole(job.text, `${job.descriptionPlain || ''} ${job.description || ''}`)).map((job: any) => {
      const title = cleanText(job.text, 160)
      const body = cleanText(job.descriptionPlain || job.description || '', 360)
      const location = cleanText(job.categories?.location || 'Location not listed', 120)
      const salary = job.salaryRange ? `${job.salaryRange.currency || ''} ${job.salaryRange.min || ''}-${job.salaryRange.max || ''}`.trim() : 'Not listed'
      return {
        id: `lever-${target.token}-${job.id}`,
        title,
        company: cleanText(target.company, 120),
        location,
        remoteType: inferRemoteType(`${location} ${body}`),
        employmentType: cleanText(job.categories?.commitment || 'Not listed', 120),
        salaryRange: salary || 'Not listed',
        source: 'Lever',
        sourceType: 'lever',
        sourceId: String(job.id),
        applyUrl: job.hostedUrl || job.applyUrl,
        sourceUrl: job.hostedUrl || job.applyUrl,
        postedDate: job.createdAt ? new Date(job.createdAt).toISOString() : '',
        lastCheckedAt: new Date().toISOString(),
        description: body,
        tags: Array.from(new Set([...(target.tags || []), inferCategory(title, body), 'ATS public feed'])),
        category: inferCategory(title, body)
      } satisfies NormalizedJob
    })
  } catch { return [] }
}

export async function fetchAshbyJobs(target: AtsTarget): Promise<NormalizedJob[]> {
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(target.token)}?includeCompensation=true`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    const jobs = data.jobs || data.jobPostings || []
    return (Array.isArray(jobs) ? jobs : []).filter((job: any) => isRecruitingRole(job.title, job.descriptionHtml || job.descriptionPlain)).map((job: any) => {
      const title = cleanText(job.title, 160)
      const body = cleanText(job.descriptionHtml || job.descriptionPlain || '', 360)
      const location = cleanText(job.location || job.locationName || 'Location not listed', 120)
      return {
        id: `ashby-${target.token}-${job.id}`,
        title,
        company: cleanText(target.company, 120),
        location,
        remoteType: cleanText(job.workplaceType || inferRemoteType(`${location} ${body}`), 80),
        employmentType: cleanText(job.employmentType || 'Not listed', 120),
        salaryRange: cleanText(job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary || 'Not listed', 120),
        source: 'Ashby',
        sourceType: 'ashby',
        sourceId: String(job.id),
        applyUrl: job.jobUrl || job.applyUrl,
        sourceUrl: job.jobUrl || job.applyUrl,
        postedDate: cleanText(job.publishedAt || '', 80),
        lastCheckedAt: new Date().toISOString(),
        description: body,
        tags: Array.from(new Set([...(target.tags || []), inferCategory(title, body), 'ATS public feed'])),
        category: inferCategory(title, body)
      } satisfies NormalizedJob
    })
  } catch { return [] }
}
