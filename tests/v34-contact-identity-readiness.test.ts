import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assessEnrichmentIdentityV34 } from '@/lib/contact-enrichment/identity-readiness-v34'
import type { ContactEnrichmentRequest } from '@/lib/contact-enrichment/types'

function request(patch: Partial<ContactEnrichmentRequest>): ContactEnrichmentRequest {
  return { ...patch }
}

describe('V34 contact enrichment identity readiness', () => {
  it('does not spend a paid lookup on a lowercase one-word source handle', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      fullName: 'jcalz',
      profileUrl: 'https://stackoverflow.com/users/2887218/jcalz',
      title: 'TypeScript',
      location: 'Eau Claire, WI, USA',
    }))

    expect(assessment.strength).toBe('insufficient')
    expect(assessment.attemptProvider).toBe(false)
    expect(assessment.message).toMatch(/source handle/i)
  })

  it('does not mistake another simple Stack Exchange handle for a resolved full name', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      fullName: 'basarat',
      profileUrl: 'https://stackoverflow.com/users/390330/basarat',
    }))

    expect(assessment.attemptProvider).toBe(false)
  })

  it('accepts an observed GitHub profile URL as a strong deterministic provider anchor', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      fullName: 'somehandle',
      githubUrl: 'https://github.com/somehandle',
    }))

    expect(assessment.strength).toBe('strong')
    expect(assessment.attemptProvider).toBe(true)
    expect(assessment.anchors.join(' ')).toMatch(/github profile/i)
  })

  it('accepts an observed LinkedIn person URL as a strong provider anchor', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      linkedinUrl: 'https://www.linkedin.com/in/jane-smith/',
    }))

    expect(assessment.strength).toBe('strong')
    expect(assessment.attemptProvider).toBe(true)
  })

  it('accepts a real multi-token name plus company context', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      fullName: 'Jane Smith',
      currentCompany: 'Example Systems',
    }))

    expect(assessment.strength).toBe('strong')
    expect(assessment.attemptProvider).toBe(true)
  })

  it('requires more than a name alone to reduce common-name false contact matches', () => {
    const assessment = assessEnrichmentIdentityV34(request({ fullName: 'John Smith' }))

    expect(assessment.strength).toBe('insufficient')
    expect(assessment.attemptProvider).toBe(false)
  })

  it('allows name plus location plus professional title as a usable identity packet', () => {
    const assessment = assessEnrichmentIdentityV34(request({
      fullName: 'John Smith',
      title: 'RHEL Administrator',
      location: 'Fort Meade, MD',
    }))

    expect(assessment.strength).toBe('usable')
    expect(assessment.attemptProvider).toBe(true)
  })

  it('keeps the contact API authenticated, rate limited, and identity-gated before provider execution', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/contact-enrichment/find/route.ts', import.meta.url)),
      'utf8',
    )

    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'enrichment'")
    expect(route).toContain("rateLimit(req, 'enrichmentDaily'")
    expect(route.indexOf('assessEnrichmentIdentityV34(request)')).toBeLessThan(route.indexOf('enrichWithPeopleDataLabs(request)'))
    expect(route).toContain("code: 'identity_insufficient'")
  })
})
