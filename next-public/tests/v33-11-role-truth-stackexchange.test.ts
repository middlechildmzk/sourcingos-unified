import { describe, expect, it } from 'vitest'
import { mergeAiRoleBriefV33_11, shortRecruiterBriefV33_11 } from '@/lib/ai/role-brief-parser-v33-4'
import {
  buildInfrastructureStackExchangeResultV33_11,
  isInfrastructureStackExchangeQueryV33_11,
  planInfrastructureStackExchangeTagsV33_11,
} from '@/lib/connectors/stackexchange-infra-v33-11'

const rhelPrompt = 'RHEL admin with 5+ years of experience in or near annapolis junction, MD with a secret security clearance or higher'

describe('V33.11 recruiter truth boundary', () => {
  it('does not let AI overwrite explicit short recruiter requirements', () => {
    expect(shortRecruiterBriefV33_11(rhelPrompt)).toBe(true)

    const intake = mergeAiRoleBriefV33_11(rhelPrompt, {
      title: 'RHEL admin',
      location: 'Not specified',
      workMode: 'unknown',
      compensation: 'Not specified',
      clearance: 'TS/SCI or higher',
      mustHaves: ['TypeScript'],
      niceToHaves: ['React'],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: ['TypeScript engineer'],
      hiringManagerNotes: 'Model enrichment should not become role truth.',
    })

    expect(intake.title).toBe('RHEL admin')
    expect(intake.location).toBe('Annapolis Junction, MD')
    expect(intake.clearance).toBe('Secret or higher')
    expect(intake.mustHaves).toContain('RHEL')
    expect(intake.mustHaves).toContain('5+ years relevant experience')
    expect(intake.mustHaves).not.toContain('TypeScript')
    expect(intake.niceToHaves).not.toContain('React')
    expect(intake.adjacentBackgrounds).not.toContain('TypeScript engineer')
  })
})

describe('V33.11 infrastructure Stack Exchange routing', () => {
  it('recognizes RHEL/Linux administration as infrastructure talent', () => {
    expect(isInfrastructureStackExchangeQueryV33_11('RHEL admin', ['RHEL'])).toBe(true)
    expect(isInfrastructureStackExchangeQueryV33_11('TypeScript frontend engineer', ['TypeScript'])).toBe(false)
  })

  it('routes RHEL to Server Fault redhat and Unix & Linux rhel tags', () => {
    const plan = planInfrastructureStackExchangeTagsV33_11('RHEL admin', ['RHEL'])
    expect(plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ site: 'serverfault', tag: 'redhat', capability: 'RHEL' }),
      expect.objectContaining({ site: 'unix', tag: 'rhel', capability: 'RHEL' }),
      expect.objectContaining({ site: 'serverfault', tag: 'linux', capability: 'Linux' }),
      expect.objectContaining({ site: 'unix', tag: 'linux', capability: 'Linux' }),
    ]))
    expect(plan.map(item => String(item.site))).not.toContain('stackoverflow')
  })

  it('normalizes observed Red Hat community evidence to RHEL without query-only promotion', () => {
    const result = buildInfrastructureStackExchangeResultV33_11({
      site: 'serverfault',
      user: {
        user_id: 123,
        display_name: 'Example Admin',
        reputation: 2500,
        location: 'Fort Meade, MD',
        link: 'https://serverfault.com/users/123/example-admin',
      },
      observations: [{ tag: 'redhat', capability: 'RHEL', postCount: 18, score: 122 }],
      observedAt: '2026-09-01T00:00:00.000Z',
    })

    expect(result).not.toBeNull()
    expect(result?.source).toBe('stackoverflow')
    expect(result?.sourceProfileId).toBe('serverfault:123')
    expect(result?.profileUrl).toContain('serverfault.com')
    expect(result?.skills).toEqual(['RHEL'])
    expect(result?.evidence[0].label).toBe('Server Fault · RHEL')
    expect(result?.evidence[0].detail).toMatch(/top answerers.*\[redhat\].*RHEL/i)
  })
})
