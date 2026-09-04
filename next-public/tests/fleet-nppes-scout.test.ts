import { describe, expect, it } from 'vitest'

import { discoveryIntent } from '../lib/connectors/contract-v33-3'
import { MemoryCreditLedger } from '../lib/fleet/credit-ledger'
import { MemoryLandingZone } from '../lib/fleet/landing-zone'
import {
  buildNppesDossier,
  buildNppesUrl,
  createNppesScout,
  isActiveRecord,
  isIndividualProvider,
  planNppesQuery,
  practiceRegion,
  providerDisplayName,
  type NppesResult,
} from '../lib/fleet/scouts/nppes-scout'

const OBSERVED_AT = '2026-09-04T12:00:00.000Z'

function individual(overrides: Partial<NppesResult> = {}): NppesResult {
  return {
    number: '1245319599',
    enumeration_type: 'NPI-1',
    basic: {
      first_name: 'Amara',
      last_name: 'Okonkwo',
      credential: 'MD',
      status: 'A',
      enumeration_date: '2011-04-18',
      last_updated: '2026-02-02',
    },
    addresses: [
      {
        address_purpose: 'LOCATION',
        address_1: '4200 Clinic Way Suite 300',
        city: 'Minneapolis',
        state: 'MN',
        postal_code: '554070000',
        telephone_number: '612-555-0100',
        fax_number: '612-555-0101',
      },
    ],
    taxonomies: [
      {
        code: '207RC0000X',
        desc: 'Internal Medicine, Cardiovascular Disease',
        state: 'MN',
        license: 'MN-48812',
        primary: true,
      },
    ],
    ...overrides,
  }
}

function jsonFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch
}

describe('NPPES record classification', () => {
  it('reads personhood from enumeration_type, never from the name', () => {
    expect(isIndividualProvider({ enumeration_type: 'NPI-1' })).toBe(true)
    // An organization whose registered name reads exactly like a person's.
    expect(
      isIndividualProvider({
        enumeration_type: 'NPI-2',
        basic: { organization_name: 'Dr. Sarah Chen DDS PC' },
      }),
    ).toBe(false)
  })

  it('excludes deactivated records rather than presenting them as current', () => {
    expect(isActiveRecord(individual())).toBe(true)
    expect(
      isActiveRecord(
        individual({ basic: { first_name: 'A', last_name: 'B', status: 'D', deactivation_date: '2024-01-01' } }),
      ),
    ).toBe(false)
  })

  it('returns null rather than a dossier for an organization', () => {
    const dossier = buildNppesDossier({
      result: { number: '1245319599', enumeration_type: 'NPI-2', basic: { organization_name: 'Acme Health' } },
      observedAt: OBSERVED_AT,
    })
    expect(dossier).toBeNull()
  })

  it('appends a stated credential to the display name', () => {
    expect(providerDisplayName({ first_name: 'Amara', last_name: 'Okonkwo', credential: 'MD' })).toBe(
      'Amara Okonkwo, MD',
    )
  })
})

describe('NPPES dossier evidence rules', () => {
  it('carries specialty as self-attested, not as an observed artifact', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    const specialty = dossier!.technologies[0]
    expect(specialty.value).toContain('Cardiovascular')
    // The provider selects their own NUCC code, so it is a claim, not an observation.
    expect(specialty.provenance.basis).toBe('source_stated')
    expect(specialty.provenance.sourceField).toBe('taxonomies.desc')
  })

  it('reduces a practice address to city and state and drops the street line', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    expect(dossier!.person.statedLocation).toBe('Minneapolis, MN')
    expect(JSON.stringify(dossier)).not.toContain('4200 Clinic Way')
  })

  it('never carries practice phone or fax onto the record', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    const serialized = JSON.stringify(dossier)
    expect(serialized).not.toContain('612-555-0100')
    expect(serialized).not.toContain('612-555-0101')
    expect(dossier!.limits.some(limit => limit.topic === 'Contact')).toBe(true)
  })

  it('claims no employer, because NPPES publishes none', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    expect(dossier!.person.statedOrganization).toBeUndefined()
    expect(dossier!.limits.some(limit => limit.topic === 'Employer')).toBe(true)
  })

  it('makes the NPI a deterministic anchor and the state license a supporting one', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    const npi = dossier!.anchors.find(anchor => anchor.kind === 'npi_number')
    expect(npi?.strength).toBe('deterministic')
    expect(npi?.normalized).toBe('npi:1245319599')

    const license = dossier!.anchors.find(anchor => anchor.normalized.startsWith('license:'))
    // A self-reported license number is real signal, and is not proof of identity.
    expect(license?.strength).toBe('supporting')
  })

  it('makes no seniority claim anywhere in the evidence surface', () => {
    const dossier = buildNppesDossier({ result: individual(), observedAt: OBSERVED_AT })
    const evidenceSurface = JSON.stringify({
      person: dossier!.person,
      technologies: dossier!.technologies,
      artifacts: dossier!.artifacts,
    })
    expect(evidenceSurface).not.toMatch(/senior|junior|experienced|years of experience/i)
    expect(dossier!.limits.some(limit => limit.topic === 'Seniority')).toBe(true)
  })

  it('says so when no taxonomy is flagged primary', () => {
    const dossier = buildNppesDossier({
      result: individual({
        taxonomies: [{ code: '207Q00000X', desc: 'Family Medicine', state: 'MN' }],
      }),
      observedAt: OBSERVED_AT,
    })
    expect(dossier!.limits.some(limit => limit.topic === 'Primary specialty')).toBe(true)
  })

  it('rejects a malformed NPI number', () => {
    expect(buildNppesDossier({ result: individual({ number: '123' }), observedAt: OBSERVED_AT })).toBeNull()
  })
})

describe('NPPES query planning', () => {
  it('splits a city and state pair', () => {
    const plan = planNppesQuery(
      discoveryIntent({ hypothesis: 'cardiologist', capabilityTerms: ['Cardiovascular Disease'], location: 'Minneapolis, MN' }),
    )
    expect(plan.city).toBe('Minneapolis')
    expect(plan.state).toBe('MN')
    expect(plan.taxonomyDescription).toBe('Cardiovascular Disease')
  })

  it('accepts a bare state code', () => {
    const plan = planNppesQuery(discoveryIntent({ hypothesis: 'nurse practitioner', location: 'TX' }))
    expect(plan.state).toBe('TX')
    expect(plan.city).toBeNull()
  })

  it('always restricts the query to individual providers', () => {
    const url = buildNppesUrl({ taxonomyDescription: 'Family Medicine', state: 'MN', city: null }, 10)
    expect(url).toContain('enumeration_type=NPI-1')
    expect(url).toContain('version=2.1')
  })

  it('refuses to build a criterion-free query', () => {
    expect(buildNppesUrl({ taxonomyDescription: null, state: null, city: null }, 10)).toBeNull()
  })

  it('formats a region from city and state only', () => {
    expect(practiceRegion({ city: 'Austin', state: 'TX', address_1: 'x' })).toBe('Austin, TX')
    expect(practiceRegion(undefined)).toBeUndefined()
  })
})

describe('NPPES scout run', () => {
  it('discovers individuals, excludes organizations, and reports the exclusion', async () => {
    const scout = createNppesScout({
      fetchImpl: jsonFetch({
        result_count: 2,
        results: [
          individual(),
          { number: '1996789012', enumeration_type: 'NPI-2', basic: { organization_name: 'Clinic LLC' } },
        ],
      }),
    })

    const result = await scout.run(
      discoveryIntent({ hypothesis: 'cardiologist', capabilityTerms: ['Cardiovascular Disease'], location: 'MN', limit: 5 }),
      { landingZone: new MemoryLandingZone(), credits: new MemoryCreditLedger(100) },
    )

    expect(result.dossiers).toHaveLength(1)
    expect(result.report.warnings.join(' ')).toContain('NPI-2')
    expect(result.report.deterministicAnchorsProduced).toBeGreaterThan(0)
  })

  it('reports a missing criterion as a query limit, not as an empty talent pool', async () => {
    const scout = createNppesScout({ fetchImpl: jsonFetch({ results: [] }) })
    const result = await scout.run(discoveryIntent({ hypothesis: 'someone', limit: 5 }), {
      landingZone: new MemoryLandingZone(),
      credits: new MemoryCreditLedger(100),
    })

    expect(result.dossiers).toHaveLength(0)
    expect(result.creditsSpent).toBe(0)
    expect(result.report.warnings.join(' ')).toContain('not an absence of clinicians')
  })

  it('spends credits only for clinicians actually returned', async () => {
    const credits = new MemoryCreditLedger(100)
    const scout = createNppesScout({ fetchImpl: jsonFetch({ results: [individual()] }) })

    await scout.run(
      discoveryIntent({ hypothesis: 'cardiologist', capabilityTerms: ['Cardiovascular Disease'], limit: 20 }),
      { landingZone: new MemoryLandingZone(), credits },
    )

    // Reserved 20, one person returned, 19 refunded.
    expect(credits.balance).toBe(99)
  })
})
