import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'auto_attached_deterministic' | 'superseded'

export type IdentityProposalSummary = {
  id: string
  status: ProposalStatus
  decisionClass: string
  score: number | null
  resolverVersion: string
  reviewRequired: boolean
  createdAt: string
  updatedAt: string
  incoming: {
    sourceProfileId: string
    currentCandidateId: string | null
    source: string
    stableSourceId: string
    displayName: string
    headline: string | null
    location: string | null
    organization: string | null
    profileUrl: string | null
  }
  proposedCandidate: {
    id: string
    canonicalName: string
    headline: string | null
    currentTitle: string | null
    currentCompany: string | null
    location: string | null
    mergeStatus: string
  }
  reasons: string[]
  conflictCount: number
  blockingConflictCount: number
}

export type SafeIdentifierView = {
  type: string
  label: string
  displayValue: string | null
  confidence: number
  observedAt: string
  sensitive: boolean
}

export type SafeFieldClaimView = {
  id: string
  fieldName: string
  value: unknown
  normalizedValue: string | null
  evidenceClass: string
  lifecycleStatus: string
  reviewerStatus: string
  source: string
  sourceType: string
  observedAt: string | null
  retrievedAt: string
  freshnessScore: number
  sourceReliability: number
  corroborationCount: number
}

export type IdentityProposalDetail = IdentityProposalSummary & {
  deterministicRules: Array<{
    ruleId: string
    passed: boolean
    evidence: unknown
  }>
  similarityComponents: Record<string, number | null>
  supportingEvidence: unknown[]
  conflicts: Array<{
    type: string
    severity: 'blocking' | 'material' | 'informational'
    explanation: string
    evidence: unknown
  }>
  incomingIdentifiers: SafeIdentifierView[]
  proposedCandidateSources: Array<{
    id: string
    source: string
    stableSourceId: string
    displayName: string
    headline: string | null
    location: string | null
    organization: string | null
    profileUrl: string | null
    status: string
    lastSeenAt: string | null
  }>
  candidateClaims: SafeFieldClaimView[]
  snapshotCount: number
}

export type ProposalListResult = {
  ok: true
  available: true
  proposals: IdentityProposalSummary[]
  counts: Record<ProposalStatus, number>
  page: { limit: number; offset: number; hasMore: boolean; total: number }
  status: ProposalStatus
}

export class IdentitySchemaUnavailableError extends Error {
  readonly code = 'identity_schema_unavailable'
  constructor(message = 'The durable identity-review schema is not applied in this environment.') {
    super(message)
    this.name = 'IdentitySchemaUnavailableError'
  }
}

export class IdentityProposalNotFoundError extends Error {
  readonly code = 'identity_proposal_not_found'
  constructor() {
    super('Identity proposal not found.')
    this.name = 'IdentityProposalNotFoundError'
  }
}

type DbError = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }

export function isIdentitySchemaUnavailable(error: unknown): boolean {
  if (error instanceof IdentitySchemaUnavailableError) return true
  const candidate = error && typeof error === 'object' ? error as DbError : {}
  const code = String(candidate.code || '')
  const message = `${candidate.message || ''} ${candidate.details || ''} ${candidate.hint || ''}`.toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('identity_match_proposals') && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find')
    )
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>>
    : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
}

function conflictSummary(value: unknown) {
  const conflicts = objectArray(value)
  return {
    conflictCount: conflicts.length,
    blockingConflictCount: conflicts.filter(conflict => conflict.severity === 'blocking').length,
  }
}

function proposalReasons(row: Record<string, unknown>): string[] {
  const deterministic = objectArray(row.deterministic_rules)
    .filter(rule => rule.passed === true)
    .map(rule => String(rule.ruleId || rule.rule_id || '').trim())
    .filter(Boolean)
    .map(rule => rule.replaceAll('_', ' '))
  const evidence = objectArray(row.supporting_evidence)
    .map(item => String(item.ruleId || item.rule_id || item.type || '').trim())
    .filter(Boolean)
    .map(reason => reason.replaceAll('_', ' '))
  return [...new Set([...deterministic, ...evidence])].slice(0, 4)
}

function candidateView(row: Record<string, unknown> | undefined, fallbackId: string) {
  return {
    id: String(row?.id || fallbackId),
    canonicalName: String(row?.canonical_name || 'Potential canonical candidate'),
    headline: stringOrNull(row?.headline),
    currentTitle: stringOrNull(row?.current_title),
    currentCompany: stringOrNull(row?.current_company),
    location: stringOrNull(row?.location),
    mergeStatus: String(row?.merge_status || 'pending'),
  }
}

function sourceView(row: Record<string, unknown> | undefined, fallbackId: string) {
  return {
    sourceProfileId: String(row?.id || fallbackId),
    currentCandidateId: stringOrNull(row?.candidate_id),
    source: String(row?.source || 'unknown'),
    stableSourceId: String(row?.source_profile_id || ''),
    displayName: String(row?.display_name || 'Incoming source profile'),
    headline: stringOrNull(row?.headline),
    location: stringOrNull(row?.location),
    organization: stringOrNull(row?.organization),
    profileUrl: stringOrNull(row?.profile_url),
  }
}

function proposalSummary(
  row: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  candidate: Record<string, unknown> | undefined,
): IdentityProposalSummary {
  return {
    id: String(row.id),
    status: String(row.status || 'pending') as ProposalStatus,
    decisionClass: String(row.decision_class || 'standard_review'),
    score: numberOrNull(row.score),
    resolverVersion: String(row.resolver_version || 'unknown'),
    reviewRequired: row.review_required !== false,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
    incoming: sourceView(source, String(row.source_profile_id || '')),
    proposedCandidate: candidateView(candidate, String(row.candidate_id || '')),
    reasons: proposalReasons(row),
    ...conflictSummary(row.conflicts),
  }
}

function requireClient() {
  const client = createServerSupabaseClient()
  if (!client) throw new IdentitySchemaUnavailableError('Durable persistence is unavailable in this environment.')
  return client
}

async function statusCounts(ownerId: string): Promise<Record<ProposalStatus, number>> {
  const client = requireClient()
  const statuses: ProposalStatus[] = ['pending', 'approved', 'rejected', 'auto_attached_deterministic', 'superseded']
  const results = await Promise.all(statuses.map(status =>
    client.from('identity_match_proposals').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', status),
  ))
  const fatal = results.find(result => result.error)?.error
  if (fatal) {
    if (isIdentitySchemaUnavailable(fatal)) throw new IdentitySchemaUnavailableError()
    throw new Error(fatal.message)
  }
  return Object.fromEntries(statuses.map((status, index) => [status, results[index].count || 0])) as Record<ProposalStatus, number>
}

export async function listIdentityProposals(
  ownerId: string,
  input: { limit?: number; offset?: number; status?: ProposalStatus } = {},
): Promise<ProposalListResult> {
  const client = requireClient()
  const limit = Math.max(1, Math.min(100, Number(input.limit) || 25))
  const offset = Math.max(0, Number(input.offset) || 0)
  const status: ProposalStatus = input.status || 'pending'

  const proposalResult = await client
    .from('identity_match_proposals')
    .select('*', { count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (proposalResult.error) {
    if (isIdentitySchemaUnavailable(proposalResult.error)) throw new IdentitySchemaUnavailableError()
    throw new Error(proposalResult.error.message)
  }

  const rows = (proposalResult.data || []) as Array<Record<string, unknown>>
  const sourceIds = [...new Set(rows.map(row => String(row.source_profile_id || '')).filter(Boolean))]
  const candidateIds = [...new Set(rows.map(row => String(row.candidate_id || '')).filter(Boolean))]

  const [sourcesResult, candidatesResult, counts] = await Promise.all([
    sourceIds.length
      ? client.from('source_profiles').select('id,candidate_id,source,source_profile_id,display_name,headline,location,organization,profile_url').eq('owner_id', ownerId).in('id', sourceIds)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? client.from('candidates').select('id,canonical_name,headline,current_title,current_company,location,merge_status').eq('owner_id', ownerId).in('id', candidateIds)
      : Promise.resolve({ data: [], error: null }),
    statusCounts(ownerId),
  ])

  const relatedError = sourcesResult.error || candidatesResult.error
  if (relatedError) throw new Error(relatedError.message)

  const sources = new Map(((sourcesResult.data || []) as Array<Record<string, unknown>>).map(row => [String(row.id), row]))
  const candidates = new Map(((candidatesResult.data || []) as Array<Record<string, unknown>>).map(row => [String(row.id), row]))
  const total = proposalResult.count || 0

  return {
    ok: true,
    available: true,
    proposals: rows.map(row => proposalSummary(
      row,
      sources.get(String(row.source_profile_id || '')),
      candidates.get(String(row.candidate_id || '')),
    )),
    counts,
    page: { limit, offset, hasMore: offset + rows.length < total, total },
    status,
  }
}

function safeIdentifier(row: Record<string, unknown>): SafeIdentifierView {
  const sensitive = row.is_sensitive === true
  const type = String(row.identifier_type || 'unknown')
  const labels: Record<string, string> = {
    platform_id: 'Stable platform ID',
    profile_url: 'Profile URL',
    handle: 'Observed handle',
    public_email_hash: 'Observed public email hash',
    website_domain: 'Website domain',
    orcid: 'Validated ORCID',
    phone_hash: 'Observed phone hash',
    linkedin_url: 'LinkedIn URL',
    github_url: 'GitHub URL',
    stackoverflow_url: 'Stack Overflow URL',
  }
  return {
    type,
    label: labels[type] || type.replaceAll('_', ' '),
    displayValue: sensitive ? null : stringOrNull(row.display_value),
    confidence: numberOrNull(row.confidence) || 0,
    observedAt: String(row.observed_at || ''),
    sensitive,
  }
}

export async function getIdentityProposal(ownerId: string, proposalId: string): Promise<IdentityProposalDetail> {
  const client = requireClient()
  const proposalResult = await client
    .from('identity_match_proposals')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('id', proposalId)
    .maybeSingle()

  if (proposalResult.error) {
    if (isIdentitySchemaUnavailable(proposalResult.error)) throw new IdentitySchemaUnavailableError()
    throw new Error(proposalResult.error.message)
  }
  if (!proposalResult.data) throw new IdentityProposalNotFoundError()

  const row = proposalResult.data as Record<string, unknown>
  const sourceProfileId = String(row.source_profile_id || '')
  const candidateId = String(row.candidate_id || '')

  const [sourceResult, candidateResult, candidateSourcesResult, incomingIdentifiersResult, claimsResult, snapshotCountResult] = await Promise.all([
    client.from('source_profiles').select('id,candidate_id,source,source_profile_id,display_name,headline,location,organization,profile_url,status,last_seen_at').eq('owner_id', ownerId).eq('id', sourceProfileId).maybeSingle(),
    client.from('candidates').select('id,canonical_name,headline,current_title,current_company,location,merge_status').eq('owner_id', ownerId).eq('id', candidateId).maybeSingle(),
    client.from('source_profiles').select('id,candidate_id,source,source_profile_id,display_name,headline,location,organization,profile_url,status,last_seen_at').eq('owner_id', ownerId).eq('candidate_id', candidateId).order('source', { ascending: true }),
    client.from('source_profile_identifiers').select('identifier_type,display_value,confidence,observed_at,is_sensitive').eq('owner_id', ownerId).eq('source_profile_id', sourceProfileId).order('identifier_type', { ascending: true }),
    client.from('evidence_claims').select('id,field_name,value_json,claimed_value,normalized_value,evidence_class,lifecycle_status,reviewer_status,source,source_type,observed_at,retrieved_at,freshness_score,source_reliability,corroboration_count').eq('owner_id', ownerId).eq('candidate_id', candidateId).order('updated_at', { ascending: false }).limit(100),
    client.from('source_profile_snapshots').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('source_profile_id', sourceProfileId),
  ])

  const relatedError = sourceResult.error || candidateResult.error || candidateSourcesResult.error || incomingIdentifiersResult.error || claimsResult.error || snapshotCountResult.error
  if (relatedError) throw new Error(relatedError.message)

  const summary = proposalSummary(
    row,
    sourceResult.data as Record<string, unknown> | undefined,
    candidateResult.data as Record<string, unknown> | undefined,
  )

  return {
    ...summary,
    deterministicRules: objectArray(row.deterministic_rules).map(rule => ({
      ruleId: String(rule.ruleId || rule.rule_id || 'unknown_rule'),
      passed: rule.passed === true,
      evidence: rule.evidence ?? {},
    })),
    similarityComponents: Object.fromEntries(
      Object.entries(row.similarity_components && typeof row.similarity_components === 'object' && !Array.isArray(row.similarity_components)
        ? row.similarity_components as Record<string, unknown>
        : {})
        .map(([key, value]) => [key, numberOrNull(value)]),
    ),
    supportingEvidence: Array.isArray(row.supporting_evidence) ? row.supporting_evidence : [],
    conflicts: objectArray(row.conflicts).map(conflict => ({
      type: String(conflict.type || 'identity_conflict'),
      severity: ['blocking', 'material', 'informational'].includes(String(conflict.severity))
        ? String(conflict.severity) as 'blocking' | 'material' | 'informational'
        : 'informational',
      explanation: String(conflict.explanation || 'Review conflicting identity evidence.'),
      evidence: conflict.evidence ?? {},
    })),
    incomingIdentifiers: ((incomingIdentifiersResult.data || []) as Array<Record<string, unknown>>).map(safeIdentifier),
    proposedCandidateSources: ((candidateSourcesResult.data || []) as Array<Record<string, unknown>>).map(source => ({
      id: String(source.id),
      source: String(source.source || 'unknown'),
      stableSourceId: String(source.source_profile_id || ''),
      displayName: String(source.display_name || 'Source profile'),
      headline: stringOrNull(source.headline),
      location: stringOrNull(source.location),
      organization: stringOrNull(source.organization),
      profileUrl: stringOrNull(source.profile_url),
      status: String(source.status || 'active'),
      lastSeenAt: stringOrNull(source.last_seen_at),
    })),
    candidateClaims: ((claimsResult.data || []) as Array<Record<string, unknown>>).map(claim => ({
      id: String(claim.id),
      fieldName: String(claim.field_name || ''),
      value: claim.value_json !== null && claim.value_json !== undefined ? claim.value_json : claim.claimed_value,
      normalizedValue: stringOrNull(claim.normalized_value),
      evidenceClass: String(claim.evidence_class || 'unknown'),
      lifecycleStatus: String(claim.lifecycle_status || 'unresolved'),
      reviewerStatus: String(claim.reviewer_status || 'unreviewed'),
      source: String(claim.source || 'unknown'),
      sourceType: String(claim.source_type || 'unknown'),
      observedAt: stringOrNull(claim.observed_at),
      retrievedAt: String(claim.retrieved_at || ''),
      freshnessScore: numberOrNull(claim.freshness_score) || 0,
      sourceReliability: numberOrNull(claim.source_reliability) || 0,
      corroborationCount: numberOrNull(claim.corroboration_count) || 0,
    })),
    snapshotCount: snapshotCountResult.count || 0,
  }
}
