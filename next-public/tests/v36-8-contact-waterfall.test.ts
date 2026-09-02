import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAnyMailFinderBodyV36_8, canUseAnyMailFinderV36_8 } from '@/lib/contact-enrichment/providers/anymail-finder-v36-8'
import { canUseHunterV36_8 } from '@/lib/contact-enrichment/providers/hunter-v36-8'
import { canUseSignalHireLookupV36_8 } from '@/lib/contact-enrichment/providers/signalhire-v36-8'
import { canUseTombaV36_8 } from '@/lib/contact-enrichment/providers/tomba-v36-8'

const grounded = {
  fullName: 'Alex Kim',
  currentCompany: 'Acme',
  companyDomain: 'acme.com',
  linkedinUrl: 'https://www.linkedin.com/in/alex-kim',
}

describe('V36.8 multi-provider contact waterfall', () => {
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

  it('routes discovery broadly but contact reveal through bounded stop-on-success purposes', () => {
    const route = readFileSync(fileURLToPath(new URL('../app/api/contact-enrichment/find/route.ts', import.meta.url)), 'utf8')
    expect(route).toContain("'identity_enrichment', 'work_email_finder', 'email_verification', 'phone_enrichment'")
    expect(route).toContain("purpose === 'work_email_finder'")
    expect(route).toContain('maxPaidAttempts: Math.min(4, adapters.length)')
    expect(route).toContain('Contact ownership, deliverability, and permission are separate')
    expect(route).not.toContain('permission_status: \'candidate_provided\'')
  })
})
