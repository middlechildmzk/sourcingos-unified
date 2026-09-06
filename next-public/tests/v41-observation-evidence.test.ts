import { describe, expect, it } from 'vitest'
import {
  assessObservationRequirementV41,
  buildObservationRequirementsV41,
  canonicalContactV41,
  contactConfidenceV41,
  isClearanceRequirementV41,
  requirementPhrasesV41,
  slateCompanyContextV41,
  tallyObservationEvidenceV41,
  type ObservationLike,
} from '@/lib/search/observation-evidence-v41'

const rhelAdmin: ObservationLike = {
  provider: 'public_web',
  currentTitle: 'Senior RedHat Linux Administrator',
  currentEmployer: 'Northrop Grumman',
  location: 'Annapolis Junction, MD',
  skills: ['RHEL', 'Ansible', 'Bash'],
  richProfile: {
    summary: 'Maintains RHEL 7/8 fleets across classified programs.',
    experience: [{ title: 'Linux Administrator', company: 'Leidos', description: 'Patching 400+ hosts' }],
  },
}

describe('V41 requirement / discovery-expansion separation', () => {
  const plan = {
    criteria: {
      requirements: [
        { text: 'RHEL administration', mustHave: true },
        { text: 'Preference: Ansible automation', mustHave: false },
      ],
      skills: ['Kubernetes', 'Terraform'],
    },
  }

  it('marks stated requirements by tier and planner skills as expansion', () => {
    const requirements = buildObservationRequirementsV41(plan)
    expect(requirements.find(item => item.text === 'RHEL administration')?.origin).toBe('must_have')
    expect(requirements.find(item => item.text === 'Preference: Ansible automation')?.origin).toBe('preferred')
    expect(requirements.find(item => item.text === 'Kubernetes')?.origin).toBe('discovery_expansion')
  })

  // The defect this closes: the inspector merged criteria.skills into the
  // "Requirement evidence" list. Expansion terms are retrieval instructions and
  // must never be counted as evidence about a candidate.
  it('excludes discovery expansion from the evidence tally', () => {
    const requirements = buildObservationRequirementsV41(plan)
    const assessments = requirements.map(item => assessObservationRequirementV41(rhelAdmin, item))
    const tally = tallyObservationEvidenceV41(assessments)
    expect(tally.statedRequirements).toBe(2)
    expect(tally.supported + tally.contradicted + tally.needsVerification + tally.unknown).toBe(2)
  })

  it('does not duplicate a term that is both stated and expanded', () => {
    const requirements = buildObservationRequirementsV41({
      criteria: { requirements: [{ text: 'Ansible', mustHave: true }], skills: ['ansible'] },
    })
    expect(requirements.filter(item => item.text.toLowerCase() === 'ansible')).toHaveLength(1)
    expect(requirements[0].origin).toBe('must_have')
  })
})

describe('V41 observation requirement states', () => {
  it('supports a requirement carried by an observed field and quotes the source text', () => {
    const result = assessObservationRequirementV41(rhelAdmin, { text: 'RHEL administration', origin: 'must_have', clearance: false })
    expect(result.state).toBe('supported')
    expect(result.matchedFields.length).toBeGreaterThan(0)
    expect(result.quotedEvidence.some(text => text.includes('RedHat') || text.includes('RHEL'))).toBe(true)
  })

  // Absence of evidence is not evidence of absence. The whole thesis rests here.
  it('returns unknown rather than a failure when nothing matched', () => {
    const result = assessObservationRequirementV41(rhelAdmin, { text: 'Kubernetes operator development', origin: 'must_have', clearance: false })
    expect(result.state).toBe('unknown')
    expect(result.rationale).toContain('not a fail')
    expect(result.quotedEvidence).toEqual([])
  })

  it('never emits a composite score or percentage in the rationale', () => {
    const result = assessObservationRequirementV41(rhelAdmin, { text: 'RHEL', origin: 'must_have', clearance: false })
    expect(result.rationale).not.toMatch(/%|score|\bfit\b/i)
  })

  it('drops fragments too short to match meaningfully', () => {
    expect(requirementPhrasesV41('Go / C')).toEqual([])
    expect(requirementPhrasesV41('RHEL / Red Hat')).toEqual(['rhel', 'red hat', 'red', 'hat'])
  })

  it('strips recruiter prefixes before matching', () => {
    expect(requirementPhrasesV41('Preference: Ansible')).toEqual(['ansible'])
  })

  // A recruiter writing "RHEL administration" means RHEL. Generic role filler
  // must not become a match term of its own.
  it('exposes the distinctive token but not generic filler', () => {
    const phrases = requirementPhrasesV41('10+ years RHEL administration')
    expect(phrases).toContain('rhel')
    expect(phrases).not.toContain('administration')
    expect(phrases).not.toContain('years')
  })
})

describe('V41 clearance gate', () => {
  it('recognises clearance vocabulary', () => {
    for (const term of ['Secret clearance', 'TS/SCI with full scope poly', 'active Top Secret', 'Public Trust']) {
      expect(isClearanceRequirementV41(term)).toBe(true)
    }
    expect(isClearanceRequirementV41('RHEL administration')).toBe(false)
  })

  // Non-negotiable: no public source can make a clearance requirement supported.
  it('caps a matched clearance requirement at needs_verification', () => {
    const cleared: ObservationLike = { headline: 'Linux admin, active Secret clearance' }
    const result = assessObservationRequirementV41(cleared, { text: 'Secret clearance', origin: 'must_have', clearance: true })
    expect(result.state).toBe('needs_verification')
    expect(result.rationale).toContain('breadcrumb')
    expect(result.rationale).toContain('Confirm directly')
  })

  it('never reports a clearance requirement as supported or verified', () => {
    const result = assessObservationRequirementV41(rhelAdmin, { text: 'TS/SCI', origin: 'must_have', clearance: true })
    expect(result.state).not.toBe('supported')
    expect(result.rationale).not.toMatch(/verified clearance|clearance match|qualified/i)
  })

  it('treats a missing clearance breadcrumb as needing verification, not rejection', () => {
    const result = assessObservationRequirementV41({ headline: 'Linux admin' }, { text: 'Secret clearance', origin: 'must_have', clearance: true })
    expect(result.state).toBe('needs_verification')
    expect(result.rationale).toContain('not a negative finding')
  })
})

describe('V41 canonical contacts', () => {
  it('promotes one primary per channel and collapses the rest', () => {
    const result = canonicalContactV41([
      { channelKind: 'work_email', value: 'work@example.com', sourceProvider: 'pdl', deliverability: 'valid' },
      { channelKind: 'work_email', value: 'former@example.com', sourceProvider: 'pdl' },
      { channelKind: 'mobile_phone', value: '555-0100', sourceProvider: 'pdl' },
    ])
    expect(result.primary.filter(item => item.channel === 'work_email')).toHaveLength(1)
    expect(result.primary.find(item => item.channel === 'work_email')?.value).toBe('work@example.com')
    expect(result.alternates).toHaveLength(1)
  })

  it('orders primaries work email, personal email, phone, profile', () => {
    const result = canonicalContactV41([
      { channelKind: 'profile', value: 'https://example.com/x' },
      { channelKind: 'mobile', value: '555-0100' },
      { channelKind: 'work_email', value: 'work@example.com' },
      { channelKind: 'personal_email', value: 'personal@example.com' },
    ])
    expect(result.primary.map(item => item.channel)).toEqual(['work_email', 'personal_email', 'phone', 'profile'])
  })

  // Two different values on one channel may be two different humans.
  it('flags conflicting values instead of silently merging identities', () => {
    const result = canonicalContactV41([
      { channelKind: 'work_email', value: 'work@example.com', sourceProvider: 'pdl' },
      { channelKind: 'work_email', value: 'other-person@example.com', sourceProvider: 'other' },
    ])
    expect(result.conflictingChannels).toContain('work_email')
  })

  it('does not flag a conflict when the same value came from two providers', () => {
    const result = canonicalContactV41([
      { channelKind: 'work_email', value: 'work@example.com', sourceProvider: 'pdl' },
      { channelKind: 'work_email', value: 'work@example.com', sourceProvider: 'other' },
    ])
    expect(result.conflictingChannels).toEqual([])
  })

  it('never upgrades an unlabelled signal above possible', () => {
    expect(contactConfidenceV41({ value: 'work@example.com' })).toBe('possible')
    expect(contactConfidenceV41({ value: 'work@example.com', deliverability: 'valid' })).toBe('verified')
    expect(contactConfidenceV41({ value: 'work@example.com', deliverability: 'accept_all' })).toBe('likely')
    expect(contactConfidenceV41({ value: 'work@example.com', deliverability: 'unknown' })).toBe('not_checked')
  })

  it('records provenance for every entry', () => {
    const result = canonicalContactV41([{ channelKind: 'work_email', value: 'work@example.com' }])
    expect(result.primary[0].provenance).toBe('provider not stated')
  })
})

describe('V41 slate company context', () => {
  const slate: ObservationLike[] = [
    { currentEmployer: 'Leidos', currentTitle: 'Linux Admin', location: 'Columbia, MD' },
    { currentEmployer: 'Leidos', currentTitle: 'Systems Engineer', location: 'Annapolis Junction, MD' },
    { currentEmployer: 'Booz Allen', currentTitle: 'RHEL Engineer' },
  ]

  it('reports only what the current slate observed', () => {
    const context = slateCompanyContextV41('Leidos', slate)
    expect(context?.observedInSlate).toBe(2)
    expect(context?.observedTitles).toContain('Systems Engineer')
    expect(context?.adjacentCompanies).toEqual(['Booz Allen'])
  })

  // Firmographics are absent by design: nothing in hand evidences headcount,
  // industry or stack, and inventing them would be fabricated evidence.
  it('exposes no fields that would require an enrichment call', () => {
    const context = slateCompanyContextV41('Leidos', slate)
    expect(Object.keys(context || {}).sort()).toEqual([
      'adjacentCompanies', 'company', 'observedInSlate', 'observedLocations', 'observedTitles',
    ])
  })

  it('returns null without an employer rather than guessing', () => {
    expect(slateCompanyContextV41(undefined, slate)).toBeNull()
    expect(slateCompanyContextV41('', slate)).toBeNull()
  })
})
