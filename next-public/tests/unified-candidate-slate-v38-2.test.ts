import { describe, expect, it } from 'vitest'
import { buildUnifiedCandidateSlateV38_2, maskedCandidateNameV38_2 } from '../lib/candidate-data/unified-candidate-slate-v38-2'
import type { CandidateProviderObservationV36_8 } from '../lib/candidate-data/types-v36-8'

const now = '2026-09-04T12:00:00.000Z'

function observation(overrides: Partial<CandidateProviderObservationV36_8> & Pick<CandidateProviderObservationV36_8, 'provider' | 'providerPersonId' | 'displayName'>): CandidateProviderObservationV36_8 {
  return {
    skills: [],
    profileUrls: [],
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    observedAt: now,
    ...overrides,
  }
}

describe('V38.2 unified candidate slate', () => {
  it('recognizes provider-masked candidate names without treating ordinary x names as masked', () => {
    expect(maskedCandidateNameV38_2('Jxxxx Sxxxx')).toBe(true)
    expect(maskedCandidateNameV38_2('Private Member')).toBe(true)
    expect(maskedCandidateNameV38_2('Xavier Smith')).toBe(false)
    expect(maskedCandidateNameV38_2('Xiong Li')).toBe(false)
  })

  it('groups observations that share an approved deterministic GitHub identity anchor', () => {
    const slate = buildUnifiedCandidateSlateV38_2([
      observation({
        provider: 'pearch',
        providerPersonId: 'p-1',
        displayName: 'Rxxxx Axxxx',
        currentTitle: 'RHEL Administrator',
        profileUrls: [{ kind: 'github', url: 'https://github.com/radmin' }],
        skills: ['RHEL'],
      }),
      observation({
        provider: 'coresignal',
        providerPersonId: 'c-9',
        displayName: 'Rakesh Anand',
        currentEmployer: 'Acme Defense',
        location: 'Maryland',
        profileUrls: [{ kind: 'github', url: 'https://github.com/radmin/' }],
        skills: ['Red Hat Enterprise Linux', 'Ansible'],
        richProfile: { experience: [{ title: 'Linux Administrator', company: 'Acme Defense' }] },
      }),
    ])

    expect(slate.rawObservationCount).toBe(2)
    expect(slate.unifiedCandidateCount).toBe(1)
    expect(slate.groupedObservationCount).toBe(1)
    expect(slate.observations[0].displayName).toBe('Rakesh Anand')
    expect(slate.observations[0].skills).toEqual(expect.arrayContaining(['RHEL', 'Red Hat Enterprise Linux', 'Ansible']))
    expect(slate.observations[0].identityCluster?.providers).toEqual(['coresignal', 'pearch'])
    expect(slate.observations[0].identityCluster?.persistentMergePerformed).toBe(false)
  })

  it('does not use LinkedIn overlap as deterministic identity authority', () => {
    const slate = buildUnifiedCandidateSlateV38_2([
      observation({
        provider: 'contactout',
        providerPersonId: 'co-1',
        displayName: 'Rxxxx Axxxx',
        profileUrls: [{ kind: 'linkedin', url: 'https://linkedin.com/in/rakesh-a' }],
      }),
      observation({
        provider: 'coresignal',
        providerPersonId: 'cs-1',
        displayName: 'Rakesh Anand',
        profileUrls: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/rakesh-a/' }],
      }),
    ])

    expect(slate.unifiedCandidateCount).toBe(2)
    expect(slate.groupedObservationCount).toBe(0)
  })

  it('does not fuse conflicting explicit names even when a public-professional anchor overlaps', () => {
    const slate = buildUnifiedCandidateSlateV38_2([
      observation({
        provider: 'exa',
        providerPersonId: 'e-1',
        displayName: 'Alex Smith',
        profileUrls: [{ kind: 'stackoverflow', url: 'https://stackoverflow.com/users/123/alex' }],
      }),
      observation({
        provider: 'serper',
        providerPersonId: 's-1',
        displayName: 'Jordan Lee',
        profileUrls: [{ kind: 'stackoverflow', url: 'https://stackoverflow.com/users/123/alex' }],
      }),
    ])

    expect(slate.unifiedCandidateCount).toBe(2)
  })

  it('fills missing rich profile fields from independently anchored observations without inventing evidence', () => {
    const slate = buildUnifiedCandidateSlateV38_2([
      observation({
        provider: 'exa',
        providerPersonId: 'e-2',
        displayName: 'Ada Lovelace',
        profileUrls: [{ kind: 'personal', url: 'https://ada.example.dev' }],
        richProfile: { summary: 'Infrastructure engineer.', experience: [{ title: 'Linux Engineer', company: 'Northwind' }] },
      }),
      observation({
        provider: 'coresignal',
        providerPersonId: 'c-2',
        displayName: 'Ada Lovelace',
        currentEmployer: 'Northwind',
        location: 'Baltimore, MD',
        profileUrls: [{ kind: 'personal', url: 'https://ada.example.dev/' }],
        richProfile: { certifications: [{ name: 'RHCE' }] },
      }),
    ])

    const person = slate.observations[0]
    expect(person.currentEmployer).toBe('Northwind')
    expect(person.location).toBe('Baltimore, MD')
    expect(person.richProfile?.experience?.[0].title).toBe('Linux Engineer')
    expect(person.richProfile?.certifications?.[0].name).toBe('RHCE')
  })
})
