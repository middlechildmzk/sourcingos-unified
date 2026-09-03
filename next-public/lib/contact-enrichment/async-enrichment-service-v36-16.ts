import 'server-only'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { ContactEnrichmentRequest, ContactSignal, ContactEnrichmentProvider } from './types'
import { hasSufficientEnrichmentInputs } from './types'
import { contactGoalStateV36_12, type ContactResolutionGoalV36_12 } from './orchestrator-v35'
import {
  asyncCallbackUrlV36_16,
  configuredAsyncProviderChainV36_16,
  createAsyncCallbackTokenV36_16,
  launchAsyncProviderV36_16,
  normalizeAsyncProviderWebhookV36_16,
  providerCanPursueGoalsV36_16,
  verifyAsyncCallbackTokenV36_16,
  verifyWizaWebhookAuthV36_16,
  type AsyncContactJobStatusV36_16,
  type AsyncContactProviderV36_16,
  type AsyncProviderAttemptV36_16,
} from './async-enrichment-v36-16'

type JsonRecord = Record<string, unknown>

type AsyncJobRowV36_16 = {
  id: string
  owner_id: string
  candidate_id: string | null
  source_profile_id: string | null
  status: AsyncContactJobStatusV36_16
  requested_goals: ContactResolutionGoalV36_12[]
  satisfied_goals: ContactResolutionGoalV36_12[]
  missing_goals: ContactResolutionGoalV36_12[]
  provider_chain: AsyncContactProviderV36_16[]
  provider_index: number
  current_provider: AsyncContactProviderV36_16 | null
  current_provider_request_id: string | null
  request_payload: JsonRecord
  accumulated_signals: ContactSignal[]
  attempts: AsyncProviderAttemptV36_16[]
  callback_token_hash: string
  estimated_credits: number
  actual_credits: number
  error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function sb() {
  const client = createServerSupabaseClient()
  if (!isSupabaseConfigured() || !client) throw new Error('Durable async enrichment storage is not configured.')
  return client
}

function now() {
  return new Date().toISOString()
}

function uniqueGoals(goals: ContactResolutionGoalV36_12[]) {
  return Array.from(new Set(goals)).filter(goal => ['work_email', 'personal_email', 'phone'].includes(goal))
}

function dedupeSignals(signals: ContactSignal[]): ContactSignal[] {
  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = `${signal.type}:${signal.channelKind || ''}:${signal.value.toLowerCase()}:${signal.sourceProvider}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function asJob(row: unknown): AsyncJobRowV36_16 {
  const value = row as AsyncJobRowV36_16
  return {
    ...value,
    requested_goals: Array.isArray(value.requested_goals) ? value.requested_goals : [],
    satisfied_goals: Array.isArray(value.satisfied_goals) ? value.satisfied_goals : [],
    missing_goals: Array.isArray(value.missing_goals) ? value.missing_goals : [],
    provider_chain: Array.isArray(value.provider_chain) ? value.provider_chain : [],
    accumulated_signals: Array.isArray(value.accumulated_signals) ? value.accumulated_signals : [],
    attempts: Array.isArray(value.attempts) ? value.attempts : [],
    provider_index: Number(value.provider_index || 0),
    estimated_credits: Number(value.estimated_credits || 0),
    actual_credits: Number(value.actual_credits || 0),
  }
}

async function loadJobById(id: string): Promise<AsyncJobRowV36_16 | null> {
  const { data, error } = await sb().from('contact_enrichment_jobs').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`Could not load async enrichment job: ${error.message}`)
  return data ? asJob(data) : null
}

async function updateJob(id: string, patch: JsonRecord): Promise<AsyncJobRowV36_16> {
  const { data, error } = await sb().from('contact_enrichment_jobs').update({ ...patch, updated_at: now() }).eq('id', id).select('*').single()
  if (error || !data) throw new Error(`Could not update async enrichment job: ${error?.message || 'missing row'}`)
  return asJob(data)
}

async function persistCandidateSignals(job: AsyncJobRowV36_16, signals: ContactSignal[]) {
  if (!job.candidate_id || !signals.length) return
  try {
    const client = sb()
    const { data: existing } = await client.from('candidate_contacts')
      .select('type,value,source')
      .eq('candidate_id', job.candidate_id)
      .eq('owner_id', job.owner_id)
    const keys = new Set((existing || []).map((item: any) => `${item.type}:${String(item.value).toLowerCase()}:${item.source}`))
    const rows = signals
      .filter(signal => signal.sourceProvider !== 'none')
      .filter(signal => !keys.has(`${signal.type}:${signal.value.toLowerCase()}:${signal.sourceProvider}`))
      .map(signal => ({
        owner_id: job.owner_id,
        candidate_id: job.candidate_id,
        source_profile_id: job.source_profile_id || null,
        type: signal.type,
        contact_kind: signal.channelKind || null,
        value: signal.value,
        source: signal.sourceProvider,
        confidence: signal.confidence,
        verified: false,
        permission_status: signal.permissionStatus || 'unknown',
        ownership_confidence: signal.ownershipConfidence || null,
        deliverability: signal.deliverability || null,
        provider_status_raw: signal.providerStatusRaw || null,
        observed_at: signal.discoveredAt || now(),
      }))
    if (rows.length) await client.from('candidate_contacts').insert(rows)
  } catch {
    // Async contact results remain available on the job even if optional Candidate
    // Graph persistence is unavailable. Never fail the provider callback because
    // a secondary persistence path failed.
  }
}

function completeAttempt(
  attempts: AsyncProviderAttemptV36_16[],
  provider: AsyncContactProviderV36_16,
  patch: Partial<AsyncProviderAttemptV36_16>,
): AsyncProviderAttemptV36_16[] {
  const next = [...attempts]
  const index = [...next].map(item => item.provider).lastIndexOf(provider)
  if (index < 0) {
    next.push({
      provider,
      state: patch.state || 'completed',
      startedAt: patch.startedAt || now(),
      estimatedCredits: patch.estimatedCredits || 0,
      ...patch,
    })
  } else {
    next[index] = { ...next[index], ...patch }
  }
  return next
}

async function advanceJob(jobInput: AsyncJobRowV36_16, callbackToken: string): Promise<AsyncJobRowV36_16> {
  let job = jobInput
  if (['completed', 'exhausted', 'failed', 'canceled'].includes(job.status)) return job

  while (true) {
    const state = contactGoalStateV36_12(job.accumulated_signals, job.requested_goals)
    if (!state.missing.length) {
      return updateJob(job.id, {
        status: 'completed', satisfied_goals: state.satisfied, missing_goals: [], current_provider: null,
        current_provider_request_id: null, completed_at: now(), error: null,
      })
    }

    let index = job.provider_index
    let provider = job.provider_chain[index]
    while (provider && !providerCanPursueGoalsV36_16(provider, state.missing)) {
      index += 1
      provider = job.provider_chain[index]
    }
    if (!provider) {
      return updateJob(job.id, {
        status: 'exhausted', provider_index: index, satisfied_goals: state.satisfied, missing_goals: state.missing,
        current_provider: null, current_provider_request_id: null, completed_at: now(),
      })
    }

    const startedAt = now()
    const callbackUrl = asyncCallbackUrlV36_16(provider, job.id, callbackToken)
    let launch
    try {
      job = await updateJob(job.id, { status: 'running', provider_index: index, current_provider: provider, current_provider_request_id: null })
      launch = await launchAsyncProviderV36_16(provider, job.request_payload as ContactEnrichmentRequest, state.missing, callbackUrl, job.id)
    } catch (error) {
      const attempts = completeAttempt(job.attempts, provider, {
        state: 'failed', startedAt, completedAt: now(), estimatedCredits: 0,
        warnings: [error instanceof Error ? error.message : 'Provider launch failed.'], resultCount: 0,
      })
      job = await updateJob(job.id, {
        attempts, provider_index: index + 1, current_provider: null, current_provider_request_id: null,
        error: error instanceof Error ? error.message : 'Provider launch failed.',
      })
      continue
    }

    const waitingAttempt: AsyncProviderAttemptV36_16 = {
      provider, state: launch.completedSynchronously ? (launch.signals.length ? 'completed' : 'miss') : 'waiting_webhook',
      startedAt, ...(launch.completedSynchronously ? { completedAt: now() } : {}),
      providerRequestId: launch.providerRequestId, estimatedCredits: launch.estimatedCredits,
      actualCredits: launch.actualCredits, underlyingProvider: launch.underlyingProvider,
      resultCount: launch.signals.length, warnings: launch.warning ? [launch.warning] : [],
    }
    const attempts = [...job.attempts, waitingAttempt]
    const estimatedCredits = job.estimated_credits + launch.estimatedCredits
    const actualCredits = job.actual_credits + (launch.actualCredits || 0)

    if (!launch.completedSynchronously) {
      return updateJob(job.id, {
        status: 'running', attempts, estimated_credits: estimatedCredits, actual_credits: actualCredits,
        current_provider: provider, current_provider_request_id: launch.providerRequestId || null,
        satisfied_goals: state.satisfied, missing_goals: state.missing, error: null,
      })
    }

    const accumulated = dedupeSignals([...job.accumulated_signals, ...launch.signals])
    await persistCandidateSignals(job, launch.signals)
    const nextState = contactGoalStateV36_12(accumulated, job.requested_goals)
    job = await updateJob(job.id, {
      attempts, accumulated_signals: accumulated, estimated_credits: estimatedCredits, actual_credits: actualCredits,
      provider_index: index + 1, current_provider: null, current_provider_request_id: null,
      satisfied_goals: nextState.satisfied, missing_goals: nextState.missing, error: null,
    })
  }
}

export async function startAsyncContactEnrichmentV36_16(params: {
  ownerId: string
  request: ContactEnrichmentRequest
  goals: ContactResolutionGoalV36_12[]
}): Promise<AsyncJobRowV36_16> {
  if (!hasSufficientEnrichmentInputs(params.request)) throw new Error('Strong identity anchors are required before async contact enrichment.')
  const goals = uniqueGoals(params.goals)
  if (!goals.length) throw new Error('At least one contact-resolution goal is required.')
  const chain = configuredAsyncProviderChainV36_16(goals)
  if (!chain.length) throw new Error('No asynchronous contact provider is configured for the requested goals.')
  const { token, hash } = createAsyncCallbackTokenV36_16()
  const initialState = contactGoalStateV36_12([], goals)
  const { data, error } = await sb().from('contact_enrichment_jobs').insert({
    owner_id: params.ownerId,
    candidate_id: params.request.candidateId || null,
    source_profile_id: params.request.sourceProfileId || null,
    status: 'queued', requested_goals: initialState.requested, satisfied_goals: [], missing_goals: initialState.missing,
    provider_chain: chain, provider_index: 0, request_payload: params.request, accumulated_signals: [], attempts: [],
    callback_token_hash: hash, estimated_credits: 0, actual_credits: 0,
  }).select('*').single()
  if (error || !data) throw new Error(`Could not create async enrichment job: ${error?.message || 'missing row'}`)
  return advanceJob(asJob(data), token)
}

export async function getAsyncContactEnrichmentJobV36_16(ownerId: string, id: string): Promise<AsyncJobRowV36_16 | null> {
  const { data, error } = await sb().from('contact_enrichment_jobs').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle()
  if (error) throw new Error(`Could not load async enrichment job: ${error.message}`)
  return data ? asJob(data) : null
}

export async function handleAsyncContactWebhookV36_16(params: {
  provider: AsyncContactProviderV36_16
  jobId: string
  callbackToken: string
  payload: unknown
  wizaAuthHeader?: string | null
}): Promise<AsyncJobRowV36_16> {
  let job = await loadJobById(params.jobId)
  if (!job) throw new Error('Async enrichment job not found.')
  if (!verifyAsyncCallbackTokenV36_16(params.callbackToken, job.callback_token_hash)) throw new Error('Invalid async enrichment callback token.')
  if (params.provider === 'wiza' && !verifyWizaWebhookAuthV36_16(params.wizaAuthHeader || null)) throw new Error('Invalid Wiza webhook authentication.')
  if (['completed', 'exhausted', 'failed', 'canceled'].includes(job.status)) return job

  // Provider retry/final-batch callbacks may arrive after a per-contact callback
  // already advanced the waterfall. Treat them idempotently rather than letting a
  // stale provider overwrite the current job state.
  if (job.current_provider !== params.provider) return job

  const normalized = normalizeAsyncProviderWebhookV36_16(params.provider, params.payload)
  const accumulated = dedupeSignals([...job.accumulated_signals, ...normalized.signals])
  const state = contactGoalStateV36_12(accumulated, job.requested_goals)
  const attempts = completeAttempt(job.attempts, params.provider, {
    state: normalized.signals.length ? 'completed' : 'miss', completedAt: now(),
    actualCredits: normalized.actualCredits, resultCount: normalized.signals.length,
  })
  await persistCandidateSignals(job, normalized.signals)
  job = await updateJob(job.id, {
    accumulated_signals: accumulated,
    attempts,
    actual_credits: job.actual_credits + (normalized.actualCredits || 0),
    provider_index: job.provider_index + 1,
    current_provider: null,
    current_provider_request_id: null,
    satisfied_goals: state.satisfied,
    missing_goals: state.missing,
    error: null,
  })
  return advanceJob(job, params.callbackToken)
}

export function publicAsyncContactJobV36_16(job: AsyncJobRowV36_16) {
  return {
    id: job.id,
    status: job.status,
    requestedGoals: job.requested_goals,
    satisfiedGoals: job.satisfied_goals,
    missingGoals: job.missing_goals,
    currentProvider: job.current_provider,
    providerChain: job.provider_chain,
    attempts: job.attempts,
    signals: job.accumulated_signals,
    estimatedCredits: job.estimated_credits,
    actualCredits: job.actual_credits,
    error: job.error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
    trust: {
      providerSignalsAreObservations: true,
      contactPermissionInferred: false,
      secretsExposed: false,
      outreachPerformed: false,
      atsWritePerformed: false,
    },
  }
}

export function isAsyncContactProviderV36_16(value: string): value is AsyncContactProviderV36_16 {
  return ['wiza', 'apollo', 'fullenrich', 'coldiq'].includes(value)
}

export function providerFromSignalV36_16(signal: ContactSignal): ContactEnrichmentProvider {
  return signal.sourceProvider
}
