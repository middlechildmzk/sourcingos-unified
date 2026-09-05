import 'server-only'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { cleanText, dedupeJobs, inferCategory, isRecruitingRole, type NormalizedJob } from '@/lib/jobs-ingestion'

export type JobsPersistenceMode = 'supabase' | 'preview'

export type PersistJobsResult = {
  mode: JobsPersistenceMode
  attempted: number
  persisted: number
  skipped: number
  error?: string
}

export type PersistedJobsSearch = {
  query: string
  location?: string
  category?: string
  remoteOnly?: boolean
  salaryOnly?: boolean
  limit?: number
}

export function normalizeJobText(value = '') {
  return cleanText(value, 220).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function stableJobHash(value: string) {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash) + value.charCodeAt(i)
  return Math.abs(hash >>> 0).toString(36)
}

export function jobDedupeKey(job: Pick<NormalizedJob, 'title' | 'company' | 'location' | 'applyUrl' | 'sourceType' | 'sourceId'>) {
  const strong = `${job.sourceType}:${job.sourceId || ''}:${job.applyUrl || ''}`.toLowerCase()
  if (job.sourceId || job.applyUrl) return stableJobHash(strong)
  return stableJobHash([
    normalizeJobText(job.title),
    normalizeJobText(job.company),
    normalizeJobText(job.location),
  ].join('|'))
}

export function jobRelevanceScore(job: Pick<NormalizedJob, 'title' | 'description' | 'tags' | 'category'>) {
  const text = `${job.title} ${job.description} ${(job.tags || []).join(' ')} ${job.category}`.toLowerCase()
  let score = 0
  const highSignals = ['sourcer', 'recruiter', 'talent acquisition', 'technical recruiter', 'technical sourcer', 'recruiting operations', 'ta ops']
  const domainSignals = ['healthcare', 'clinical', 'nurse', 'provider', 'federal', 'govcon', 'clearance', 'ai', 'machine learning', 'contract']
  highSignals.forEach(signal => { if (text.includes(signal)) score += 20 })
  domainSignals.forEach(signal => { if (text.includes(signal)) score += 8 })
  if (isRecruitingRole(job.title, job.description)) score += 30
  return Math.min(score, 100)
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toPostingRow(job: NormalizedJob) {
  const normalizedTitle = normalizeJobText(job.title)
  const normalizedCompany = normalizeJobText(job.company)
  const category = job.category || inferCategory(job.title, job.description)
  const now = new Date().toISOString()
  return {
    source_type: job.sourceType,
    source_id: job.sourceId || jobDedupeKey(job),
    source_url: job.sourceUrl || job.applyUrl,
    apply_url: job.applyUrl,
    title: cleanText(job.title, 180),
    normalized_title: normalizedTitle,
    company: cleanText(job.company, 160),
    normalized_company: normalizedCompany,
    location: cleanText(job.location, 180) || 'Location not listed',
    remote_type: cleanText(job.remoteType, 80) || 'Not listed',
    employment_type: cleanText(job.employmentType, 100) || 'Not listed',
    salary_text: cleanText(job.salaryRange, 140) || 'Not listed',
    posted_at: parseDate(job.postedDate),
    expires_at: null,
    last_seen_at: now,
    description_snippet: cleanText(job.description, 500),
    tags: Array.from(new Set([...(job.tags || []), category].filter(Boolean))).slice(0, 12),
    category,
    relevance_score: jobRelevanceScore(job),
    status: 'active',
    dedupe_key: jobDedupeKey(job),
    raw: job,
    updated_at: now,
  }
}

export async function persistNormalizedJobs(jobs: NormalizedJob[]): Promise<PersistJobsResult> {
  const eligible = dedupeJobs(jobs).filter(job => job.applyUrl && isRecruitingRole(job.title, job.description))
  if (!isSupabaseConfigured()) return { mode: 'preview', attempted: eligible.length, persisted: 0, skipped: eligible.length }
  const sb = createServerSupabaseClient()
  if (!sb) return { mode: 'preview', attempted: eligible.length, persisted: 0, skipped: eligible.length }
  const rows = eligible.map(toPostingRow)
  if (!rows.length) return { mode: 'supabase', attempted: 0, persisted: 0, skipped: 0 }
  const { error } = await sb.from('job_postings').upsert(rows, { onConflict: 'source_type,source_id' })
  if (error) return { mode: 'supabase', attempted: rows.length, persisted: 0, skipped: rows.length, error: error.message }
  return { mode: 'supabase', attempted: rows.length, persisted: rows.length, skipped: 0 }
}

function rowToJob(row: any): NormalizedJob {
  return {
    id: `persisted-${row.id}`,
    title: cleanText(row.title, 180),
    company: cleanText(row.company, 160),
    location: cleanText(row.location || 'Location not listed', 180),
    remoteType: cleanText(row.remote_type || 'Not listed', 80),
    employmentType: cleanText(row.employment_type || 'Not listed', 100),
    salaryRange: cleanText(row.salary_text || 'Not listed', 140),
    source: cleanText(row.raw?.source || row.source_type || 'SourcingOS Jobs', 80),
    sourceType: row.source_type || 'manual-curation',
    sourceId: String(row.source_id || row.id),
    applyUrl: row.apply_url,
    sourceUrl: row.source_url || row.apply_url,
    postedDate: row.posted_at || row.created_at || '',
    lastCheckedAt: row.last_seen_at || row.updated_at || '',
    description: cleanText(row.description_snippet || '', 500),
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category || inferCategory(row.title, row.description_snippet || ''),
  }
}

export function jobMatches(job: NormalizedJob, input: PersistedJobsSearch) {
  const query = normalizeJobText(input.query || '')
  const loc = normalizeJobText(input.location || '')
  const category = normalizeJobText(input.category || '')
  const searchText = normalizeJobText(`${job.title} ${job.company} ${job.description} ${job.tags.join(' ')} ${job.category}`)
  const locationText = normalizeJobText(`${job.location} ${job.remoteType}`)
  const queryOk = !query || query.split(/\s+/).filter(Boolean).some(part => searchText.includes(part))
  const locOk = !loc || locationText.includes(loc) || locationText.includes('remote')
  const categoryOk = !category || normalizeJobText(job.category).includes(category.replace(/ jobs$/, '')) || searchText.includes(category.replace(/ jobs$/, ''))
  const remoteOk = !input.remoteOnly || locationText.includes('remote')
  const salaryOk = !input.salaryOnly || Boolean(job.salaryRange && !job.salaryRange.toLowerCase().includes('not listed'))
  return queryOk && locOk && categoryOk && remoteOk && salaryOk && isRecruitingRole(job.title, job.description)
}

export async function fetchPersistedJobs(input: PersistedJobsSearch): Promise<NormalizedJob[]> {
  if (!isSupabaseConfigured()) return []
  const sb = createServerSupabaseClient()
  if (!sb) return []
  const limit = Math.min(input.limit || 100, 250)
  try {
    const { data, error } = await sb
      .from('job_postings')
      .select('id, source_type, source_id, source_url, apply_url, title, company, location, remote_type, employment_type, salary_text, posted_at, last_seen_at, description_snippet, tags, category, raw, created_at, updated_at')
      .in('status', ['active', 'pending_review'])
      .order('last_seen_at', { ascending: false })
      .limit(Math.max(limit * 3, 100))
    if (error || !data) return []
    return data.map(rowToJob).filter(job => jobMatches(job, input)).slice(0, limit)
  } catch {
    return []
  }
}
