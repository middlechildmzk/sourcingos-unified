import 'server-only'
import type {
  ContactDeliverabilityStatus,
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ResolvedProfessionalPerson,
} from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'apollo' as const
const ENDPOINT = 'https://api.apollo.io/api/v1/people/match'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.APOLLO_API_KEY),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function nameParts(request: ContactEnrichmentRequest): { first?: string; last?: string } {
  if (request.firstName || request.lastName) return { first: request.firstName, last: request.lastName }
  const parts = (request.fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return {}
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function canUseApolloV36_16(request: ContactEnrichmentRequest): boolean {
  const sameProviderId = request.providerName === 'apollo' && Boolean(request.providerPersonId)
  const profile = request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
  const hasName = Boolean(request.fullName || (request.firstName && request.lastName))
  return sameProviderId || Boolean(profile || request.email || (hasName && (request.companyDomain || request.currentCompany)))
}

function deliverability(raw: unknown): ContactDeliverabilityStatus {
  const value = str(raw)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (value === 'verified' || value === 'valid') return 'verified'
  if (value === 'invalid') return 'invalid'
  if (value === 'accept_all' || value === 'catch_all') return 'accept_all'
  if (value === 'risky') return 'risky'
  return 'unknown'
}

function location(person: JsonRecord): string | undefined {
  return [str(person.city), str(person.state), str(person.country)].filter(Boolean).join(', ') || undefined
}

function resolvedPerson(person: JsonRecord): ResolvedProfessionalPerson | undefined {
  const name = str(person.name) || [str(person.first_name), str(person.last_name)].filter(Boolean).join(' ')
  if (!name) return undefined
  const organization = record(person.organization)
  const linkedin = str(person.linkedin_url)
  return {
    providerPersonId: str(person.id),
    displayName: name,
    currentTitle: str(person.title),
    currentEmployer: str(organization.name) || str(person.organization_name),
    location: location(person),
    skills: [],
    profileUrls: linkedin ? [{ kind: 'linkedin', url: linkedin }] : [],
  }
}

function personalEmails(person: JsonRecord): string[] {
  const raw = person.personal_emails
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.flatMap(item => {
    if (typeof item === 'string') return validEmail(item) ? [item] : []
    const row = record(item)
    const email = str(row.email) || str(row.value)
    return validEmail(email) ? [email] : []
  })))
}

export async function enrichWithApolloV36_16(
  request: ContactEnrichmentRequest,
  options: { revealPersonalEmail?: boolean } = {},
): Promise<ContactEnrichmentResult> {
  const key = process.env.APOLLO_API_KEY
  if (!key) return empty(request, 'Apollo is not configured.', ['APOLLO_API_KEY not set.'])
  if (!canUseApolloV36_16(request)) return empty(request, 'Apollo cannot enrich this candidate with the available identity anchors.')

  const body: Record<string, unknown> = {
    reveal_personal_emails: Boolean(options.revealPersonalEmail),
    reveal_phone_number: false,
  }
  const sameProviderId = request.providerName === 'apollo' ? request.providerPersonId : undefined
  const linkedin = request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
  const parts = nameParts(request)
  if (sameProviderId) body.id = sameProviderId
  else if (linkedin) body.linkedin_url = linkedin
  else if (request.email) body.email = request.email
  else {
    if (request.fullName) body.name = request.fullName
    else {
      if (parts.first) body.first_name = parts.first
      if (parts.last) body.last_name = parts.last
    }
    if (request.companyDomain) body.domain = request.companyDomain
    else if (request.currentCompany) body.organization_name = request.currentCompany
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) return empty(request, 'Apollo rejected the enrichment request.', ['Provider auth/scope error.'])
    if (response.status === 429) return empty(request, 'Apollo is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'Apollo enrichment failed.', [`Provider status ${response.status}.`])

    const payload = record(await response.json())
    const person = record(payload.person)
    if (!Object.keys(person).length) return empty(request, 'Apollo did not resolve a person from the supplied anchors.')

    const workEmail = str(person.email)
    const status = str(person.email_status)
    const personal = options.revealPersonalEmail ? personalEmails(person) : []
    const signals = []

    if (validEmail(workEmail)) {
      signals.push(makeContactSignal({
        type: 'email',
        channelKind: 'work_email',
        value: workEmail,
        sourceProvider: PROVIDER,
        confidence: deliverability(status) === 'verified' ? 'high' : 'medium',
        ownershipConfidence: sameProviderId || linkedin ? 'strong' : request.email ? 'deterministic' : 'moderate',
        deliverability: deliverability(status),
        providerStatusRaw: status,
        rawSource: 'apollo:people_match',
        notes: 'Apollo People Match work-email signal. Deliverability and permission to contact remain separate.',
      }))
    }

    for (const email of personal) {
      if (email.toLowerCase() === workEmail?.toLowerCase()) continue
      signals.push(makeContactSignal({
        type: 'email',
        channelKind: 'personal_email',
        value: email,
        sourceProvider: PROVIDER,
        confidence: 'medium',
        ownershipConfidence: sameProviderId || linkedin ? 'strong' : 'moderate',
        deliverability: 'unknown',
        rawSource: 'apollo:people_match:personal_email',
        notes: 'Apollo personal-email reveal. Finder result does not imply deliverability or permission to contact.',
      }))
    }

    const matchedOn = sameProviderId
      ? ['apollo_person_id']
      : linkedin
        ? ['linkedin_url']
        : request.email
          ? ['email']
          : request.companyDomain
            ? ['name+domain']
            : ['name+organization']

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: signals.length ? `Apollo returned ${signals.length} email signal${signals.length === 1 ? '' : 's'}.` : 'Apollo resolved the person but did not return a requested email signal.',
      signals,
      person: resolvedPerson(person),
      match: {
        matchState: sameProviderId || linkedin || request.email ? 'exact_anchor' : 'strong',
        providerPersonId: str(person.id),
        matchedOn,
      },
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: signals.length,
        warnings: ['Apollo phone reveal is asynchronous and is intentionally not invoked by this synchronous adapter.'],
        persistenceMode: 'none',
      },
    }
  } catch {
    return empty(request, 'Could not reach Apollo.', ['Network error reaching provider.'])
  }
}
