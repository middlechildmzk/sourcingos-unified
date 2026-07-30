import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export type IdentityDecisionAction = 'approve' | 'keep_separate' | 'reject'

export type IdentityDecisionPreconditions = {
  proposalUpdatedAt: string
  sourceUpdatedAt: string
}

export type IdentityDecisionResult = {
  ok: boolean
  code: string
  eventId?: string
  proposalId?: string
  sourceProfileId?: string
  previousCandidateId?: string | null
  targetCandidateId?: string
  currentUpdatedAt?: string
  status?: string
}

type DbError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

export class IdentityDecisionUnavailableError extends Error {
  readonly code = 'identity_decisions_unavailable'

  constructor(message = 'Recruiter identity decisions are not activated in this environment.') {
    super(message)
    this.name = 'IdentityDecisionUnavailableError'
  }
}

export class IdentityDecisionContextNotFoundError extends Error {
  readonly code = 'identity_decision_context_not_found'

  constructor() {
    super('Identity proposal or incoming source profile was not found.')
    this.name = 'IdentityDecisionContextNotFoundError'
  }
}

export function isIdentityDecisionActivationEnabled(): boolean {
  return process.env.IDENTITY_DECISIONS_ENABLED === 'true'
}

export function isIdentityDecisionRpcUnavailable(error: unknown): boolean {
  const candidate = error && typeof error === 'object' ? error as DbError : {}
  const code = String(candidate.code || '')
  const message = `${candidate.message || ''} ${candidate.details || ''} ${candidate.hint || ''}`.toLowerCase()
  return code === 'PGRST202'
    || code === '42883'
    || code === '42P01'
    || code === 'PGRST205'
    || message.includes('decide_identity_match_proposal') && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find')
    )
}

function requireClient() {
  const client = createServerSupabaseClient()
  if (!client) throw new IdentityDecisionUnavailableError('Durable persistence is unavailable in this environment.')
  return client
}

function asDecisionResult(value: unknown): IdentityDecisionResult {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') {
    return { ok: false, code: 'identity_decision_invalid_response' }
  }
  const record = row as Record<string, unknown>
  return {
    ok: record.ok === true,
    code: String(record.code || 'identity_decision_unknown'),
    eventId: typeof record.eventId === 'string' ? record.eventId : undefined,
    proposalId: typeof record.proposalId === 'string' ? record.proposalId : undefined,
    sourceProfileId: typeof record.sourceProfileId === 'string' ? record.sourceProfileId : undefined,
    previousCandidateId: typeof record.previousCandidateId === 'string' || record.previousCandidateId === null
      ? record.previousCandidateId as string | null
      : undefined,
    targetCandidateId: typeof record.targetCandidateId === 'string' ? record.targetCandidateId : undefined,
    currentUpdatedAt: typeof record.currentUpdatedAt === 'string' ? record.currentUpdatedAt : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
  }
}

export async function getIdentityDecisionPreconditions(
  ownerId: string,
  proposalId: string,
): Promise<IdentityDecisionPreconditions> {
  const client = requireClient()
  const proposalResult = await client
    .from('identity_match_proposals')
    .select('id,source_profile_id,updated_at')
    .eq('owner_id', ownerId)
    .eq('id', proposalId)
    .maybeSingle()

  if (proposalResult.error) throw proposalResult.error
  if (!proposalResult.data) throw new IdentityDecisionContextNotFoundError()

  const sourceProfileId = String(proposalResult.data.source_profile_id || '')
  const sourceResult = await client
    .from('source_profiles')
    .select('id,updated_at')
    .eq('owner_id', ownerId)
    .eq('id', sourceProfileId)
    .maybeSingle()

  if (sourceResult.error) throw sourceResult.error
  if (!sourceResult.data) throw new IdentityDecisionContextNotFoundError()

  return {
    proposalUpdatedAt: String(proposalResult.data.updated_at || ''),
    sourceUpdatedAt: String(sourceResult.data.updated_at || ''),
  }
}

export async function decideIdentityProposal(input: {
  ownerId: string
  proposalId: string
  action: IdentityDecisionAction
  reason: string
  expectedProposalUpdatedAt: string
  expectedSourceUpdatedAt: string
}): Promise<IdentityDecisionResult> {
  if (!isIdentityDecisionActivationEnabled()) throw new IdentityDecisionUnavailableError()

  const client = requireClient()
  const result = await client.rpc('decide_identity_match_proposal', {
    p_owner_id: input.ownerId,
    p_proposal_id: input.proposalId,
    p_action: input.action,
    p_actor_id: input.ownerId,
    p_expected_proposal_updated_at: input.expectedProposalUpdatedAt,
    p_expected_source_updated_at: input.expectedSourceUpdatedAt,
    p_reason: input.reason,
  })

  if (result.error) {
    if (isIdentityDecisionRpcUnavailable(result.error)) throw new IdentityDecisionUnavailableError()
    throw result.error
  }

  return asDecisionResult(result.data)
}
