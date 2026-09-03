import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configuredAsyncProviderChainV36_16,
  createAsyncCallbackTokenV36_16,
  launchAsyncProviderV36_16,
  normalizeApolloPhoneWebhookV36_16,
  normalizeFullEnrichWebhookV36_16,
  normalizeWizaWebhookV36_16,
  verifyAsyncCallbackTokenV36_16,
} from '@/lib/contact-enrichment/async-enrichment-v36-16'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('V36.16 async contact enrichment', () => {
  it('stores only a callback-token hash and rejects the wrong capability', () => {
    const generated = createAsyncCallbackTokenV36_16()
    expect(generated.token).toHaveLength(64)
    expect(generated.hash).toHaveLength(64)
    expect(generated.hash).not.toBe(generated.token)
    expect(verifyAsyncCallbackTokenV36_16(generated.token, generated.hash)).toBe(true)
    expect(verifyAsyncCallbackTokenV36_16('0'.repeat(64), generated.hash)).toBe(false)
  })

  it('builds a sequential cost-aware provider chain and reserves Apollo async work for phone', () => {
    vi.stubEnv('WIZA_API_KEY', 'wiza-test')
    vi.stubEnv('APOLLO_API_KEY', 'apollo-test')
    vi.stubEnv('FULLENRICH_API_KEY', 'full-test')
    vi.stubEnv('COLDIQ_API_KEY', 'cold-test')
    expect(configuredAsyncProviderChainV36_16(['work_email', 'personal_email'])).toEqual(['wiza', 'fullenrich', 'coldiq'])
    expect(configuredAsyncProviderChainV36_16(['phone'])).toEqual(['wiza', 'apollo', 'fullenrich', 'coldiq'])
  })

  it('normalizes Wiza work/personal email and phone without promoting them to verified permission', () => {
    const result = normalizeWizaWebhookV36_16({
      data: {
        emails: [
          { email: 'work@example.com', email_type: 'work', email_status: 'valid' },
          { email: 'person@gmail.com', email_type: 'personal', email_status: 'risky' },
        ],
        phones: [{ number: '+1 202 555 0101', type: 'mobile' }],
        credits: { api_credits: { total: 9 } },
      },
    })
    expect(result.actualCredits).toBe(9)
    expect(result.signals.map(signal => signal.channelKind)).toEqual(['work_email', 'personal_email', 'mobile_phone'])
    expect(result.signals.every(signal => signal.verified === false && signal.permissionStatus === 'unknown')).toBe(true)
  })

  it('normalizes FullEnrich v2 contact_finished payload and preserves per-channel semantics', () => {
    const result = normalizeFullEnrichWebhookV36_16({
      cost: { credits: 14 },
      data: [{
        contact_info: {
          work_emails: [{ email: 'work@example.com', status: 'DELIVERABLE' }],
          personal_emails: [{ email: 'person@gmail.com', status: 'DELIVERABLE' }],
          phones: [{ number: '+12025550102', region: 'US' }],
        },
      }],
    })
    expect(result.actualCredits).toBe(14)
    expect(result.signals.map(signal => signal.channelKind)).toEqual(['work_email', 'personal_email', 'mobile_phone'])
    expect(result.signals.every(signal => signal.sourceProvider === 'fullenrich')).toBe(true)
  })

  it('keeps Apollo DNC status separate from phone validity', () => {
    const result = normalizeApolloPhoneWebhookV36_16({
      credits_consumed: 8,
      people: [{
        phone_numbers: [
          { sanitized_number: '+12025550103', type_cd: 'mobile', status_cd: 'valid_number', dnc_status_cd: 'not_found', confidence_cd: 'high' },
          { sanitized_number: '+12025550104', type_cd: 'work_direct', status_cd: 'valid_number', dnc_status_cd: 'found', confidence_cd: 'high' },
        ],
      }],
    })
    expect(result.actualCredits).toBe(8)
    expect(result.signals[0].deliverability).toBe('verified')
    expect(result.signals[0].permissionStatus).toBe('unknown')
    expect(result.signals[1].deliverability).toBe('verified')
    expect(result.signals[1].permissionStatus).toBe('do_not_contact')
  })

  it('starts a Wiza reveal with a callback and only the still-missing contact goals', async () => {
    vi.stubEnv('WIZA_API_KEY', 'wiza-test')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: { code: 200, message: 'working' },
      type: 'individual_reveal',
      data: { id: 32, status: 'queued', is_complete: false },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const result = await launchAsyncProviderV36_16(
      'wiza',
      { fullName: 'Jane Doe', currentCompany: 'Acme', companyDomain: 'acme.com' },
      ['personal_email', 'phone'],
      'https://getsourcingos.com/api/contact-enrichment/webhooks/wiza?job=abc&token=secret',
      'abc',
    )
    expect(result.completedSynchronously).toBe(false)
    expect(result.providerRequestId).toBe('32')
    const call = fetchMock.mock.calls[0]
    const body = JSON.parse(String((call[1] as RequestInit).body))
    expect(body.enrichment_level).toBe('full')
    expect(body.email_options).toEqual({ accept_work: false, accept_personal: true })
    expect(body.callback_url).toContain('/webhooks/wiza')
    expect(body.individual_reveal).toMatchObject({ full_name: 'Jane Doe', company: 'Acme', domain: 'acme.com' })
  })

  it('starts FullEnrich with only requested enrich_fields and a per-contact webhook', async () => {
    vi.stubEnv('FULLENRICH_API_KEY', 'full-test')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ enrichment_id: '3c90c3cc-0d44-4b50-8888-8dd25736052a' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const result = await launchAsyncProviderV36_16(
      'fullenrich',
      { fullName: 'Jane Doe', currentCompany: 'Acme', companyDomain: 'acme.com', linkedinUrl: 'https://www.linkedin.com/in/jane-doe' },
      ['work_email', 'phone'],
      'https://getsourcingos.com/api/contact-enrichment/webhooks/fullenrich?job=abc&token=secret',
      'abc',
    )
    expect(result.completedSynchronously).toBe(false)
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.data[0].enrich_fields).toEqual(['contact.work_emails', 'contact.phones'])
    expect(body.webhook_events.contact_finished).toContain('/webhooks/fullenrich')
    expect(body.data[0].custom.sourcingos_job_id).toBe('abc')
  })
})
