import { describe, expect, it } from 'vitest'
import { buildCandidateProfessionalProfileV36_14 } from '@/lib/candidate-professional-profile-v36-14'

function storedProfile(source: string, sourceProfileId: string, richProfile: Record<string, unknown>) {
  return {
    id: `sp-${sourceProfileId}`,
    source,
    source_profile_id: sourceProfileId,
    last_seen_at: '2026-09-03T00:00:00.000Z',
    raw: {
      id: `${source}:${sourceProfileId}`,
      source,
      sourceProfileId,
      entityKind: 'person',
      raw: {
        resolver: 'candidate_data_provider_v36_14',
        provider: source,
        providerPersonId: sourceProfileId,
        richProfile,
      },
    },
  }
}

describe('V36.14 recruiter professional profile projection', () => {
  it('coalesces exact duplicate career observations while retaining all source provenance', () => {
    const sharedExperience = {
      title: 'Senior Linux Administrator',
      company: 'Example Systems',
      location: 'Maryland',
      startDate: '2022-01',
      current: true,
      description: 'Supports RHEL production environments.',
    }
    const profile = buildCandidateProfessionalProfileV36_14([
      storedProfile('exa', 'person-a', { experience: [sharedExperience] }),
      storedProfile('people_data_labs', 'person-b', { experience: [sharedExperience] }),
    ])

    expect(profile.experience).toHaveLength(1)
    expect(profile.experience[0].sources.map(source => source.source).sort()).toEqual(['exa', 'people_data_labs'])
    expect(profile.structuredSourceCount).toBe(2)
  })

  it('keeps conflicting or non-identical career observations separate rather than reconciling them silently', () => {
    const profile = buildCandidateProfessionalProfileV36_14([
      storedProfile('exa', 'person-a', { experience: [{ title: 'Linux Administrator', company: 'Example Systems', current: true }] }),
      storedProfile('coresignal', 'person-c', { experience: [{ title: 'Systems Engineer', company: 'Example Systems', current: true }] }),
    ])

    expect(profile.experience).toHaveLength(2)
    expect(profile.experience.map(item => item.title)).toContain('Linux Administrator')
    expect(profile.experience.map(item => item.title)).toContain('Systems Engineer')
    expect(profile.trustBoundary.toLowerCase()).toContain('conflicting')
  })

  it('projects summary, education, certifications and projects without inventing missing fields', () => {
    const profile = buildCandidateProfessionalProfileV36_14([
      storedProfile('people_data_labs', 'person-b', {
        summary: 'Infrastructure professional focused on Linux platforms.',
        education: [{ school: 'Example University', degree: 'B.S.', field: 'Information Systems' }],
        certifications: [{ name: 'Example Linux Certification', issuer: 'Example Institute' }],
        projects: [{ name: 'Automation Toolkit', technologies: ['Ansible', 'Linux'] }],
      }),
    ])

    expect(profile.summaries[0]?.text).toContain('Infrastructure professional')
    expect(profile.education[0]).toMatchObject({ school: 'Example University', degree: 'B.S.', field: 'Information Systems' })
    expect(profile.certifications[0]).toMatchObject({ name: 'Example Linux Certification', issuer: 'Example Institute' })
    expect(profile.projects[0]).toMatchObject({ name: 'Automation Toolkit', technologies: ['Ansible', 'Linux'] })
    expect(profile.experience).toHaveLength(0)
  })

  it('supports preview-mode stored JSON source results', () => {
    const source = storedProfile('exa', 'person-a', { experience: [{ title: 'RHEL Administrator', company: 'Example Federal Systems' }] })
    const profile = buildCandidateProfessionalProfileV36_14([{
      id: source.id,
      source: source.source,
      sourceProfileId: source.source_profile_id,
      rawText: JSON.stringify(source.raw),
      lastSeenAt: source.last_seen_at,
    }])

    expect(profile.experience[0]).toMatchObject({ title: 'RHEL Administrator', company: 'Example Federal Systems' })
  })
})
