import 'server-only'
import type { ContactEnrichmentRequest, ContactEnrichmentResult, ContactSignal, ProviderMatchMetadata } from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'data_vertex' as const
const ENDPOINT = 'https://api.data-vertex.com/v1/lookup'

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.DATAVERTEX_API_KEY),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

export function canUseDataVertexLookupV36_8(request: ContactEnrichmentRequest): boolean {
  return Boolean(request.linkedinUrl || (request.providerName === PROVIDER && request.providerPersonId))
}

export function buildDataVertexLookupBodyV36_8(request: ContactEnrichmentRequest, purpose: 'identity_enrichment' | 'work_email_finder' | 'phone_enrichment') {
  const identifier = request.linkedinUrl
    ? { linkedin_url: request.linkedinUrl }
    : { candidate_id: request.providerPersonId }
  return {
    ...identifier,
    reveal_personal_email: purpose !== 'phone_enrichment',
    reveal_phone: purpose === 'phone_enrichment' || purpose === 'identity_enrichment',
    reveal_detailed_person_enrichment: purpose === 'identity_enrichment',
    reveal_healthcare_enrichment: false,
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function enrichWithDataVertexV36_8(
  request: ContactEnrichmentRequest,
  purpose: 'identity_enrichment' | 'work_email_finder' | 'phone_enrichment' = 'identity_enrichment',
): Promise<ContactEnrichmentResult> {
  const key = process.env.DATAVERTEX_API_KEY
  if (!key) return empty(request, 'DataVertex contact lookup is not configured.', ['DATAVERTEX_API_KEY not set.'])
  if (!canUseDataVertexLookupV36_8(request)) return empty(request, 'DataVertex requires a LinkedIn URL or a DataVertex provider person id.', ['No DataVertex-compatible deterministic lookup anchor.'])

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDataVertexLookupBodyV36_8(request, purpose)),
      cache: 'no-store',
    })
    if (response.status === 404) return empty(request, 'DataVertex did not find contact data for this candidate.')
    if (!response.ok) return empty(request, 'DataVertex contact lookup failed.', [`Provider status ${response.status}.`])

    const payload = await response.json() as Record<string, unknown>
    const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
    const contacts = Array.isArray(data.contacts) ? data.contacts : []
    const contact = contacts.find(item => item && typeof item === 'object' && (item as Record<string, unknown>).success === true) as Record<string, unknown> | undefined
    const profile = contact?.profile && typeof contact.profile === 'object' ? contact.profile as Record<string, unknown> : undefined
    if (!profile) return empty(request, 'DataVertex returned no successful candidate lookup.')

    const providerPersonId = str(profile.id)
    const match: ProviderMatchMetadata = {
      matchState: request.linkedinUrl || (request.providerName === PROVIDER && request.providerPersonId) ? 'exact_anchor' : 'unknown',
      ...(providerPersonId ? { providerPersonId } : {}),
      matchedOn: request.linkedinUrl ? ['linkedin_url'] : ['provider_person_id'],
    }
    const signals: ContactSignal[] = []
    const rawSource = providerPersonId ? `data_vertex_person:${providerPersonId}` : undefined
    const personalEmail = str(profile.personal_email)
    const phone = str(profile.phone_number)
    const linkedin = str(profile.linkedin_url)
    if (personalEmail) signals.push(makeContactSignal({ type: 'email', value: personalEmail, sourceProvider: PROVIDER, confidence: 'high', ownershipConfidence: 'deterministic', deliverability: 'unknown', rawSource, notes: 'DataVertex lookup returned this email for an anchored candidate. Provider validity does not imply outreach permission.' }))
    if (phone) signals.push(makeContactSignal({ type: 'phone', value: phone, sourceProvider: PROVIDER, confidence: 'high', ownershipConfidence: 'deterministic', deliverability: 'unknown', rawSource, notes: 'DataVertex lookup returned this phone for an anchored candidate. Permission remains unknown.' }))
    if (linkedin) signals.push(makeContactSignal({ type: 'social_url', value: linkedin, sourceProvider: PROVIDER, confidence: 'high', ownershipConfidence: 'deterministic', rawSource }))

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: signals.length ? `Found ${signals.length} anchored contact/profile signal${signals.length === 1 ? '' : 's'} via DataVertex.` : 'DataVertex matched the candidate but returned no requested contact signal.',
      signals,
      match,
      log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: signals.length, warnings: [], persistenceMode: 'none' },
    }
  } catch {
    return empty(request, 'Could not reach DataVertex contact lookup.', ['Network error reaching provider.'])
  }
}
