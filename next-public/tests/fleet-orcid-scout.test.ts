import { describe, expect, it } from 'vitest'

import { discoveryIntent } from '../lib/connectors/contract-v33-3'
import { MemoryCreditLedger } from '../lib/fleet/credit-ledger'
import { MemoryLandingZone } from '../lib/fleet/landing-zone'
import {
  buildOrcidDossier,
  buildOrcidSearchQuery,
  classifyAssertion,
  createOrcidScout,
  isValidOrcid,
  orcidHeaders,
  type OrcidRecord,
} from '../lib/fleet/scouts/orcid-scout'

const OBSERVED_AT = '2026-09-04T12:00:00.000Z'
const ORCID = '0000-0002-1825-0097'

function record(overrides: Partial<OrcidRecord> = {}): OrcidRecord {
  return {
    'orcid-identifier': { path: ORCID, uri: `https://orcid.org/${ORCID}` },
    person: {
      name: { 'given-names': { value: 'Amara' }, 'family-name': { value: 'Okonkwo' } },
      keywords: { keyword: [{ content: 'computational immunology' }] },
      'researcher-urls': { 'researcher-url': [{ url: { value: 'https://github.com/aokonkwo' } }] },
    },
    'activities-summary': {
      employments: {
        'affiliation-group': [
          {
            summaries: [
              {
                'employment-summary': {
                  'put-code': 1,
                  'role-title': 'Research Scientist',
                  organization: {
                    name: 'Mayo Clinic',
                    address: { city: 'Rochester', region: 'MN', country: 'US' },
                  },
                  'start-date': { year: { value: '2019' } },
                  source: { 'source-name': { value: 'Mayo Clinic' }, 'source-orcid': { path: '0000-0009-9999-9999' } },
                },
              },
            ],
          },
        ],
      },
    },
    ...overrides,
  }
}

function selfAssertedRecord(): OrcidRecord {
  return record({
    'activities-summary': {
      employments: {
        'affiliation-group': [
          {
            summaries: [
              {
                'employment-summary': {
                  'put-code': 2,
                  'role-title': 'Principal Scientist',
                  organization: { name: 'Definitely Real Labs' },
                  'start-date': { year: { value: '2015' } },
                  source: { 'source-name': { value: 'Amara Okonkwo' }, 'source-orcid': { path: ORCID } },
                },
              },
            ],
          },
        ],
      },
    },
  })
}

describe('ORCID identifier validation', () => {
  it('accepts a well-formed iD including the X checksum form', () => {
    expect(isValidOrcid('0000-0002-1825-0097')).toBe(true)
    expect(isValidOrcid('0000-0002-1694-233X')).toBe(true)
  })

  it('rejects malformed identifiers', () => {
    expect(isValidOrcid('0000-0002-1825')).toBe(false)
    expect(isValidOrcid('not-an-orcid')).toBe(false)
    expect(isValidOrcid('')).toBe(false)
  })
})

describe('auth header posture', () => {
  it('sends no Authorization header when no token is configured', () => {
    const headers = orcidHeaders()
    // ORCID rejects an invalid bearer with 401, so an empty one would break a
    // call that needs no credential at all.
    expect(headers.authorization).toBeUndefined()
    expect(headers.accept).toBe('application/json')
  })

  it('sends a bearer only when a real token is present', () => {
    expect(orcidHeaders('  ').authorization).toBeUndefined()
    expect(orcidHeaders('abc-123').authorization).toBe('Bearer abc-123')
  })
})

describe('assertion origin', () => {
  it('treats a record written by the researcher as self-asserted', () => {
    const assertion = classifyAssertion(
      { 'source-name': { value: 'Amara Okonkwo' }, 'source-orcid': { path: ORCID } },
      ORCID,
    )
    expect(assertion.kind).toBe('self_asserted')
  })

  it('names the organization when a third party asserted it', () => {
    const assertion = classifyAssertion(
      { 'source-name': { value: 'Mayo Clinic' }, 'source-orcid': { path: '0000-0009-9999-9999' } },
      ORCID,
    )
    expect(assertion).toEqual({ kind: 'organization_asserted', assertedBy: 'Mayo Clinic' })
  })

  it('falls back to self-asserted when the source is ambiguous', () => {
    // The failure that matters is presenting a self-claim as institutional
    // confirmation, never the reverse.
    expect(classifyAssertion(null, ORCID).kind).toBe('self_asserted')
    expect(classifyAssertion({}, ORCID).kind).toBe('self_asserted')
    expect(classifyAssertion({ 'source-orcid': { path: 'unknown' } }, ORCID).kind).toBe('self_asserted')
  })
})

describe('ORCID dossier evidence rules', () => {
  it('sets a stated employer only when an institution asserted the affiliation', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    expect(dossier!.person.statedOrganization).toBe('Mayo Clinic')
    expect(dossier!.person.statedLocation).toBe('Rochester, MN, US')
  })

  it('does not set an employer from a self-asserted affiliation', () => {
    const dossier = buildOrcidDossier({ record: selfAssertedRecord(), observedAt: OBSERVED_AT })
    // "Principal Scientist at Definitely Real Labs" is a self-written claim with
    // the same standing as a profile headline.
    expect(dossier!.person.statedOrganization).toBeUndefined()
    expect(dossier!.limits.some(limit => limit.topic === 'Employer verification')).toBe(true)
  })

  it('says on the artifact who asserted each affiliation', () => {
    const asserted = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    expect(asserted!.artifacts[0].statement).toContain('Mayo Clinic recorded')

    const self = buildOrcidDossier({ record: selfAssertedRecord(), observedAt: OBSERVED_AT })
    expect(self!.artifacts[0].statement).toContain('ORCID did not verify it')
  })

  it('warns that an open-ended affiliation is not proof of current employment', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    const freshness = dossier!.limits.find(limit => limit.topic === 'Record freshness')
    expect(freshness?.explanation).toContain('no end date was entered')
  })

  it('treats missing works as silence, not as absence of research', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    expect(dossier!.limits.some(limit => limit.topic === 'Publications')).toBe(true)
    const coverage = dossier!.limits.find(limit => limit.topic === 'Coverage')
    expect(coverage?.explanation).toContain('silence, not evidence')
  })

  it('carries self-listed keywords as source-stated, not observed', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    const keyword = dossier!.technologies[0]
    expect(keyword.value).toBe('computational immunology')
    expect(keyword.provenance.basis).toBe('source_stated')
  })

  it('makes the ORCID iD deterministic and a self-listed GitHub link deterministic too', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    const orcidAnchor = dossier!.anchors.find(anchor => anchor.kind === 'orcid')
    expect(orcidAnchor?.strength).toBe('deterministic')

    const github = dossier!.anchors.find(anchor => anchor.kind === 'github_login')
    expect(github?.normalized).toBe('aokonkwo')
    expect(github?.strength).toBe('deterministic')
  })

  it('makes no seniority claim in the evidence surface', () => {
    const dossier = buildOrcidDossier({ record: record(), observedAt: OBSERVED_AT })
    expect(dossier!.limits.some(limit => limit.topic === 'Seniority')).toBe(true)
  })

  it('rejects a record with a malformed iD', () => {
    expect(
      buildOrcidDossier({
        record: { ...record(), 'orcid-identifier': { path: 'bogus' } },
        observedAt: OBSERVED_AT,
      }),
    ).toBeNull()
  })
})

describe('ORCID query planning', () => {
  it('quotes multi-word specialties so they survive as phrases', () => {
    const query = buildOrcidSearchQuery(
      discoveryIntent({ hypothesis: 'immunology researcher', capabilityTerms: ['computational immunology'] }),
    )
    expect(query).toBe('"computational immunology"')
  })

  it('returns empty rather than a bare query when nothing usable is supplied', () => {
    expect(buildOrcidSearchQuery(discoveryIntent({ hypothesis: '' }))).toBe('')
  })
})

describe('ORCID scout run', () => {
  it('resolves search hits into full records', async () => {
    const scout = createOrcidScout({
      fetchImpl: (async (url: string) => {
        const body = String(url).includes('expanded-search')
          ? { 'expanded-result': [{ 'orcid-id': ORCID }], 'num-found': 1 }
          : record()
        return new Response(JSON.stringify(body), { status: 200 })
      }) as unknown as typeof fetch,
    })

    const result = await scout.run(
      discoveryIntent({ hypothesis: 'immunology', capabilityTerms: ['computational immunology'], limit: 5 }),
      { landingZone: new MemoryLandingZone(), credits: new MemoryCreditLedger(100) },
    )

    expect(result.dossiers).toHaveLength(1)
    expect(result.dossiers[0].person.displayName).toBe('Amara Okonkwo')
    expect(result.report.deterministicAnchorsProduced).toBeGreaterThan(0)
  })

  it('reports an underivable query as a limitation, not an empty field', async () => {
    const scout = createOrcidScout({
      fetchImpl: (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch,
    })
    const result = await scout.run(discoveryIntent({ hypothesis: '', limit: 5 }), {
      landingZone: new MemoryLandingZone(),
      credits: new MemoryCreditLedger(100),
    })
    expect(result.report.warnings.join(' ')).toContain('not an absence of researchers')
    expect(result.creditsSpent).toBe(0)
  })
})
