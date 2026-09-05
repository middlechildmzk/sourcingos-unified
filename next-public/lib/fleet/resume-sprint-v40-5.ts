import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'
import { fetchParseAttachResumeLeadV40_4 } from './resume-intelligence-v40-4'

export const RESUME_SPRINT_BATCH_V40_5 = 'v40_5_resume_sprint_5000'
export const RESUME_SPRINT_CLAIM_LIMIT_V40_5 = 36
export const RESUME_SPRINT_CONCURRENCY_V40_5 = 6

const METADATA_ONLY_HOSTS = new Set([
  'scribd.com', 'www.scribd.com',
  'slideshare.net', 'www.slideshare.net',
  'researchgate.net', 'www.researchgate.net',
  'academia.edu', 'www.academia.edu',
  'issuu.com', 'www.issuu.com',
])

type SprintTask = {
  id: string
  owner_id: string
  candidate_id: string
  task_kind: string
  agent_id: string
  priority: number
  status: string
  attempts: number
  max_attempts: number
  payload: Record<string, unknown> | null
}

type ResumeSeed = {
  id: string
  canonical_name: string
  current_company?: string | null
  current_title?: string | null
  location?: string | null
}

function clean(value: unknown, max = 600) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.replace(/[),.;]+$/, ''))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function hostname(raw: string) {
  try { return new URL(raw).hostname.toLowerCase() } catch { return '' }
}

/**
 * Bright Data's search_engine response can be plain text, Markdown, or a
 * JSON-serialized payload. JSON strings commonly escape slashes (https:\/\/)
 * and ampersands (\u0026). Normalize those transport escapes before URL
 * extraction so legitimate public result URLs are not silently discarded.
 * This does not decode redirect targets, enumerate private resources, or
 * expand shortened links; it only recovers URLs already present in the public
 * search response.
 */
export function resumeSprintSearchResultUrlsV40_5(text: string): string[] {
  const normalizedText = String(text || '')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\\//g, '/')
  const matches = normalizedText.match(/https?:\/\/[^\s<>"'\])}]+/gi) || []
  return Array.from(new Set(matches.map(normalizeUrl).filter((url): url is string => Boolean(url))))
}

function directResumeLike(url: string): boolean {
  const value = url.toLowerCase()
  const host = hostname(url)
  if (/\.(pdf|doc|docx|rtf)(?:[?#]|$)/i.test(value)) return true
  if (/(^|[\/_-])(resume|curriculum[-_ ]?vitae|cv)([\/_\-.?&#]|$)/i.test(value)) return true
  if (host === 'drive.google.com' || host === 'docs.google.com') return true
  if (host.endsWith('.s3.amazonaws.com') || host === 's3.amazonaws.com') return true
  if (host === 'raw.githubusercontent.com') return true
  return false
}

export function resumeSprintQueriesV40_5(candidate: ResumeSeed): string[] {
  const name = `"${clean(candidate.canonical_name, 180)}"`
  const company = clean(candidate.current_company, 120)
  const title = clean(candidate.current_title, 120)
  const location = clean(candidate.location, 120)
  const context = [company, title, location].filter(Boolean).slice(0, 2).join(' ')
  return [
    // Keep the first family deliberately broad and name-only. Imported
    // connection rows frequently have stale or incomplete company/title data,
    // so context should corroborate later rather than suppress discovery.
    `${name} resume filetype:pdf`,
    `${name} CV filetype:pdf`,
    `${name} "curriculum vitae" filetype:pdf`,
    `${name} resume`,
    `${name} CV`,
    `${name} resume ${context}`.trim(),
    `${name} CV ${context}`.trim(),
    `${name} (resume OR CV) (site:drive.google.com OR site:docs.google.com)`,
    `${name} (resume OR CV) (site:github.io OR site:raw.githubusercontent.com OR site:github.com)`,
    `${name} (resume OR CV) (site:amazonaws.com OR site:dropbox.com OR site:dropboxusercontent.com)`,
    `${name} (resume OR CV OR portfolio) (site:vercel.app OR site:netlify.app OR site:carrd.co OR site:about.me)`,
    `${name} (resume OR "curriculum vitae") (site:*.edu OR site:*.org)`,
    `${name} (resume OR CV) (site:scribd.com OR site:slideshare.net OR site:issuu.com)`,
    `${name} (CV OR "curriculum vitae") (site:researchgate.net OR site:academia.edu)`,
    `${name} "work history" ${company || title}`.trim(),
  ]
}

async function discoverLeads(input: {
  sb: SupabaseClient
  ownerId: string
  candidate: ResumeSeed
  queryOffset: number
}) {
  const queries = resumeSprintQueriesV40_5(input.candidate)
  const start = Math.abs(input.queryOffset) % queries.length
  const selected = [queries[start], queries[(start + 1) % queries.length]]
  const warnings: string[] = []
  const leadIds: string[] = []
  let found = 0
  let persisted = 0
  let restricted = 0
  let resultUrlsObserved = 0
  let resumeLikeUrlsObserved = 0
  const queryTelemetry: Array<{ queryIndex: number; resultChars: number; urlsObserved: number; resumeLikeUrls: number }> = []

  for (let selectedIndex = 0; selectedIndex < selected.length; selectedIndex += 1) {
    const query = selected[selectedIndex]
    try {
      const result = await searchWebWithBrightDataV36_16(query)
      const urls = resumeSprintSearchResultUrlsV40_5(result.text)
      let queryResumeLike = 0
      resultUrlsObserved += urls.length
      for (const raw of urls) {
        const url = normalizeUrl(raw)
        if (!url) continue
        const host = hostname(url)
        const metadataOnly = METADATA_ONLY_HOSTS.has(host)
        const resumeLike = metadataOnly || directResumeLike(url)
        if (!resumeLike) continue
        queryResumeLike += 1
        resumeLikeUrlsObserved += 1
        found += 1
        if (metadataOnly) restricted += 1
        const { data, error } = await input.sb.from('public_document_leads').upsert({
          owner_id: input.ownerId,
          candidate_id: input.candidate.id,
          url,
          normalized_url: url,
          host,
          document_kind: 'resume_cv',
          discovery_query: query,
          discovery_provider: result.provider,
          status: metadataOnly ? 'restricted_metadata_only' : 'discovered',
          restricted_reason: metadataOnly ? 'Metadata lead only. SourcingOS does not bypass login, subscription, viewer, or download restrictions.' : null,
          discovered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id,candidate_id,normalized_url' }).select('id,status').maybeSingle()
        if (error) warnings.push(`lead write: ${error.message}`)
        else {
          persisted += 1
          if (data?.id && data.status === 'discovered') leadIds.push(data.id)
        }
      }
      queryTelemetry.push({
        queryIndex: (start + selectedIndex) % queries.length,
        resultChars: String(result.text || '').length,
        urlsObserved: urls.length,
        resumeLikeUrls: queryResumeLike,
      })
    } catch (error) {
      warnings.push(`${query}: ${error instanceof Error ? error.message : 'search failed'}`)
    }
  }
  return {
    queries: selected,
    found,
    persisted,
    restricted,
    resultUrlsObserved,
    resumeLikeUrlsObserved,
    queryTelemetry,
    leadIds: Array.from(new Set(leadIds)).slice(0, 3),
    warnings,
  }
}

async function completeTask(sb: SupabaseClient, task: SprintTask, status: 'complete' | 'needs_review' | 'failed', result: Record<string, unknown>, error?: string) {
  await sb.from('candidate_enrichment_tasks').update({
    status,
    result_summary: result,
    last_error: error || null,
    completed_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id).eq('owner_id', task.owner_id)
}

async function retryTask(sb: SupabaseClient, task: SprintTask, message: string) {
  const backoffMinutes = Math.min(180, Math.max(15, task.attempts * 15))
  await sb.from('candidate_enrichment_tasks').update({
    status: 'queued',
    not_before: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
    result_summary: { retryScheduled: true, backoffMinutes },
    last_error: message,
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id).eq('owner_id', task.owner_id)
}

async function executeSearch(sb: SupabaseClient, task: SprintTask) {
  const [{ data: candidate, error: candidateError }, { data: importedProfiles }] = await Promise.all([
    sb.from('candidates').select('id,canonical_name,current_company,current_title,location').eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle(),
    sb.from('source_profiles').select('headline,organization,profile_url,raw').eq('candidate_id', task.candidate_id).eq('owner_id', task.owner_id).eq('source', 'resume_xray').limit(3),
  ])
  if (candidateError || !candidate) throw new Error(candidateError?.message || 'Candidate not found.')
  const imported = (importedProfiles || []).find(row => {
    const raw = row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw) ? row.raw as Record<string, unknown> : {}
    return raw.importSource === 'linkedin_export' || raw.importType === 'linkedin_connections'
  }) || importedProfiles?.[0]
  const seed: ResumeSeed = {
    id: candidate.id,
    canonical_name: candidate.canonical_name,
    current_company: candidate.current_company || imported?.organization || null,
    current_title: candidate.current_title || imported?.headline || null,
    location: candidate.location || null,
  }
  const queryOffset = Number(task.payload?.queryOffset ?? parseInt(createHash('sha256').update(task.candidate_id).digest('hex').slice(0, 8), 16))
  const result = await discoverLeads({ sb, ownerId: task.owner_id, candidate: seed, queryOffset })
  if (result.leadIds.length) {
    const { error } = await sb.from('candidate_enrichment_tasks').insert({
      owner_id: task.owner_id,
      candidate_id: task.candidate_id,
      task_kind: 'resume_fetch_parse',
      agent_id: 'resume-parser',
      priority: Math.min(100, task.priority + 8),
      status: 'queued',
      payload: {
        leadIds: result.leadIds,
        batchTag: RESUME_SPRINT_BATCH_V40_5,
        publicOnly: true,
        noAuthBypass: true,
        contactValuesCaptured: false,
      },
    })
    if (error && error.code !== '23505') result.warnings.push(`parse queue: ${error.message}`)
  }
  await completeTask(sb, task, 'complete', { ...result, parseQueued: result.leadIds.length > 0, batchTag: RESUME_SPRINT_BATCH_V40_5 })
  return { taskId: task.id, kind: task.task_kind, ...result, parseQueued: result.leadIds.length > 0 }
}

async function executeParse(sb: SupabaseClient, task: SprintTask) {
  const leadIds = Array.isArray(task.payload?.leadIds) ? task.payload!.leadIds.filter((id): id is string => typeof id === 'string').slice(0, 3) : []
  if (!leadIds.length) {
    await completeTask(sb, task, 'failed', { attached: false }, 'No public resume lead IDs were supplied.')
    return { taskId: task.id, kind: task.task_kind, attached: false, error: 'No lead IDs.' }
  }
  const { data: before } = await sb.from('candidates').select('skills').eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle()
  const beforeSkills = Array.isArray(before?.skills) ? before.skills.filter((item): item is string => typeof item === 'string') : []
  const attempts: Array<Record<string, unknown>> = []
  for (const leadId of leadIds) {
    const result = await fetchParseAttachResumeLeadV40_4({ sb, ownerId: task.owner_id, leadId })
    attempts.push({ leadId, ...result })
    if (result.attached) {
      const { data: after } = await sb.from('candidates').select('skills').eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle()
      const afterSkills = Array.isArray(after?.skills) ? after.skills.filter((item): item is string => typeof item === 'string') : []
      const merged = Array.from(new Set([...beforeSkills, ...afterSkills].map(item => item.trim()).filter(Boolean))).slice(0, 200)
      if (merged.length) await sb.from('candidates').update({ skills: merged, updated_at: new Date().toISOString() }).eq('id', task.candidate_id).eq('owner_id', task.owner_id)
      await completeTask(sb, task, 'complete', { attached: true, leadId, attempts, contactValuesCaptured: false })
      return { taskId: task.id, kind: task.task_kind, attached: true, leadId, attempts }
    }
  }
  const needsReview = attempts.some(item => item.needsReview === true)
  await completeTask(sb, task, needsReview ? 'needs_review' : 'complete', { attached: false, attempts, contactValuesCaptured: false })
  return { taskId: task.id, kind: task.task_kind, attached: false, needsReview, attempts }
}

async function executeTask(sb: SupabaseClient, task: SprintTask) {
  try {
    if (task.task_kind === 'resume_search') return await executeSearch(sb, task)
    if (task.task_kind === 'resume_fetch_parse') return await executeParse(sb, task)
    await completeTask(sb, task, 'failed', { unsupported: task.task_kind }, 'Unsupported sprint task kind.')
    return { taskId: task.id, kind: task.task_kind, error: 'Unsupported sprint task kind.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume sprint task failed.'
    if (task.attempts >= task.max_attempts) await completeTask(sb, task, 'failed', { error: message }, message)
    else await retryTask(sb, task, message)
    return { taskId: task.id, kind: task.task_kind, error: message, retryScheduled: task.attempts < task.max_attempts }
  }
}

async function runPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

export async function runResumeSprintTickV40_5(sb: SupabaseClient) {
  const { data, error } = await sb.rpc('claim_resume_sprint_tasks_v40_5', {
    p_limit: RESUME_SPRINT_CLAIM_LIMIT_V40_5,
    p_worker: `resume-sprint-${Date.now().toString(36)}`,
    p_now: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  const tasks = (data || []) as SprintTask[]
  const results = await runPool(tasks, RESUME_SPRINT_CONCURRENCY_V40_5, task => executeTask(sb, task))
  return {
    batchTag: RESUME_SPRINT_BATCH_V40_5,
    claimed: tasks.length,
    completed: results.filter((row: any) => !row.error).length,
    errors: results.filter((row: any) => Boolean(row.error)).length,
    searches: results.filter((row: any) => row.kind === 'resume_search').length,
    attached: results.filter((row: any) => row.attached === true).length,
    needsReview: results.filter((row: any) => row.needsReview === true).length,
    leadsFound: results.reduce((sum: number, row: any) => sum + Number(row.found || 0), 0),
    resultUrlsObserved: results.reduce((sum: number, row: any) => sum + Number(row.resultUrlsObserved || 0), 0),
    resumeLikeUrlsObserved: results.reduce((sum: number, row: any) => sum + Number(row.resumeLikeUrlsObserved || 0), 0),
    results,
    trust: {
      publicOnly: true,
      authBypassAllowed: false,
      paywallBypassAllowed: false,
      contactValuesCaptured: false,
      identityMergeAuthorized: false,
      recruiterDecisionAutomated: false,
    },
  }
}
