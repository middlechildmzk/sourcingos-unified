import { describe, expect, it } from 'vitest'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import { buildRoleEntityIntelligenceV35 } from '@/lib/entity-intelligence/role-intelligence-v35'
import { approvedExecutionLocationsV35 } from '@/lib/entity-intelligence/search-approval-v35'

const LIVE_ACCEPTANCE = 'find me a RHEL administrator with 5+ years of linux experience local to Annapolis Junction, MD or greater Washington DC with a secret clearance or higher (ts/sci)'

describe('V35 live recruiter acceptance — RHEL / Annapolis Junction / Secret+', () => {
  it('preserves the recruiter truth instead of tightening or contaminating it', () => {
    const intake = interpretRoleBrief(LIVE_ACCEPTANCE).intake

    expect(intake.title.toLowerCase()).toBe('rhel administrator')
    expect(intake.location).toBe('Annapolis Junction, MD')
    expect(intake.clearance).toBe('Secret or higher')
    expect(intake.mustHaves).toContain('5+ years Linux experience')
    expect(intake.mustHaves).toContain('RHEL')
    expect(intake.mustHaves).not.toContain('Linux')
    expect(intake.mustHaves.some(value => /local to|annapolis junction/i.test(value))).toBe(false)
  })

  it('treats local-to as proximity and preserves the explicitly stated second market', () => {
    const intake = interpretRoleBrief(LIVE_ACCEPTANCE).intake
    const intelligence = buildRoleEntityIntelligenceV35(intake)
    const executionLocations = approvedExecutionLocationsV35(intake)

    expect(intelligence.location.anchorLabel).toBe('Annapolis Junction, MD')
    expect(intelligence.location.mode).toBe('nearby')
    expect(intelligence.explicitLocationAlternatives).toContain('Washington, DC')
    expect(executionLocations[0]).toBe('Annapolis Junction, MD')
    expect(executionLocations).toContain('Washington, DC')
  })

  it('does not turn stronger clearance or polygraph concepts into Find Similar expansions', () => {
    const intake = interpretRoleBrief(LIVE_ACCEPTANCE).intake
    const intelligence = buildRoleEntityIntelligenceV35(intake)
    const labels = intelligence.suggestedExpansions.map(item => item.entity.canonicalLabel.toLowerCase())

    expect(intake.clearance).toBe('Secret or higher')
    expect(labels).not.toContain('polygraph')
    expect(labels).not.toContain('ts/sci')
  })
})
