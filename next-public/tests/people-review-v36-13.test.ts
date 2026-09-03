import { describe, expect, it } from 'vitest'
import {
  bestPhoneChannelV36_13,
  contactSupportLabelV36_13,
  evidenceCoverageForObservationV36_13,
  orderObservationsByEvidenceV36_13,
  summarizeContactSignalsV36_13,
} from '../lib/people-review-v36-13'

const request = {
  query: 'RHEL administrator near Annapolis Junction, MD with Secret clearance and 5+ years',
  titles: ['RHEL administrator'],
  skills: ['RHEL', 'Linux'],
  locations: ['Annapolis Junction, MD'],
  requirements: [
    { text: 'RHEL', mustHave: true },
    { text: 'Linux', mustHave: true },
    { text: 'Secret clearance or higher', mustHave: true },
    { text: '5+ years relevant experience', mustHave: true },
  ],
  limit: 30,
  highFreshness: false,
}

const strong = {
  provider: 'exa',
  providerPersonId: 'a',
  displayName: 'Candidate A',
  currentTitle: 'Red Hat Enterprise Linux (RHEL) Administrator',
  location: 'Annapolis Junction, MD',
  skills: ['RHEL', 'Linux', 'Ansible'],
  profileUrls: [],
  providerExplanation: 'Public professional evidence references an active Secret clearance.',
}

const weak = {
  provider: 'contactout',
  providerPersonId: 'b',
  displayName: 'Candidate B',
  currentTitle: 'Research Assistant',
  location: 'Remote',
  skills: ['Research', 'Budget Planning'],
  profileUrls: [],
}

describe('V36.13 People Search review workbench helpers', () => {
  it('orders returned observations by visible requirement evidence without creating a fit score', () => {
    const ordered = orderObservationsByEvidenceV36_13([weak, strong], request)
    expect(ordered[0].providerPersonId).toBe('a')
    const coverage = evidenceCoverageForObservationV36_13(strong, request)
    expect(coverage.mustHaveObserved).toBeGreaterThan(2)
    expect(coverage.criteria.some(item => item.kind === 'experience' && item.status === 'not_evidenced')).toBe(true)
  })

  it('treats higher clearances as evidence for a Secret-or-higher requirement', () => {
    const coverage = evidenceCoverageForObservationV36_13({ ...strong, providerExplanation: 'TS/SCI clearance' }, request)
    const clearance = coverage.criteria.find(item => item.kind === 'clearance')
    expect(clearance?.status).toBe('observed')
  })

  it('synthesizes one primary contact per channel and keeps alternatives separate', () => {
    const summary = summarizeContactSignalsV36_13([
      { type: 'email', channelKind: 'work_email', value: 'candidate@acme.example', sourceProvider: 'people_data_labs', confidence: 'medium', ownershipConfidence: 'moderate', deliverability: 'unknown' },
      { type: 'email', channelKind: 'work_email', value: 'candidate@work.example', sourceProvider: 'anymail_finder', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'verified' },
      { type: 'email', channelKind: 'personal_email', value: 'candidate@personal.example', sourceProvider: 'signalhire', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'valid' },
      { type: 'phone', channelKind: 'mobile_phone', value: '+15555550101', sourceProvider: 'signalhire', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'unknown' },
      { type: 'phone', channelKind: 'work_phone', value: '+15555550102', sourceProvider: 'people_data_labs', confidence: 'medium', ownershipConfidence: 'moderate', deliverability: 'unknown' },
      { type: 'social_url', channelKind: 'social_profile', value: 'https://www.linkedin.com/in/candidate', sourceProvider: 'people_data_labs', confidence: 'high', ownershipConfidence: 'strong' },
      { type: 'social_url', channelKind: 'social_profile', value: 'https://social.example/candidate', sourceProvider: 'signalhire', confidence: 'low', ownershipConfidence: 'weak' },
      { type: 'email', channelKind: 'work_email', value: 'dead@work.example', sourceProvider: 'hunter', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'invalid' },
    ])

    expect(summary.workEmail.primary?.value).toBe('candidate@work.example')
    expect(summary.workEmail.alternatives).toHaveLength(1)
    expect(summary.personalEmail.primary?.value).toBe('candidate@personal.example')
    expect(bestPhoneChannelV36_13(summary).primary?.value).toBe('+15555550101')
    expect(summary.linkedin.primary?.value).toContain('linkedin.com')
    expect(summary.otherProfiles.primary?.value).toContain('social.example')
    expect(summary.rejected.some(item => item.value === 'dead@work.example')).toBe(true)
    expect(contactSupportLabelV36_13(summary.workEmail.primary)).toBe('Best supported')
  })
})
