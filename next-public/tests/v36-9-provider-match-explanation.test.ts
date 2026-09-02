import { describe, expect, it } from 'vitest'
import { candidateObservationMatchExplanationV36_9 } from '@/lib/candidate-data/observation-match-explanation-v36-9'

const request = {
  query: 'RHEL admin with 5+ years near Annapolis Junction, MD with Secret clearance or higher',
  requirements: [
    { text: 'RHEL', mustHave: true },
    { text: '5+ years relevant experience', mustHave: true },
    { text: 'Secret clearance or higher', mustHave: true },
  ],
  titles: ['RHEL admin'],
  skills: ['RHEL', 'Linux'],
  locations: ['Annapolis Junction, MD'],
}

describe('V36.9 provider observation match explanation', () => {
  it('explains observed overlap without converting retrieval into qualification', () => {
    const explanation = candidateObservationMatchExplanationV36_9(request, {
      provider: 'pearch',
      providerPersonId: 'p1',
      displayName: 'Jane Doe',
      currentTitle: 'Senior RHEL Administrator',
      currentEmployer: 'Acme Federal',
      location: 'Annapolis Junction, MD',
      skills: ['RHEL', 'Linux', 'Ansible'],
      profileUrls: [],
      contactAvailability: { email: 'unknown', phone: 'unknown' },
      observedAt: '2026-09-02T20:00:00.000Z',
    })

    expect(explanation).toContain('title: RHEL admin')
    expect(explanation).toContain('skills: RHEL / Linux')
    expect(explanation).toContain('location: Annapolis Junction, MD')
    expect(explanation).toContain('5+ years relevant experience')
    expect(explanation).toContain('Secret clearance or higher')
    expect(explanation).toContain('Retrieval is not a qualification decision.')
  })

  it('does not claim overlap when normalized fields do not support it', () => {
    const explanation = candidateObservationMatchExplanationV36_9(request, {
      provider: 'data_vertex',
      providerPersonId: 'd1',
      displayName: 'Alex Example',
      currentTitle: 'Project Manager',
      location: 'Austin, TX',
      skills: ['Agile'],
      profileUrls: [],
      contactAvailability: { email: false, phone: false },
      observedAt: '2026-09-02T20:00:00.000Z',
    })

    expect(explanation).toContain('did not observe a direct title, skill, or location overlap')
    expect(explanation).toContain('Must-haves not verified in normalized provider fields')
  })
})
