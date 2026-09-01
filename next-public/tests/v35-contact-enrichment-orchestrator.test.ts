import { describe, expect, it } from 'vitest'
import { runContactEnrichmentOrchestratorV35, type ContactProviderAdapterV35 } from '@/lib/contact-enrichment/orchestrator-v35'
import type { ContactEnrichmentRequest, ContactEnrichmentResult } from '@/lib/contact-enrichment/types'

const request: ContactEnrichmentRequest = {
  fullName: 'Jane Smith',
  companyDomain: 'acme.com',
}

function result(provider: 'people_data_labs' | 'hunter' | 'apollo', values: string[] = []): ContactEnrichmentResult {
  return {
    provider,
    providerConfigured: true,
    message: values.length ? 'found' : 'none',
    signals: values.map(value => ({
      type: 'email',
      value,
      sourceProvider: provider,
      confidence: 'medium',
      verified: false,
      permissionStatus: 'unknown',
      discoveredAt: '2026-09-01T00:00:00.000Z',
    })),
    log: {
      provider,
      attemptedAt: '2026-09-01T00:00:00.000Z',
      fieldsUsed: ['fullName', 'companyDomain'],
      resultCount: values.length,
      warnings: [],
      persistenceMode: 'none',
    },
  }
}

function adapter(
  id: 'people_data_labs' | 'hunter' | 'apollo',
  values: string[],
  purposes: ContactProviderAdapterV35['purposes'] = ['identity_enrichment'],
  estimatedCredits = 1,
): ContactProviderAdapterV35 {
  return {
    id,
    purposes,
    estimatedCredits,
    enrich: async () => result(id, values),
  }
}

describe('V35 contact enrichment orchestrator', () => {
  it('stops after the first provider satisfies the requested lane', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'identity_enrichment',
      adapters: [
        adapter('people_data_labs', ['jane@acme.com']),
        adapter('apollo', ['other@acme.com']),
      ],
      maxPaidAttempts: 2,
    })

    expect(run.stopReason).toBe('goal_met')
    expect(run.attempts).toHaveLength(1)
    expect(run.result.provider).toBe('people_data_labs')
    expect(run.result.signals[0].value).toBe('jane@acme.com')
  })

  it('falls through to the next provider after a configured no-result', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'identity_enrichment',
      adapters: [
        adapter('people_data_labs', []),
        adapter('apollo', ['jane@acme.com']),
      ],
      maxPaidAttempts: 2,
    })

    expect(run.stopReason).toBe('goal_met')
    expect(run.attempts.map(item => item.provider)).toEqual(['people_data_labs', 'apollo'])
    expect(run.result.provider).toBe('apollo')
  })

  it('filters adapters by purpose instead of treating every provider as universal', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'work_email_finder',
      adapters: [
        adapter('people_data_labs', ['pdl@acme.com'], ['identity_enrichment']),
        adapter('hunter', ['jane@acme.com'], ['work_email_finder']),
      ],
      maxPaidAttempts: 2,
    })

    expect(run.attempts).toHaveLength(1)
    expect(run.attempts[0].provider).toBe('hunter')
    expect(run.result.signals[0].value).toBe('jane@acme.com')
  })

  it('honors a bounded paid-attempt budget', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'identity_enrichment',
      adapters: [
        adapter('people_data_labs', []),
        adapter('apollo', ['jane@acme.com']),
      ],
      maxPaidAttempts: 1,
    })

    expect(run.stopReason).toBe('providers_exhausted')
    expect(run.attempts).toHaveLength(1)
    expect(run.result.provider).toBe('people_data_labs')
  })

  it('stops before a provider call that would exceed the configured credit budget', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'identity_enrichment',
      adapters: [adapter('people_data_labs', ['jane@acme.com'], ['identity_enrichment'], 2)],
      maxPaidAttempts: 2,
      maxEstimatedCredits: 1,
    })

    expect(run.stopReason).toBe('budget_limit')
    expect(run.attempts).toHaveLength(0)
    expect(run.result.provider).toBe('none')
  })

  it('returns an explicit no-provider state when no adapter supports the lane', async () => {
    const run = await runContactEnrichmentOrchestratorV35({
      request,
      purpose: 'phone_enrichment',
      adapters: [adapter('hunter', [], ['work_email_finder'])],
    })

    expect(run.stopReason).toBe('no_provider')
    expect(run.result.provider).toBe('none')
    expect(run.result.signals).toHaveLength(0)
  })
})
