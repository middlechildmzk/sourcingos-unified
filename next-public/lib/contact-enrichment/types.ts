// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/types.ts — Contact enrichment provider type contracts.
//
// COMPLIANCE INVARIANTS:
//   - Every raw ContactSignal defaults to verified: false
//   - Every ContactSignal defaults to permissionStatus: 'unknown'
//   - Provider name is always logged on each signal
//   - Contact validity never implies permission to contact
//   - No protected-trait fields exist in any type
// ─────────────────────────────────────────────────────────────────────────────

export type ContactSignalType =
  | 'email'
  | 'phone'
  | 'profile_url'
  | 'social_url'
  | 'company_domain'
  | 'unknown'

export type ContactConfidence = 'low' | 'medium' | 'high'

export type ContactOwnershipConfidence =
  | 'deterministic'
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'unknown'

export type ContactDeliverabilityStatus =
  | 'verified'
  | 'valid'
  | 'accept_all'
  | 'risky'
  | 'unknown'
  | 'invalid'
  | 'disconnected'

export type PermissionStatus =
  | 'unknown'
  | 'do_not_contact'
  | 'user_verified_permission'

/** Identifier for a contact enrichment provider. */
export type ContactEnrichmentProvider =
  | 'people_data_labs'
  | 'data_vertex'
  | 'pearch'
  | 'coresignal'
  | 'contactout'
  | 'signalhire'
  | 'anymail_finder'
  | 'tomba'
  | 'openweb_ninja'
  | 'hunter'
  | 'apollo'
  | 'none'

/** Whether a provider is wired and ready to call. */
export interface ProviderStatus {
  provider: ContactEnrichmentProvider
  providerConfigured: boolean
  /** UI-safe explanation when not configured. Never contains secrets. */
  message: string
}

/**
 * Inputs used to request enrichment. Built from candidate/source-profile data.
 * No protected-trait fields. Professional data only.
 */
export interface ContactEnrichmentRequest {
  candidateId?: string
  sourceProfileId?: string
  /** Provider-native person id only when its provider is known. */
  providerPersonId?: string
  providerName?: ContactEnrichmentProvider
  firstName?: string
  lastName?: string
  fullName?: string
  currentCompany?: string
  companyDomain?: string
  location?: string
  title?: string
  profileUrl?: string
  linkedinUrl?: string
  githubUrl?: string
  /** Existing email when the requested purpose is verification/enrichment. */
  email?: string
  /** Free-form context describing where the lead came from (for logging). */
  sourceContext?: string
}

/**
 * Safe provider-level identity-match metadata. This intentionally preserves only
 * the information SourcingOS needs for identity provenance; full raw provider
 * payloads are not part of the normalized contract.
 */
export interface ProviderMatchMetadata {
  matchState: 'exact_anchor' | 'strong' | 'possible' | 'no_match' | 'conflict' | 'unknown'
  providerPersonId?: string
  providerScore?: number
  providerScoreScale?: string
  matchedOn: string[]
}

/**
 * A single discovered contact signal.
 * GUARDRAIL: verified defaults to false, permissionStatus to 'unknown'.
 * Ownership, deliverability, and permission are separate dimensions.
 */
export interface ContactSignal {
  type: ContactSignalType
  value: string
  sourceProvider: ContactEnrichmentProvider
  confidence: ContactConfidence
  /** Legacy compatibility flag. Raw lookup helpers still default this to false. */
  verified: boolean
  /** ALWAYS 'unknown' until a recruiter establishes permission. */
  permissionStatus: PermissionStatus
  /** Whether this channel appears to belong to the resolved person. */
  ownershipConfidence?: ContactOwnershipConfidence
  /** Technical channel validity/deliverability. Never implies permission. */
  deliverability?: ContactDeliverabilityStatus
  /** Provider-native status retained in normalized form when useful. */
  providerStatusRaw?: string
  discoveredAt: string
  /** Optional provider-specific reference (never the full raw payload). */
  rawSource?: string
  notes?: string
}

/**
 * Result of an enrichment attempt. Safe to return to the client.
 * Never contains API keys or full raw provider payloads with sensitive data.
 */
export interface ContactEnrichmentResult {
  provider: ContactEnrichmentProvider
  providerConfigured: boolean
  /** UI-safe status message. */
  message: string
  signals: ContactSignal[]
  /** Safe identity-match metadata when the provider exposes it. */
  match?: ProviderMatchMetadata
  /** Audit metadata — safe to log and surface. */
  log: ContactEnrichmentLog
}

/** Lightweight audit log — never includes API key or sensitive raw payload. */
export interface ContactEnrichmentLog {
  provider: ContactEnrichmentProvider
  attemptedAt: string
  /** Which request fields were actually sent to the provider. */
  fieldsUsed: string[]
  resultCount: number
  warnings: string[]
  /** How any persistence was handled. */
  persistenceMode: 'none' | 'supabase' | 'preview'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Construct a compliant ContactSignal with guardrail defaults applied. */
export function makeContactSignal(params: {
  type: ContactSignalType
  value: string
  sourceProvider: ContactEnrichmentProvider
  confidence?: ContactConfidence
  ownershipConfidence?: ContactOwnershipConfidence
  deliverability?: ContactDeliverabilityStatus
  providerStatusRaw?: string
  rawSource?: string
  notes?: string
}): ContactSignal {
  return {
    type: params.type,
    value: params.value,
    sourceProvider: params.sourceProvider,
    confidence: params.confidence ?? 'low',
    verified: false,
    permissionStatus: 'unknown',
    ownershipConfidence: params.ownershipConfidence,
    deliverability: params.deliverability,
    providerStatusRaw: params.providerStatusRaw,
    discoveredAt: new Date().toISOString(),
    rawSource: params.rawSource,
    notes: params.notes,
  }
}

/** True when a request has enough identity signal to attempt enrichment. */
export function hasSufficientEnrichmentInputs(req: ContactEnrichmentRequest): boolean {
  const hasName = Boolean(req.fullName || (req.firstName && req.lastName))
  const hasCompanyOrDomain = Boolean(req.currentCompany || req.companyDomain)
  const hasProfileUrl = Boolean(req.profileUrl || req.linkedinUrl || req.githubUrl)
  const hasProviderAnchor = Boolean(req.providerPersonId && req.providerName)
  return hasProviderAnchor || (hasName && (hasCompanyOrDomain || hasProfileUrl)) || hasProfileUrl || Boolean(req.email)
}

/** Which request fields are populated — for audit logging (no values, just keys). */
export function enrichmentFieldsUsed(req: ContactEnrichmentRequest): string[] {
  return Object.entries(req)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k]) => k)
}
