import 'server-only'
import type {
  ContactChannelKind,
  ContactConfidence,
  ContactDeliverabilityStatus,
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ContactSignal,
  ContactOwnershipConfidence,
} from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'lusha' as const
const BASE = 'https://api.lusha.com/v3'

type RevealGoal = 'emails' | 'phones'
type Lookup = {
  searchContact?: Record<string, unknown>
  directId?: string
  matchedOn: string[]
  ownership: ContactOwnershipConfidence
}

function key(): string | undefined {
  // LUSA_API_KEY is a compatibility alias for an easy-to-make legacy typo.
  return process.env.LUSHA_API_KEY?.trim() || process.env.LUSA_API_KEY?.trim() || undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrays(...values: unknown[]): Record<string, unknown>[] {
  for (const value of values) {
    if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  }
  return []
}

function validHttp(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function linkedin(request: ContactEnrichmentRequest): string | undefined {
  const direct = validHttp(request.linkedinUrl)
  if (direct?.includes('linkedin.com/')) return direct
  const profile = validHttp(request.profileUrl)
  return profile?.includes('linkedin.com/') ? profile : undefined
}

function splitName(request: ContactEnrichmentRequest): { firstName?: string; lastName?: string } {
  if (request.firstName || request.lastName) return { firstName: request.firstName, lastName: request.lastName }
  const parts = str(request.fullName)?.split(/\s+/).filter(Boolean) || []
  if (parts.length < 2) return {}
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function lookup(request: ContactEnrichmentRequest): Lookup | undefined {
  if (request.providerName === PROVIDER && request.providerPersonId) {
    return { directId: request.providerPersonId.trim(), matchedOn: ['provider_person_id'], ownership: 'deterministic' }
  }
  const linkedinUrl = linkedin(request)
  if (linkedinUrl) {
    return { searchContact: { clientReferenceId: 'sourcingos-1', linkedinUrl }, matchedOn: ['linkedin_url'], ownership: 'deterministic' }
  }
  if (request.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
    return { searchContact: { clientReferenceId: 'sourcingos-1', email: request.email.trim() }, matchedOn: ['email'], ownership: 'deterministic' }
  }
  const name = splitName(request)
  if (name.firstName && name.lastName && (request.companyDomain || request.currentCompany)) {
    return {
      searchContact: {
        clientReferenceId: 'sourcingos-1',
        firstName: name.firstName,
        lastName: name.lastName,
        ...(request.companyDomain ? { companyDomain: request.companyDomain } : {}),
        ...(!request.companyDomain && request.currentCompany ? { companyName: request.currentCompany } : {}),
      },
      matchedOn: request.companyDomain ? ['name', 'company_domain'] : ['name', 'company_name'],
      ownership: 'strong',
    }
  }
  return undefined
}

export function canUseLushaV36_16(request: ContactEnrichmentRequest): boolean {
  return Boolean(lookup(request))
}

export function buildLushaSearchBodyV36_16(request: ContactEnrichmentRequest) {
  const resolved = lookup(request)
  return resolved?.searchContact ? {
    contacts: [resolved.searchContact],
    options: { includePartialProfiles: true },
  } : undefined
}

export function buildLushaEnrichBodyV36_16(ids: string[], reveal: RevealGoal[]) {
  // Deliberately do not pass waterfallReveal. SourcingOS owns cross-provider
  // ordering, spend, and provenance instead of nesting an opaque provider waterfall.
  return { ids, reveal }
}

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(key()),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function contactRows(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = record(payload.data)
  const rows = arrays(payload.contacts, payload.results, data.contacts, data.results)
  if (rows.length) return rows
  const contact = record(payload.contact)
  if (Object.keys(contact).length) return [contact]
  if (Object.keys(data).some(key => ['id', 'contactId', 'emails', 'phones'].includes(key))) return [data]
  return []
}

function providerId(row: Record<string, unknown>): string | undefined {
  return str(row.id) || str(row.contactId) || str(row.contact_id) || str(record(row.contact).id)
}

function searchResolvedId(payload: Record<string, unknown>): string | undefined {
  const ids = Array.from(new Set(contactRows(payload).map(providerId).filter(Boolean) as string[]))
  return ids.length === 1 ? ids[0] : undefined
}

function emailKind(value: unknown): ContactChannelKind {
  const type = String(value || '').toLowerCase()
  if (/work|business|professional|corporate/.test(type)) return 'work_email'
  if (/personal|private/.test(type)) return 'personal_email'
  return 'other_email'
}

function phoneKind(value: unknown): ContactChannelKind {
  const type = String(value || '').toLowerCase()
  if (/mobile|cell/.test(type)) return 'mobile_phone'
  if (/work|office|business|professional/.test(type)) return 'work_phone'
  if (/home|residential/.test(type)) return 'home_phone'
  return 'other_phone'
}

function confidence(value: unknown): ContactConfidence {
  const raw = String(value || '').toLowerCase()
  const numeric = typeof value === 'number' ? value : Number(value)
  if (/high|verified/.test(raw) || (Number.isFinite(numeric) && numeric >= 80)) return 'high'
  if (/medium|valid/.test(raw) || (Number.isFinite(numeric) && numeric >= 50)) return 'medium'
  return 'low'
}

function deliverability(value: unknown): ContactDeliverabilityStatus {
  const raw = String(value || '').toLowerCase()
  if (/verified/.test(raw)) return 'verified'
  if (/valid/.test(raw)) return 'valid'
  if (/accept.?all|catch.?all/.test(raw)) return 'accept_all'
  if (/risky|risk/.test(raw)) return 'risky'
  if (/invalid/.test(raw)) return 'invalid'
  return 'unknown'
}

function signalsFromContact(row: Record<string, unknown>, ownership: ContactOwnershipConfidence, id?: string): ContactSignal[] {
  const signals: ContactSignal[] = []
  const emailRows = arrays(row.emails, record(row.contact).emails)
  for (const emailRow of emailRows) {
    const value = str(emailRow.email) || str(emailRow.value) || str(emailRow.address)
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue
    signals.push(makeContactSignal({
      type: 'email',
      channelKind: emailKind(emailRow.type),
      value,
      sourceProvider: PROVIDER,
      confidence: confidence(emailRow.confidence),
      ownershipConfidence: ownership,
      deliverability: deliverability(emailRow.status || emailRow.deliverability || emailRow.confidence),
      providerStatusRaw: str(emailRow.status) || str(emailRow.confidence),
      rawSource: id ? `lusha:${id}` : 'lusha:contact',
      notes: 'Lusha V3 contact observation. Provider validity does not imply permission to contact.',
    }))
  }

  const phoneRows = arrays(row.phones, row.phoneNumbers, record(row.contact).phones)
  for (const phoneRow of phoneRows) {
    const value = str(phoneRow.number) || str(phoneRow.phone) || str(phoneRow.value)
    if (!value) continue
    const base = makeContactSignal({
      type: 'phone',
      channelKind: phoneKind(phoneRow.type),
      value,
      sourceProvider: PROVIDER,
      confidence: confidence(phoneRow.confidence),
      ownershipConfidence: ownership,
      deliverability: 'unknown',
      providerStatusRaw: phoneRow.doNotCall === true ? 'do_not_call' : str(phoneRow.status),
      rawSource: id ? `lusha:${id}` : 'lusha:contact',
      notes: phoneRow.doNotCall === true
        ? 'Lusha returned this phone with do-not-call status. Preserve for provenance; do not use for outreach.'
        : 'Lusha V3 phone observation. Permission remains unknown.',
    })
    signals.push(phoneRow.doNotCall === true ? { ...base, permissionStatus: 'do_not_contact' } : base)
  }
  return signals
}

async function resolveId(request: ContactEnrichmentRequest, resolved: Lookup, apiKey: string): Promise<{ id?: string; warnings: string[] }> {
  if (resolved.directId) return { id: resolved.directId, warnings: [] }
  if (!resolved.searchContact) return { warnings: ['No Lusha search identifier was available.'] }
  const response = await fetch(`${BASE}/contacts/search`, {
    method: 'POST',
    headers: { api_key: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ contacts: [resolved.searchContact], options: { includePartialProfiles: true } }),
    cache: 'no-store',
  })
  if (!response.ok) return { warnings: [`Lusha contact search returned HTTP ${response.status}.`] }
  const payload = await response.json() as Record<string, unknown>
  const id = searchResolvedId(payload)
  return id ? { id, warnings: [] } : { warnings: ['Lusha search did not resolve exactly one provider contact ID; SourcingOS did not reveal contact data.'] }
}

export async function enrichWithLushaV36_16(
  request: ContactEnrichmentRequest,
  options: { revealEmails: boolean; revealPhones: boolean },
): Promise<ContactEnrichmentResult> {
  const apiKey = key()
  const resolved = lookup(request)
  if (!apiKey) return empty(request, 'Lusha is not configured.', ['LUSHA_API_KEY is not set.'])
  if (!resolved) return empty(request, 'Lusha requires a same-provider contact ID, LinkedIn URL, exact email, or name plus company/domain anchor.')
  const reveal: RevealGoal[] = [
    ...(options.revealEmails ? ['emails' as const] : []),
    ...(options.revealPhones ? ['phones' as const] : []),
  ]
  if (!reveal.length) return empty(request, 'No Lusha contact channel was requested.')

  try {
    const idResolution = await resolveId(request, resolved, apiKey)
    if (!idResolution.id) return empty(request, 'Lusha could not resolve a unique contact before reveal.', idResolution.warnings)

    const response = await fetch(`${BASE}/contacts/enrich`, {
      method: 'POST',
      headers: { api_key: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildLushaEnrichBodyV36_16([idResolution.id], reveal)),
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) return empty(request, 'Lusha rejected the enrichment request.', ['Provider authentication/entitlement error.'])
    if (response.status === 402) return empty(request, 'Lusha credits are unavailable.', ['Provider credits/entitlement unavailable.'])
    if (response.status === 429) return empty(request, 'Lusha is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'Lusha enrichment failed.', [`Provider status ${response.status}.`])

    const payload = await response.json() as Record<string, unknown>
    const rows = contactRows(payload)
    const row = rows.find(item => providerId(item) === idResolution.id) || (rows.length === 1 ? rows[0] : undefined)
    if (!row) return empty(request, 'Lusha returned no uniquely attributable enriched contact.', ['No unique enriched contact row.'])
    const signals = signalsFromContact(row, resolved.ownership, idResolution.id)
    const unique = Array.from(new Map(signals.map(signal => [`${signal.type}:${signal.value.toLowerCase()}`, signal])).values())

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: unique.length ? `Lusha returned ${unique.length} contact signal${unique.length === 1 ? '' : 's'}.` : 'Lusha resolved the contact but returned no usable requested channel.',
      signals: unique,
      match: {
        matchState: resolved.ownership === 'deterministic' ? 'exact_anchor' : 'strong',
        providerPersonId: idResolution.id,
        matchedOn: resolved.matchedOn,
      },
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: unique.length,
        warnings: ['SourcingOS intentionally does not request Lusha Waterfall Reveal in this adapter. Cross-provider ordering, spend, and provenance remain controlled by the SourcingOS waterfall.'],
        persistenceMode: 'none',
      },
    }
  } catch {
    return empty(request, 'Could not reach Lusha.', ['Network error reaching provider.'])
  }
}
