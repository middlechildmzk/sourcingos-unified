// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/types.ts — Contact enrichment provider type contracts.
//
// FOUNDATION ONLY (Sprint 2.7 prep). No live provider calls in this sprint.
//
// COMPLIANCE INVARIANTS (enforced at the type level):
//   - Every ContactSignal defaults to verified: false
//   - Every ContactSignal defaults to permissionStatus: 'unknown'
//   - Provider name is always logged on each signal
//   - Nothing here implies permission to contact anyone
//   - No protected-trait fields exist in any type
//
// Future Sprint 2.8 will add:
//   - lib/contact-enrichment/providers/people-data-labs.ts (live adapter)
//   - app/api/contact-enrichment/find/route.ts (server-side, auth-gated)
//   - server-only PDL_API_KEY
//   - persistence into candidate_contacts (verified=false, permission unknown)
// ─────────────────────────────────────────────────────────────────────────────

export type ContactSignalType =
  | 'email'
  | 'phone'
  | 'profile_url'
  | 'social_url'
  | 'company_domain'
  | 'unknown'

export type ContactConfidence = 'low' | 'medium' | 'high'

export type PermissionStatus =
  | 'unknown'                    // default — no permission established
  | 'do_not_contact'             // explicitly flagged do-not-contact
  | 'user_verified_permission'   // recruiter has confirmed permission to contact

/** Identifier for a contact enrichment provider. */
export type ContactEnrichmentProvider =
  | 'people_data_labs'
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
  /** Free-form context describing where the lead came from (for logging). */
  sourceContext?: string
}

/**
 * A single discovered contact signal.
 * GUARDRAIL: verified defaults to false, permissionStatus to 'unknown'.
 */
export interface ContactSignal {
  type: ContactSignalType
  value: string
  sourceProvider: ContactEnrichmentProvider
  confidence: ContactConfidence
  /** ALWAYS false unless a provider explicitly verifies — never implies permission. */
  verified: boolean
  /** ALWAYS 'unknown' until a recruiter establishes permission. */
  permissionStatus: PermissionStatus
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
  /** How any persistence was handled: 'none' in stub/preview, 'supabase' in 2.8. */
  persistenceMode: 'none' | 'supabase' | 'preview'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Construct a compliant ContactSignal with guardrail defaults applied. */
export function makeContactSignal(params: {
  type: ContactSignalType
  value: string
  sourceProvider: ContactEnrichmentProvider
  confidence?: ContactConfidence
  rawSource?: string
  notes?: string
}): ContactSignal {
  return {
    type: params.type,
    value: params.value,
    sourceProvider: params.sourceProvider,
    confidence: params.confidence ?? 'low',
    verified: false,                  // INVARIANT — never true from a raw lookup
    permissionStatus: 'unknown',      // INVARIANT — never implies permission
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
  // Need a name plus at least one disambiguator, OR a strong profile URL
  return (hasName && (hasCompanyOrDomain || hasProfileUrl)) || hasProfileUrl
}

/** Which request fields are populated — for audit logging (no values, just keys). */
export function enrichmentFieldsUsed(req: ContactEnrichmentRequest): string[] {
  return Object.entries(req)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k]) => k)
}
