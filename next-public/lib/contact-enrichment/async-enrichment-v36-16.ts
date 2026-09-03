import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { ContactEnrichmentRequest, ContactSignal, ContactDeliverabilityStatus } from './types'
import { makeContactSignal } from './types'
import type { ContactResolutionGoalV36_12 } from './orchestrator-v35'

export type AsyncContactProviderV36_16 = 'wiza' | 'apollo' | 'fullenrich' | 'coldiq'
export type AsyncContactJobStatusV36_16 = 'queued' | 'running' | 'completed' | 'exhausted' | 'failed' | 'canceled'

export type AsyncProviderAttemptV36_16 = {
  provider: AsyncContactProviderV36_16
  state: 'queued' | 'waiting_webhook' | 'completed' | 'miss' | 'failed'
  startedAt: string
  completedAt?: string
  providerRequestId?: string
  estimatedCredits: number
  actualCredits?: number
  underlyingProvider?: string
  resultCount?: number
  warnings?: string[]
}

export type AsyncProviderLaunchV36_16 = {
  provider: AsyncContactProviderV36_16
  providerRequestId?: string
  estimatedCredits: number
  actualCredits?: number
  underlyingProvider?: string
  signals: ContactSignal[]
  completedSynchronously: boolean
  warning?: string
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function validEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function validPhone(value: string | undefined): value is string {
  return Boolean(value && value.replace(/\D/g, '').length >= 7)
}

function nameParts(request: ContactEnrichmentRequest): { first?: string; last?: string } {
  if (request.firstName || request.lastName) return { first: request.firstName, last: request.lastName }
  const parts = (request.fullName || '').trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 ? { first: parts[0], last: parts.slice(1).join(' ') } : {}
}

function linkedinUrl(request: ContactEnrichmentRequest): string | undefined {
  if (request.linkedinUrl) return request.linkedinUrl
  if (request.profileUrl?.includes('linkedin.com/')) return request.profileUrl
  return undefined
}

function deliverability(raw: unknown): ContactDeliverabilityStatus {
  const value = str(raw)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (!value) return 'unknown'
  if (['deliverable', 'verified', 'valid', 'valid_number', 'found'].includes(value)) return 'verified'
  if (['catch_all', 'accept_all', 'high_probability', 'high_prob'].includes(value)) return 'accept_all'
  if (['risky', 'low_probability'].includes(value)) return 'risky'
  if (['invalid', 'invalid_number', 'undeliverable'].includes(value)) return 'invalid'
  if (['disconnected'].includes(value)) return 'disconnected'
  return 'unknown'
}

export function createAsyncCallbackTokenV36_16(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex')
  return { token, hash: createHash('sha256').update(token).digest('hex') }
}

export function hashAsyncCallbackTokenV36_16(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyAsyncCallbackTokenV36_16(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashAsyncCallbackTokenV36_16(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function verifyWizaWebhookAuthV36_16(headerValue: string | null): boolean {
  const key = process.env.WIZA_API_KEY
  if (!key || !headerValue) return false
  const expected = createHash('sha256').update(key).digest('hex')
  const actual = headerValue.trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(actual)) return false
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

export function publicAppBaseUrlV36_16(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  return 'https://getsourcingos.com'
}

export function asyncCallbackUrlV36_16(provider: AsyncContactProviderV36_16, jobId: string, token: string): string {
  const url = new URL(`/api/contact-enrichment/webhooks/${provider}`, publicAppBaseUrlV36_16())
  url.searchParams.set('job', jobId)
  url.searchParams.set('token', token)
  return url.toString()
}

export function configuredAsyncProviderChainV36_16(goals: ContactResolutionGoalV36_12[]): AsyncContactProviderV36_16[] {
  const unique = Array.from(new Set(goals))
  const chain: AsyncContactProviderV36_16[] = []
  if (process.env.WIZA_API_KEY?.trim()) chain.push('wiza')
  if (unique.includes('phone') && process.env.APOLLO_API_KEY?.trim()) chain.push('apollo')
  if (process.env.FULLENRICH_API_KEY?.trim()) chain.push('fullenrich')
  if (process.env.COLDIQ_API_KEY?.trim() && unique.some(goal => goal === 'work_email' || goal === 'phone')) chain.push('coldiq')
  return chain
}

export function providerCanPursueGoalsV36_16(provider: AsyncContactProviderV36_16, goals: ContactResolutionGoalV36_12[]): boolean {
  if (provider === 'apollo') return goals.includes('phone')
  if (provider === 'coldiq') return goals.some(goal => goal === 'work_email' || goal === 'phone')
  return goals.length > 0
}

export function estimatedProviderCreditsV36_16(provider: AsyncContactProviderV36_16, goals: ContactResolutionGoalV36_12[]): number {
  if (provider === 'wiza') return (goals.some(goal => goal === 'work_email' || goal === 'personal_email') ? 2 : 0) + (goals.includes('phone') ? 5 : 0)
  if (provider === 'apollo') return goals.includes('phone') ? 8 : 0
  if (provider === 'fullenrich') return (goals.includes('work_email') ? 1 : 0) + (goals.includes('personal_email') ? 3 : 0) + (goals.includes('phone') ? 10 : 0)
  if (provider === 'coldiq') return Math.min(5, Math.max(1, goals.filter(goal => goal !== 'personal_email').length * 2))
  return 0
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

export function normalizeWizaWebhookV36_16(payload: unknown): { signals: ContactSignal[]; actualCredits?: number } {
  const root = record(payload)
  const data = record(root.data && typeof root.data === 'object' ? root.data : root)
  const signals: ContactSignal[] = []
  const emails = array(data.emails)
  if (!emails.length && str(data.email)) emails.push({ email: data.email, email_type: data.email_type, email_status: data.email_status })
  for (const item of emails) {
    const row = record(item)
    const email = str(row.email) || str(row.value)
    if (!validEmail(email)) continue
    const kindRaw = str(row.email_type)?.toLowerCase()
    const channelKind = kindRaw === 'personal' ? 'personal_email' : kindRaw === 'work' || kindRaw === 'professional' ? 'work_email' : 'other_email'
    const status = str(row.email_status) || str(row.status)
    signals.push(makeContactSignal({
      type: 'email', channelKind, value: email, sourceProvider: 'wiza',
      confidence: deliverability(status) === 'verified' ? 'high' : 'medium',
      ownershipConfidence: 'strong', deliverability: deliverability(status), providerStatusRaw: status,
      rawSource: 'wiza:individual_reveal', notes: 'Wiza individual-reveal contact observation. Finder result does not imply permission to contact.',
    }))
  }
  const phones = array(data.phones)
  if (!phones.length) {
    if (str(data.mobile_phone)) phones.push({ number: data.mobile_phone, type: 'mobile' })
    else if (str(data.phone_number)) phones.push({ number: data.phone_number, type: 'other' })
  }
  for (const item of phones) {
    const row = record(item)
    const phone = str(row.number) || str(row.phone) || str(row.value)
    if (!validPhone(phone)) continue
    const type = str(row.type)?.toLowerCase()
    signals.push(makeContactSignal({
      type: 'phone', channelKind: type === 'mobile' ? 'mobile_phone' : 'other_phone', value: phone, sourceProvider: 'wiza',
      confidence: 'high', ownershipConfidence: 'strong', deliverability: 'unknown', providerStatusRaw: str(data.phone_status) || str(row.status),
      rawSource: 'wiza:individual_reveal', notes: 'Wiza phone reveal observation. Phone ownership and permission to contact remain separate.',
    }))
  }
  const credits = record(data.credits)
  const apiCredits = record(credits.api_credits)
  return { signals: dedupeSignals(signals), actualCredits: num(apiCredits.total) }
}

export function normalizeFullEnrichWebhookV36_16(payload: unknown): { signals: ContactSignal[]; actualCredits?: number } {
  const root = record(payload)
  const first = record(array(root.data)[0])
  const info = record(first.contact_info)
  const signals: ContactSignal[] = []
  const addEmails = (items: unknown[], kind: 'work_email' | 'personal_email') => {
    for (const item of items) {
      const row = record(item)
      const email = str(row.email) || str(row.value)
      if (!validEmail(email)) continue
      const status = str(row.status)
      signals.push(makeContactSignal({
        type: 'email', channelKind: kind, value: email, sourceProvider: 'fullenrich',
        confidence: deliverability(status) === 'verified' ? 'high' : 'medium', ownershipConfidence: 'strong',
        deliverability: deliverability(status), providerStatusRaw: status, rawSource: 'fullenrich:v2:contact_enrich',
        notes: 'FullEnrich waterfall contact observation. Provider verification and permission to contact remain separate.',
      }))
    }
  }
  const work = array(info.work_emails)
  if (!work.length && record(info.most_probable_work_email).email) work.push(info.most_probable_work_email)
  const personal = array(info.personal_emails)
  if (!personal.length && record(info.most_probable_personal_email).email) personal.push(info.most_probable_personal_email)
  addEmails(work, 'work_email')
  addEmails(personal, 'personal_email')
  const phones = array(info.phones)
  if (!phones.length && record(info.most_probable_phone).number) phones.push(info.most_probable_phone)
  for (const item of phones) {
    const row = record(item)
    const phone = str(row.number) || str(row.value)
    if (!validPhone(phone)) continue
    signals.push(makeContactSignal({
      type: 'phone', channelKind: 'mobile_phone', value: phone, sourceProvider: 'fullenrich',
      confidence: 'high', ownershipConfidence: 'strong', deliverability: 'unknown', rawSource: 'fullenrich:v2:contact_enrich',
      notes: 'FullEnrich personal-phone observation. Finder result does not imply permission to contact.',
    }))
  }
  return { signals: dedupeSignals(signals), actualCredits: num(record(root.cost).credits) }
}

export function normalizeApolloPhoneWebhookV36_16(payload: unknown): { signals: ContactSignal[]; actualCredits?: number } {
  const root = record(payload)
  const signals: ContactSignal[] = []
  for (const personItem of array(root.people)) {
    const person = record(personItem)
    for (const item of array(person.phone_numbers)) {
      const row = record(item)
      const phone = str(row.sanitized_number) || str(row.raw_number)
      if (!validPhone(phone)) continue
      const type = str(row.type_cd)?.toLowerCase()
      const status = str(row.status_cd)
      const dnc = str(row.dnc_status_cd)?.toLowerCase()
      const permissionStatus = dnc && !['not_found', 'unknown', 'none'].includes(dnc) ? 'do_not_contact' : 'unknown'
      const signal = makeContactSignal({
        type: 'phone', channelKind: type === 'mobile' ? 'mobile_phone' : type === 'work_direct' ? 'work_phone' : 'other_phone',
        value: phone, sourceProvider: 'apollo', confidence: str(row.confidence_cd)?.toLowerCase() === 'high' ? 'high' : 'medium',
        ownershipConfidence: 'strong', deliverability: deliverability(status), providerStatusRaw: status,
        rawSource: 'apollo:people_match:phone_webhook', notes: 'Apollo asynchronous phone observation. DNC status is preserved independently from validity.',
      })
      signal.permissionStatus = permissionStatus
      signals.push(signal)
    }
  }
  return { signals: dedupeSignals(signals), actualCredits: num(root.credits_consumed) }
}

function extractColdIqMeta(payload: JsonRecord): { underlyingProvider?: string; actualCredits?: number } {
  const meta = record(payload._meta)
  const provider = str(meta.provider) || str(meta.provider_used) || str(meta.source) || str(record(meta.result).provider)
  const credits = num(meta.credits_consumed) ?? num(meta.credits) ?? num(meta.cost) ?? num(record(meta.usage).credits)
  return { underlyingProvider: provider, actualCredits: credits }
}

function coldIqInput(request: ContactEnrichmentRequest): JsonRecord {
  const parts = nameParts(request)
  return {
    ...(parts.first ? { first_name: parts.first } : {}),
    ...(parts.last ? { last_name: parts.last } : {}),
    ...(request.companyDomain ? { domain: request.companyDomain } : {}),
    ...(request.currentCompany ? { company_name: request.currentCompany } : {}),
    ...(linkedinUrl(request) ? { linkedin_url: linkedinUrl(request) } : {}),
  }
}

async function coldIqCall(endpoint: 'email/find' | 'phone/find', request: ContactEnrichmentRequest, maxCredits: number): Promise<{ payload: JsonRecord; meta: { underlyingProvider?: string; actualCredits?: number } }> {
  const key = process.env.COLDIQ_API_KEY
  if (!key) throw new Error('ColdIQ is not configured.')
  const response = await fetch(`https://api.coldiq.com/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ input: coldIqInput(request), provider: 'auto', max_credits: maxCredits, resolve_current_employer: false }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`ColdIQ ${endpoint} returned ${response.status}.`)
  const payload = record(await response.json())
  return { payload, meta: extractColdIqMeta(payload) }
}

function normalizeColdIqEmail(payload: JsonRecord, underlyingProvider?: string): ContactSignal[] {
  const data = record(payload.data)
  const result = record(payload.result)
  const email = str(payload.email) || str(data.email) || str(result.email) || str(record(data.result).email)
  if (!validEmail(email)) return []
  const status = str(payload.status) || str(data.status) || str(result.status)
  return [makeContactSignal({
    type: 'email', channelKind: 'work_email', value: email, sourceProvider: 'coldiq', confidence: deliverability(status) === 'verified' ? 'high' : 'medium',
    ownershipConfidence: 'moderate', deliverability: deliverability(status), providerStatusRaw: status,
    rawSource: `coldiq:email_find${underlyingProvider ? `:${underlyingProvider}` : ''}`,
    notes: `ColdIQ brokered work-email observation${underlyingProvider ? ` via ${underlyingProvider}` : ''}. Broker provenance does not imply SourcingOS verification.`,
  })]
}

function normalizeColdIqPhone(payload: JsonRecord, underlyingProvider?: string): ContactSignal[] {
  const data = record(payload.data)
  const result = record(payload.result)
  const phone = str(payload.phone) || str(payload.phone_number) || str(data.phone) || str(data.phone_number) || str(result.phone) || str(result.phone_number)
  if (!validPhone(phone)) return []
  return [makeContactSignal({
    type: 'phone', channelKind: 'mobile_phone', value: phone, sourceProvider: 'coldiq', confidence: 'medium', ownershipConfidence: 'moderate',
    deliverability: 'unknown', rawSource: `coldiq:phone_find${underlyingProvider ? `:${underlyingProvider}` : ''}`,
    notes: `ColdIQ brokered phone observation${underlyingProvider ? ` via ${underlyingProvider}` : ''}. Underlying provider is retained when returned by the broker.`,
  })]
}

export async function launchAsyncProviderV36_16(
  provider: AsyncContactProviderV36_16,
  request: ContactEnrichmentRequest,
  missingGoals: ContactResolutionGoalV36_12[],
  callbackUrl: string,
  jobId: string,
): Promise<AsyncProviderLaunchV36_16> {
  if (provider === 'wiza') {
    const key = process.env.WIZA_API_KEY
    if (!key) throw new Error('Wiza is not configured.')
    const wantsEmail = missingGoals.some(goal => goal === 'work_email' || goal === 'personal_email')
    const wantsPhone = missingGoals.includes('phone')
    const enrichmentLevel = wantsEmail && wantsPhone ? 'full' : wantsPhone ? 'phone' : 'partial'
    const individualReveal: JsonRecord = {}
    const linkedin = linkedinUrl(request)
    if (linkedin) individualReveal.profile_url = linkedin
    else if (request.email) individualReveal.email = request.email
    else {
      if (request.fullName) individualReveal.full_name = request.fullName
      if (request.currentCompany) individualReveal.company = request.currentCompany
      if (request.companyDomain) individualReveal.domain = request.companyDomain
    }
    const response = await fetch('https://wiza.co/api/individual_reveals', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ individual_reveal: individualReveal, enrichment_level: enrichmentLevel, email_options: { accept_work: missingGoals.includes('work_email'), accept_personal: missingGoals.includes('personal_email') }, callback_url: callbackUrl }),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Wiza individual reveal returned ${response.status}.`)
    const payload = record(await response.json())
    const data = record(payload.data)
    const id = str(data.id) || (typeof data.id === 'number' ? String(data.id) : undefined)
    if (!id) throw new Error('Wiza did not return a reveal id.')
    return { provider, providerRequestId: id, estimatedCredits: estimatedProviderCreditsV36_16(provider, missingGoals), signals: [], completedSynchronously: false }
  }

  if (provider === 'apollo') {
    const key = process.env.APOLLO_API_KEY
    if (!key) throw new Error('Apollo is not configured.')
    if (!missingGoals.includes('phone')) throw new Error('Apollo async provider is reserved for the phone lane.')
    const body: JsonRecord = { reveal_personal_emails: false, reveal_phone_number: true, webhook_url: callbackUrl }
    const linkedin = linkedinUrl(request)
    const parts = nameParts(request)
    if (request.providerName === 'apollo' && request.providerPersonId) body.id = request.providerPersonId
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
    const response = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST', headers: { accept: 'application/json', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': key },
      body: JSON.stringify(body), cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Apollo phone enrichment returned ${response.status}.`)
    const payload = record(await response.json())
    const person = record(payload.person)
    return { provider, providerRequestId: str(payload.request_id) || str(person.id), estimatedCredits: estimatedProviderCreditsV36_16(provider, ['phone']), signals: [], completedSynchronously: false }
  }

  if (provider === 'fullenrich') {
    const key = process.env.FULLENRICH_API_KEY
    if (!key) throw new Error('FullEnrich is not configured.')
    const parts = nameParts(request)
    const enrichFields = missingGoals.flatMap(goal => goal === 'work_email' ? ['contact.work_emails'] : goal === 'personal_email' ? ['contact.personal_emails'] : goal === 'phone' ? ['contact.phones'] : [])
    const data = {
      ...(parts.first ? { first_name: parts.first } : {}), ...(parts.last ? { last_name: parts.last } : {}),
      ...(request.companyDomain ? { domain: request.companyDomain } : {}), ...(request.currentCompany ? { company_name: request.currentCompany } : {}),
      ...(linkedinUrl(request) ? { linkedin_url: linkedinUrl(request) } : {}),
      enrich_fields: Array.from(new Set(enrichFields)), custom: { sourcingos_job_id: jobId },
    }
    const response = await fetch('https://app.fullenrich.com/api/v2/contact/enrich/bulk?silentFail=true', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ name: `SourcingOS ${jobId}`, webhook_url: callbackUrl, webhook_events: { contact_finished: callbackUrl }, data: [data] }),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`FullEnrich enrichment returned ${response.status}.`)
    const payload = record(await response.json())
    const id = str(payload.enrichment_id)
    if (!id) throw new Error('FullEnrich did not return an enrichment id.')
    return { provider, providerRequestId: id, estimatedCredits: estimatedProviderCreditsV36_16(provider, missingGoals), signals: [], completedSynchronously: false }
  }

  const signals: ContactSignal[] = []
  let actualCredits = 0
  const underlying = new Set<string>()
  if (missingGoals.includes('work_email')) {
    const email = await coldIqCall('email/find', request, 3)
    signals.push(...normalizeColdIqEmail(email.payload, email.meta.underlyingProvider))
    actualCredits += email.meta.actualCredits || 0
    if (email.meta.underlyingProvider) underlying.add(email.meta.underlyingProvider)
  }
  if (missingGoals.includes('phone')) {
    const phone = await coldIqCall('phone/find', request, 5)
    signals.push(...normalizeColdIqPhone(phone.payload, phone.meta.underlyingProvider))
    actualCredits += phone.meta.actualCredits || 0
    if (phone.meta.underlyingProvider) underlying.add(phone.meta.underlyingProvider)
  }
  return {
    provider, estimatedCredits: estimatedProviderCreditsV36_16(provider, missingGoals), actualCredits,
    underlyingProvider: underlying.size ? Array.from(underlying).join(',') : undefined,
    signals: dedupeSignals(signals), completedSynchronously: true,
    warning: missingGoals.includes('personal_email') ? 'ColdIQ fallback does not satisfy the personal-email lane in this adapter.' : undefined,
  }
}

export function normalizeAsyncProviderWebhookV36_16(provider: AsyncContactProviderV36_16, payload: unknown) {
  if (provider === 'wiza') return normalizeWizaWebhookV36_16(payload)
  if (provider === 'apollo') return normalizeApolloPhoneWebhookV36_16(payload)
  if (provider === 'fullenrich') return normalizeFullEnrichWebhookV36_16(payload)
  return { signals: [] as ContactSignal[], actualCredits: undefined }
}
