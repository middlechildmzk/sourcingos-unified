import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { FLEET_AGENTS_V40_4 } from './agent-registry-v40-4'
import { discoverPublicResumeLeadsV40_4, fetchParseAttachResumeLeadV40_4 } from './resume-intelligence-v40-4'

export type EnrichmentTaskV40_4 = {
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

const RESUME_SEARCH_AGENTS = FLEET_AGENTS_V40_4.filter(agent => agent.team === 'resume_cv' && agent.task === 'resume_search')

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString()
}

export async function seedCandidateEnrichmentTasksV40_4(sb: SupabaseClient, limit = 6) {
  const capped = Math.max(1, Math.min(limit, 24))
  const { data: candidates, error } = await sb
    .from('candidates')
    .select('id,owner_id,canonical_name,headline,location,current_company,current_title,skills,last_refreshed_at,created_at')
    .not('canonical_name', 'is', null)
    .order('last_refreshed_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(capped * 4)
  if (error) throw new Error(error.message)
  if (!candidates?.length) return { considered: 0, queued: 0 }

  const ids = candidates.map(candidate => candidate.id)
  const [{ data: artifacts }, { data: recentTasks }, { data: profiles }] = await Promise.all([
    sb.from('candidate_artifacts').select('candidate_id,artifact_type').in('candidate_id', ids).eq('artifact_type', 'resume'),
    sb.from('candidate_enrichment_tasks').select('candidate_id,task_kind,status,created_at').in('candidate_id', ids).gte('created_at', daysAgo(7)),
    sb.from('source_profiles').select('candidate_id,id').in('candidate_id', ids),
  ])

  const resumeCandidates = new Set((artifacts || []).map(row => row.candidate_id))
  const recentResumeSearch = new Set((recentTasks || []).filter(row => row.task_kind === 'resume_search').map(row => row.candidate_id))
  const liveByCandidateKind = new Set((recentTasks || []).filter(row => ['queued','running'].includes(row.status)).map(row => `${row.candidate_id}:${row.task_kind}`))
  const profileCount = new Map<string, number>()
  for (const row of profiles || []) profileCount.set(row.candidate_id, (profileCount.get(row.candidate_id) || 0) + 1)

  let queued = 0
  let agentCursor = 0
  for (const candidate of candidates) {
    if (queued >= capped) break
    if (resumeCandidates.has(candidate.id) || recentResumeSearch.has(candidate.id) || liveByCandidateKind.has(`${candidate.id}:resume_search`)) continue
    if (!candidate.canonical_name || String(candidate.canonical_name).trim().split(/\s+/).length < 2) continue
    // Require some corroborating context before spending public-web research credits.
    if (!candidate.current_company && !candidate.location && (profileCount.get(candidate.id) || 0) < 1) continue

    const worker = RESUME_SEARCH_AGENTS[agentCursor % Math.max(1, RESUME_SEARCH_AGENTS.length)]
    agentCursor += 1
    const priority = Math.min(100,
      55
      + (candidate.current_company ? 10 : 0)
      + (candidate.current_title ? 8 : 0)
      + ((profileCount.get(candidate.id) || 0) >= 1 ? 12 : 0)
      + (!Array.isArray(candidate.skills) || candidate.skills.length < 5 ? 5 : 0),
    )
    const { error: insertError } = await sb.from('candidate_enrichment_tasks').insert({
      owner_id: candidate.owner_id,
      candidate_id: candidate.id,
      task_kind: 'resume_search',
      agent_id: worker?.id || 'resume-query-general',
      priority,
      status: 'queued',
      payload: { queryOffset: agentCursor % 7, trust: { publicOnly: true, noAuthBypass: true, contactValuesCaptured: false } },
    })
    if (!insertError) queued += 1
  }

  return { considered: candidates.length, queued }
}

export async function claimCandidateEnrichmentTasksV40_4(sb: SupabaseClient, limit = 4, worker = 'enrichment-cron') {
  const { data, error } = await sb.rpc('claim_candidate_enrichment_tasks_v40_4', {
    p_limit: Math.max(1, Math.min(limit, 12)),
    p_worker: worker,
    p_now: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  return (data || []) as EnrichmentTaskV40_4[]
}

async function completeTask(sb: SupabaseClient, task: EnrichmentTaskV40_4, status: 'complete' | 'needs_review' | 'failed' | 'paused', result: Record<string, unknown>, error?: string) {
  await sb.from('candidate_enrichment_tasks').update({
    status,
    result_summary: result,
    last_error: error || null,
    completed_at: ['complete','needs_review','failed'].includes(status) ? new Date().toISOString() : null,
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id).eq('owner_id', task.owner_id)
}

async function retryTask(sb: SupabaseClient, task: EnrichmentTaskV40_4, message: string) {
  const backoffMinutes = Math.min(180, Math.max(30, task.attempts * 30))
  await sb.from('candidate_enrichment_tasks').update({
    status: 'queued',
    not_before: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
    result_summary: { retryScheduled: true, backoffMinutes },
    last_error: message,
    completed_at: null,
    locked_at: null,
    locked_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id).eq('owner_id', task.owner_id)
}

async function executeResumeSearch(sb: SupabaseClient, task: EnrichmentTaskV40_4) {
  const { data: candidate, error } = await sb.from('candidates')
    .select('id,canonical_name,headline,location,current_company,current_title')
    .eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle()
  if (error || !candidate) throw new Error(error?.message || 'Candidate not found.')

  const result = await discoverPublicResumeLeadsV40_4({
    sb,
    ownerId: task.owner_id,
    candidate,
    queryOffset: Number(task.payload?.queryOffset || 0),
    queryLimit: 2,
  })

  const { data: leads } = await sb.from('public_document_leads')
    .select('id,status,url')
    .eq('owner_id', task.owner_id)
    .eq('candidate_id', task.candidate_id)
    .eq('status', 'discovered')
    .order('discovered_at', { ascending: false })
    .limit(2)

  if (leads?.length) {
    const { error: queueError } = await sb.from('candidate_enrichment_tasks').insert({
      owner_id: task.owner_id,
      candidate_id: task.candidate_id,
      task_kind: 'resume_fetch_parse',
      agent_id: 'resume-parser',
      priority: Math.min(100, task.priority + 5),
      status: 'queued',
      payload: { leadIds: leads.map(lead => lead.id), noAuthBypass: true, contactValuesCaptured: false },
    })
    if (queueError && queueError.code !== '23505') result.warnings.push(`resume parse queue: ${queueError.message}`)
  }

  await completeTask(sb, task, 'complete', { ...result, parseQueued: Boolean(leads?.length) })
  return { taskId: task.id, kind: task.task_kind, ...result, parseQueued: Boolean(leads?.length) }
}

async function preserveExistingSkills(sb: SupabaseClient, task: EnrichmentTaskV40_4, beforeSkills: string[]) {
  if (!beforeSkills.length) return
  const { data: after } = await sb.from('candidates').select('skills').eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle()
  const afterSkills = Array.isArray(after?.skills) ? after.skills.filter((value): value is string => typeof value === 'string') : []
  const merged = Array.from(new Set([...beforeSkills, ...afterSkills].map(value => value.trim()).filter(Boolean))).slice(0, 200)
  await sb.from('candidates').update({ skills: merged, updated_at: new Date().toISOString() }).eq('id', task.candidate_id).eq('owner_id', task.owner_id)
}

async function executeResumeParse(sb: SupabaseClient, task: EnrichmentTaskV40_4) {
  const leadIds = Array.isArray(task.payload?.leadIds) ? task.payload?.leadIds.filter((id): id is string => typeof id === 'string').slice(0, 2) : []
  if (!leadIds.length) {
    await completeTask(sb, task, 'failed', { attached: false }, 'No public resume lead IDs were supplied.')
    return { taskId: task.id, kind: task.task_kind, attached: false, error: 'No lead IDs.' }
  }

  // Snapshot pre-existing skills so a resume can add evidence without replacing
  // richer skills that were already observed from GitHub/Stack/etc.
  const { data: before } = await sb.from('candidates').select('skills').eq('id', task.candidate_id).eq('owner_id', task.owner_id).maybeSingle()
  const beforeSkills = Array.isArray(before?.skills) ? before.skills.filter((value): value is string => typeof value === 'string') : []

  const attempts: Array<Record<string, unknown>> = []
  for (const leadId of leadIds) {
    const result = await fetchParseAttachResumeLeadV40_4({ sb, ownerId: task.owner_id, leadId })
    attempts.push({ leadId, ...result })
    if (result.attached) {
      await preserveExistingSkills(sb, task, beforeSkills)
      await completeTask(sb, task, 'complete', { attached: true, leadId, attempts, contactValuesCaptured: false })
      return { taskId: task.id, kind: task.task_kind, attached: true, leadId, attempts }
    }
  }

  const needsReview = attempts.some(item => item.needsReview === true)
  await completeTask(sb, task, needsReview ? 'needs_review' : 'complete', { attached: false, attempts, contactValuesCaptured: false })
  return { taskId: task.id, kind: task.task_kind, attached: false, needsReview, attempts }
}

export async function executeCandidateEnrichmentTaskV40_4(sb: SupabaseClient, task: EnrichmentTaskV40_4) {
  try {
    if (task.task_kind === 'resume_search') return await executeResumeSearch(sb, task)
    if (task.task_kind === 'resume_fetch_parse') return await executeResumeParse(sb, task)
    await completeTask(sb, task, 'paused', { reason: 'Worker adapter not yet activated in V40.4 canary.' })
    return { taskId: task.id, kind: task.task_kind, paused: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrichment task failed.'
    const terminal = task.attempts >= task.max_attempts
    if (terminal) await completeTask(sb, task, 'failed', { error: message }, message)
    else await retryTask(sb, task, message)
    return { taskId: task.id, kind: task.task_kind, error: message, terminal, retryScheduled: !terminal }
  }
}

export async function runEnrichmentTickV40_4(sb: SupabaseClient) {
  // Start small in production: the scheduler can wake every 15 minutes while
  // each tick remains bounded. Scale this only after yield/cost/identity quality
  // is visible in the Agent Fleet dashboard.
  const seeded = await seedCandidateEnrichmentTasksV40_4(sb, 6)
  const tasks = await claimCandidateEnrichmentTasksV40_4(sb, 4, `enrichment-${Date.now().toString(36)}`)
  const results = []
  for (const task of tasks) results.push(await executeCandidateEnrichmentTaskV40_4(sb, task))
  return {
    seeded,
    claimed: tasks.length,
    completed: results.filter((row: any) => !row.error && !row.paused).length,
    errors: results.filter((row: any) => Boolean(row.error)).length,
    results,
    trust: { identityMergeAuthorized: false, contactValuesCaptured: false, recruiterDecisionAutomated: false, authBypassAllowed: false },
  }
}
