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

/** Provider-labeled channel semantics. Never infer personal/mobile from syntax. */
export type ContactChannelKind =
  | 'work_email'
  | 'personal_email'
  | 'other_email'
  | 'mobile_phone'
  | 'work_phone'
  | 'home_phone'
  | 'other_phone'
  | 'professional_profile'
  | 'social_profile'
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
  | 'lusha'
  | 'wiza'
  | 'fullenrich'
  | 'coldiq'
  | 'none'

export interface ProviderStatus {
  provider: ContactEnrichmentProvider
  providerConfigured: boolean
  message: string
}

export interface ContactEnrichmentRequest {
  candidateId?: string
  sourceProfileId?: string
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
  email?: string
  phone?: string
  sourceContext?: string
}

export interface ProviderMatchMetadata {
  matchState: 'exact_anchor' | 'strong' | 'possible' | 'no_match' | 'conflict' | 'unknown'
  providerPersonId?: string
  providerScore?: number
  providerScoreScale?: string
  matchedOn: string[]
}

export type ResolvedProfessionalProfileUrl = {
  kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'
  url: string
}

export interface ResolvedProfessionalPerson {
  providerPersonId?: string
  displayName: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: ResolvedProfessionalProfileUrl[]
}

export interface ContactSignal {
  type: ContactSignalType
  /** Optional provider-supported semantic subtype such as work_email/mobile_phone. */
  channelKind?: ContactChannelKind
  value: string
  sourceProvider: ContactEnrichmentProvider
  confidence: ContactConfidence
  verified: boolean
  permissionStatus: PermissionStatus
  ownershipConfidence?: ContactOwnershipConfidence
  deliverability?: ContactDeliverabilityStatus
  providerStatusRaw?: string
  discoveredAt: string
  rawSource?: string
  notes?: string
}

export interface ContactEnrichmentResult {
  provider: ContactEnrichmentProvider
  providerConfigured: boolean
  message: string
  signals: ContactSignal[]
  match?: ProviderMatchMetadata
  person?: ResolvedProfessionalPerson
  log: ContactEnrichmentLog
}

export interface ContactEnrichmentLog {
  provider: ContactEnrichmentProvider
  attemptedAt: string
  fieldsUsed: string[]
  resultCount: number
  warnings: string[]
  persistenceMode: 'none' | 'supabase' | 'preview'
}

export function makeContactSignal(params: {
  type: ContactSignalType
  channelKind?: ContactChannelKind
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
    channelKind: params.channelKind,
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

export function hasSufficientEnrichmentInputs(req: ContactEnrichmentRequest): boolean {
  const hasName = Boolean(req.fullName || (req.firstName && req.lastName))
  const hasCompanyOrDomain = Boolean(req.currentCompany || req.companyDomain)
  const hasProfileUrl = Boolean(req.profileUrl || req.linkedinUrl || req.githubUrl)
  const hasProviderAnchor = Boolean(req.providerPersonId && req.providerName)
  return hasProviderAnchor || (hasName && (hasCompanyOrDomain || hasProfileUrl)) || hasProfileUrl || Boolean(req.email || req.phone)
}

export function enrichmentFieldsUsed(req: ContactEnrichmentRequest): string[] {
  return Object.entries(req)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k]) => k)
}
