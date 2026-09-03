import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAnyMailFinderBodyV36_8, canUseAnyMailFinderV36_8 } from '@/lib/contact-enrichment/providers/anymail-finder-v36-8'
import { canUseHunterV36_8 } from '@/lib/contact-enrichment/providers/hunter-v36-8'
import { canUseSignalHireLookupV36_8 } from '@/lib/contact-enrichment/providers/signalhire-v36-8'
import { canUseTombaV36_8 } from '@/lib/contact-enrichment/providers/tomba-v36-8'
import { contactGoalStateV36_12, runContactEnrichmentOrchestratorV35 } from '@/lib/contact-enrichment/orchestrator-v35'
import { makeContactSignal } from '@/lib/contact-enrichment/types'

const grounded = {
  fullName: 'Alex Kim',
  currentCompany: 'Acme',
  companyDomain: 'acme.com',
  linkedinUrl: 'https://www.linkedin.com/in/alex-kim',
}

describe('V36.8 / V36.12 multi-provider contact waterfall', () => {
  it('builds AnyMail Finder from grounded identity and keeps contact discovery separate from candidate search', () => {
    expect(canUseAnyMailFinderV36_8(grounded)).toBe(true)
    expect(buildAnyMailFinderBodyV36_8(grounded)).toEqual({
      domain: 'acme.com',
      full_name: 'Alex Kim',
      linkedin_url: 'https://www.linkedin.com/in/alex-kim',
    })
    expect(canUseAnyMailFinderV36_8({ fullName: 'Alex Kim' })).toBe(false)
  })

  it('requires an exact SignalHire UID or observed LinkedIn anchor before SignalHire contact lookup', () => {
    expect(canUseSignalHireLookupV36_8({ providerName: 'signalhire', providerPersonId: '10000000000000000000000000001001' })).toBe(true)
    expect(canUseSignalHireLookupV36_8({ linkedinUrl: 'https://www.linkedin.com/in/alex-kim' })).toBe(true)
    expect(canUseSignalHireLookupV36_8({ fullName: 'Alex Kim', companyDomain: 'acme.com' })).toBe(false)
  })

  it('keeps Tomba and Hunter email verification explicit and finder inputs grounded', () => {
    expect(canUseTombaV36_8({ email: 'alex@example.com' }, 'email_verification')).toBe(true)
    expect(canUseHunterV36_8({ email: 'alex@example.com' }, 'email_verification')).toBe(true)
    expect(canUseTombaV36_8(grounded, 'work_email_finder')).toBe(true)
    expect(canUseHunterV36_8(grounded, 'work_email_finder')).toBe(true)
    expect(canUseTombaV36_8({ fullName: 'Alex Kim' }, 'work_email_finder')).toBe(false)
    expect(canUseHunterV36_8({ fullName: 'Alex Kim' }, 'work_email_finder')).toBe(false)
  })

  it('routes contact reveal through explicit bounded goals and preserves permission separation', () => {
    const route = readFileSync(fileURLToPath(new URL('../app/api/contact-enrichment/find/route.ts', import.meta.url)), 'utf8')
    expect(route).toContain("'contact_bundle'")
    expect(route).toContain("['work_email', 'personal_email', 'phone']")
    expect(route).toContain('cacheSignalsConsidered')
    expect(route).toContain('maxEstimatedCredits')
    expect(route).toContain('Contact ownership, deliverability, and permission are separate')
    expect(route).not.toContain("permission_status: 'candidate_provided'")
  })

  it('does not let a work email satisfy a still-requested phone goal', async () => {
    const workEmail = makeContactSignal({ type: 'email', channelKind: 'work_email', value: 'alex@example.com', sourceProvider: 'anymail_finder' })
    expect(contactGoalStateV36_12([workEmail], ['work_email', 'phone'])).toEqual({
      requested: ['work_email', 'phone'],
      satisfied: ['work_email'],
      missing: ['phone'],
    })

    let phoneCalls = 0
    const run = await runContactEnrichmentOrchestratorV35({
      request: grounded,
      purpose: 'phone_enrichment',
      goals: ['phone'],
      initialSignals: [workEmail],
      maxPaidAttempts: 2,
      adapters: [{
        id: 'signalhire',
        purposes: ['phone_enrichment'],
        enrich: async () => {
          phoneCalls += 1
          return {
            provider: 'signalhire', providerConfigured: true, message: 'phone',
            signals: [makeContactSignal({ type: 'phone', channelKind: 'mobile_phone', value: '+1 555 010 1234', sourceProvider: 'signalhire' })],
            log: { provider: 'signalhire', attemptedAt: new Date().toISOString(), fieldsUsed: [], resultCount: 1, warnings: [], persistenceMode: 'none' },
          }
        },
      }],
    })
    expect(phoneCalls).toBe(1)
    expect(run.stopReason).toBe('goal_met')
    expect(run.missingGoals).toEqual([])
  })

  it('uses a cache hit without executing a paid adapter', async () => {
    let calls = 0
    const cached = makeContactSignal({ type: 'email', channelKind: 'work_email', value: 'cached@example.com', sourceProvider: 'hunter' })
    const run = await runContactEnrichmentOrchestratorV35({
      request: grounded,
      purpose: 'work_email_finder',
      goals: ['work_email'],
      initialSignals: [cached],
      adapters: [{
        id: 'people_data_labs', purposes: ['work_email_finder'], estimatedCredits: 1,
        enrich: async () => { calls += 1; throw new Error('should not run') },
      }],
    })
    expect(calls).toBe(0)
    expect(run.stopReason).toBe('cache_hit')
    expect(run.result.signals).toHaveLength(1)
  })
})
