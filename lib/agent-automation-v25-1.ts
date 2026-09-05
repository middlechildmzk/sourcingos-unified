import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { advanceWorkflow } from '@/lib/agent-os-v25'

export type MemoryProposal = {
  signalType: 'preference' | 'avoidance' | 'requirement' | 'pattern' | 'correction'
  key: string
  value: string
  supportingEvents: number
  confidence: number
  evidence: string[]
}

const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []

function repeated(values: string[], minimum = 2) {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries()).filter(([, count]) => count >= minimum).sort((a, b) => b[1] - a[1])
}

export async function buildMemoryProposals(ownerId: string, roleId: string | null | undefined): Promise<MemoryProposal[]> {
  if (!roleId) return []
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data, error } = await sb.from('role_candidates').select('id,fit_decision,fit_reasons,concerns,tags').eq('owner_id', ownerId).eq('role_id', roleId).neq('fit_decision', 'unreviewed')
  if (error) throw new Error(error.message)
  const reviewed = data || []
  if (reviewed.length < 3) return []

  const strong = reviewed.filter(candidate => candidate.fit_decision === 'strong_fit')
  const rejected = reviewed.filter(candidate => candidate.fit_decision === 'not_fit')
  const proposals: MemoryProposal[] = []

  for (const [value, count] of repeated(strong.flatMap(candidate => strings(candidate.tags)))) {
    proposals.push({ signalType: 'preference', key: 'strong_fit_tag', value, supportingEvents: count, confidence: Math.min(92, 55 + count * 10), evidence: strong.filter(candidate => strings(candidate.tags).some(tag => tag.toLowerCase() === value)).map(candidate => candidate.id) })
  }
  for (const [value, count] of repeated(strong.flatMap(candidate => strings(candidate.fit_reasons)))) {
    proposals.push({ signalType: 'pattern', key: 'strong_fit_reason', value, supportingEvents: count, confidence: Math.min(90, 52 + count * 9), evidence: strong.filter(candidate => strings(candidate.fit_reasons).some(reason => reason.toLowerCase() === value)).map(candidate => candidate.id) })
  }
  for (const [value, count] of repeated(rejected.flatMap(candidate => strings(candidate.concerns)))) {
    proposals.push({ signalType: 'avoidance', key: 'rejection_concern', value, supportingEvents: count, confidence: Math.min(92, 55 + count * 10), evidence: rejected.filter(candidate => strings(candidate.concerns).some(concern => concern.toLowerCase() === value)).map(candidate => candidate.id) })
  }
  return proposals.slice(0, 25)
}

export async function applyMemoryProposals(ownerId: string, roleId: string | null | undefined, proposals: MemoryProposal[]) {
  if (!roleId || !proposals.length) return { applied: 0 }
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  let applied = 0
  for (const proposal of proposals.slice(0, 25)) {
    const { data: existing } = await sb.from('recruiter_memory_signals').select('id,supporting_events,confidence,evidence').eq('owner_id', ownerId).eq('role_id', roleId).eq('signal_scope', 'role').eq('signal_type', proposal.signalType).eq('key', proposal.key).eq('value', proposal.value).maybeSingle()
    if (existing) {
      const combinedEvidence = Array.from(new Set([...strings(existing.evidence), ...proposal.evidence])).slice(0, 100)
      const { error } = await sb.from('recruiter_memory_signals').update({ supporting_events: Math.max(Number(existing.supporting_events || 0), proposal.supportingEvents), confidence: Math.max(Number(existing.confidence || 0), proposal.confidence), evidence: combinedEvidence, active: true, last_observed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', existing.id).eq('owner_id', ownerId)
      if (!error) applied++
    } else {
      const { error } = await sb.from('recruiter_memory_signals').insert({ owner_id: ownerId, role_id: roleId, signal_scope: 'role', signal_type: proposal.signalType, key: proposal.key, value: proposal.value, supporting_events: proposal.supportingEvents, confidence: proposal.confidence, evidence: proposal.evidence, active: true })
      if (!error) applied++
    }
  }
  return { applied }
}

export async function extractCandidateGraph(ownerId: string, candidateId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const [candidateResult, profilesResult, evidenceResult] = await Promise.all([
    sb.from('candidates').select('id,canonical_name,current_company,current_title,location').eq('owner_id', ownerId).eq('id', candidateId).single(),
    sb.from('source_profiles').select('source,source_profile_id,profile_url,organization,last_seen_at').eq('owner_id', ownerId).eq('candidate_id', candidateId),
    sb.from('evidence_items').select('source,label,detail,url,confidence,created_at').eq('owner_id', ownerId).eq('candidate_id', candidateId).limit(100),
  ])
  if (candidateResult.error || !candidateResult.data) throw new Error(candidateResult.error?.message || 'Candidate not found.')
  const candidate = candidateResult.data
  const edges: Array<Record<string, unknown>> = []
  if (text(candidate.current_company)) edges.push({ owner_id: ownerId, from_type: 'candidate', from_id: candidateId, edge_type: 'worked_at', to_type: 'company', to_id: text(candidate.current_company, 300).toLowerCase(), label: `${candidate.canonical_name} works at ${candidate.current_company}`, confidence: 72, source: 'candidate_profile', metadata: { title: candidate.current_title, location: candidate.location } })

  for (const profile of profilesResult.data || []) {
    edges.push({ owner_id: ownerId, from_type: 'candidate', from_id: candidateId, edge_type: 'has_profile_on', to_type: 'source', to_id: text(profile.source, 100), label: `${candidate.canonical_name} has a ${profile.source} profile`, confidence: 90, source: text(profile.source, 100), source_url: text(profile.profile_url, 1000) || null, observed_at: profile.last_seen_at, metadata: { sourceProfileId: profile.source_profile_id } })
    if (text(profile.organization)) edges.push({ owner_id: ownerId, from_type: 'candidate', from_id: candidateId, edge_type: 'affiliated_with', to_type: 'organization', to_id: text(profile.organization, 300).toLowerCase(), label: `${candidate.canonical_name} is associated with ${profile.organization}`, confidence: 68, source: text(profile.source, 100), source_url: text(profile.profile_url, 1000) || null, observed_at: profile.last_seen_at })
  }

  for (const item of evidenceResult.data || []) {
    const haystack = `${item.source} ${item.label} ${item.detail}`.toLowerCase()
    const edgeType = /patent|inventor/.test(haystack) ? 'invented' : /conference|speaker|spoke/.test(haystack) ? 'spoke_at' : /publication|journal|pubmed|crossref|openalex|research/.test(haystack) ? 'authored' : /github|repository|open source/.test(haystack) ? 'contributed_to' : 'has_evidence'
    const toType = edgeType === 'invented' ? 'patent' : edgeType === 'spoke_at' ? 'event' : edgeType === 'authored' ? 'publication' : edgeType === 'contributed_to' ? 'project' : 'evidence'
    const target = text(item.url, 1000) || `${text(item.source, 100)}:${text(item.label, 200)}:${text(item.detail, 200)}`.toLowerCase()
    edges.push({ owner_id: ownerId, from_type: 'candidate', from_id: candidateId, edge_type: edgeType, to_type: toType, to_id: target, label: text(item.label, 300) || `${candidate.canonical_name} evidence`, confidence: item.confidence === 'high' ? 88 : item.confidence === 'medium' ? 70 : 55, source: text(item.source, 100), source_url: text(item.url, 1000) || null, observed_at: item.created_at, metadata: { detail: text(item.detail, 1500) } })
  }

  let written = 0
  for (const edge of edges.slice(0, 150)) {
    const { error } = await sb.from('talent_graph_edges').upsert(edge, { onConflict: 'owner_id,from_type,from_id,edge_type,to_type,to_id,source' })
    if (!error) written++
  }
  return { candidateId, examined: edges.length, written }
}

export async function sendInboxCandidateToRole(ownerId: string, inboxId: string, roleId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data: inbox, error } = await sb.from('autosource_inbox').select('id,candidate_id,campaign_id,candidates(*)').eq('owner_id', ownerId).eq('id', inboxId).single()
  if (error || !inbox) throw new Error(error?.message || 'Inbox candidate not found.')
  const candidate = Array.isArray(inbox.candidates) ? inbox.candidates[0] : inbox.candidates
  if (!candidate) throw new Error('Candidate record unavailable.')
  const identityKey = `candidate:${candidate.id}`
  const { error: roleError } = await sb.from('role_candidates').upsert({ owner_id: ownerId, role_id: roleId, candidate_id: candidate.id, identity_key: identityKey, name: candidate.canonical_name, headline: candidate.headline || '', company: candidate.current_company || '', location: candidate.location || '', source: 'autosource', source_url: null, stage: 'needs_review', fit_decision: 'unreviewed', fit_reasons: [], concerns: [], tags: candidate.skills || [], contact_status: 'unknown', evidence_status: 'unreviewed', snapshot: candidate, updated_at: new Date().toISOString() }, { onConflict: 'role_id,identity_key' })
  if (roleError) throw new Error(roleError.message)
  await Promise.all([
    sb.from('autosource_inbox').update({ role_id: roleId, status: 'sent_to_role', updated_at: new Date().toISOString() }).eq('id', inboxId).eq('owner_id', ownerId),
    sb.from('role_activity').upsert({ owner_id: ownerId, role_id: roleId, event_key: `autosource:${inboxId}`, event_type: 'candidate_added', message: `AutoSource candidate ${candidate.canonical_name} added for recruiter review.`, payload: { candidateId: candidate.id, campaignId: inbox.campaign_id } }, { onConflict: 'role_id,event_key' }),
  ])
  return { candidateId: candidate.id, roleId }
}

export async function updateInboxCandidate(ownerId: string, inboxId: string, action: 'enrich' | 'hold' | 'dismiss') {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data: inbox, error } = await sb.from('autosource_inbox').select('id,candidate_id').eq('owner_id', ownerId).eq('id', inboxId).single()
  if (error || !inbox) throw new Error(error?.message || 'Inbox candidate not found.')
  if (action === 'enrich') {
    const { error: queueError } = await sb.from('candidate_enrichment_queue').upsert({ owner_id: ownerId, candidate_id: inbox.candidate_id, priority: 80, requested_sources: ['public_bio','github','publications','patents','company_page'], status: 'queued', updated_at: new Date().toISOString() }, { onConflict: 'owner_id,candidate_id' })
    if (queueError) throw new Error(queueError.message)
    await sb.from('autosource_inbox').update({ status: 'reviewing', updated_at: new Date().toISOString() }).eq('id', inboxId).eq('owner_id', ownerId)
  } else {
    await sb.from('autosource_inbox').update({ status: action === 'hold' ? 'hold' : 'rejected', updated_at: new Date().toISOString() }).eq('id', inboxId).eq('owner_id', ownerId)
  }
  return { inboxId, action }
}

export async function generateDailyBrief(ownerId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const [workflows, approvals, inbox, discoveries, failedRuns, activeRoles] = await Promise.all([
    sb.from('agent_workflows').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).in('status', ['queued','running','waiting_approval']),
    sb.from('agent_approvals').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'pending'),
    sb.from('autosource_inbox').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).in('status', ['unreviewed','reviewing']),
    sb.from('acquisition_discoveries').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('disposition', 'needs_review'),
    sb.from('acquisition_runs').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).in('status', ['failed','partial']).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    sb.from('role_workspaces').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).in('status', ['calibrating','active']),
  ])
  const metrics = { activeWorkflows: workflows.count || 0, pendingApprovals: approvals.count || 0, candidatesToReview: inbox.count || 0, identityReviews: discoveries.count || 0, failedRuns: failedRuns.count || 0, activeRoles: activeRoles.count || 0 }
  const actions = [
    ...(metrics.pendingApprovals ? [`Review ${metrics.pendingApprovals} agent approval${metrics.pendingApprovals === 1 ? '' : 's'}.`] : []),
    ...(metrics.candidatesToReview ? [`Review ${metrics.candidatesToReview} prioritized candidate${metrics.candidatesToReview === 1 ? '' : 's'}.`] : []),
    ...(metrics.identityReviews ? [`Resolve ${metrics.identityReviews} ambiguous public identit${metrics.identityReviews === 1 ? 'y' : 'ies'}.`] : []),
  ]
  const risks = metrics.failedRuns ? [`${metrics.failedRuns} acquisition run${metrics.failedRuns === 1 ? '' : 's'} failed or completed partially in the last 24 hours.`] : []
  const summary = actions.length ? `${actions.join(' ')} ${metrics.activeWorkflows} agent workflow${metrics.activeWorkflows === 1 ? ' is' : 's are'} active across ${metrics.activeRoles} role${metrics.activeRoles === 1 ? '' : 's'}.` : `No urgent recruiter actions. ${metrics.activeWorkflows} agent workflow${metrics.activeWorkflows === 1 ? ' is' : 's are'} active across ${metrics.activeRoles} role${metrics.activeRoles === 1 ? '' : 's'}.`
  const briefDate = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb.from('recruiter_daily_briefs').upsert({ owner_id: ownerId, brief_date: briefDate, title: actions.length ? 'Your recruiting desk needs attention' : 'Your recruiting desk is on track', summary, metrics, actions, risks, status: 'unread', updated_at: new Date().toISOString() }, { onConflict: 'owner_id,brief_date' }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function runDueAgentWorkflows(limit = 20) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data, error } = await sb.from('agent_workflows').select('id,owner_id').in('status', ['queued','running']).lte('next_run_at', new Date().toISOString()).order('next_run_at').limit(Math.min(50, limit))
  if (error) throw new Error(error.message)
  const results: Array<Record<string, unknown>> = []
  for (const workflow of data || []) {
    try { results.push(await advanceWorkflow(workflow.owner_id, workflow.id)) }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow failed.'
      await sb.from('agent_workflows').update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', workflow.id).eq('owner_id', workflow.owner_id)
      results.push({ workflowId: workflow.id, error: message })
    }
  }
  return results
}