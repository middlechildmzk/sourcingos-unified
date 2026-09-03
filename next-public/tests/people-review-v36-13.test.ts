import { describe, expect, it } from 'vitest'
import {
  bestPhoneChannelV36_13,
  contactSupportLabelV36_13,
  evidenceCoverageForObservationV36_13,
  observationPassesExplicitFiltersV36_13,
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
  currentEmployer: 'Acme Systems',
  location: 'Annapolis Junction, MD',
  skills: ['RHEL', 'Linux', 'Ansible', 'Secret clearance'],
  profileUrls: [],
  providerExplanation: 'Retrieval rationale can mention anything but is not candidate evidence.',
}

const weak = {
  provider: 'contactout',
  providerPersonId: 'b',
  displayName: 'Candidate B',
  currentTitle: 'Research Assistant',
  currentEmployer: 'Example Research',
  location: 'Remote',
  skills: ['Research', 'Budget Planning'],
  profileUrls: [],
}

const email = (local: string, domain: string) => `${local}${String.fromCharCode(64)}${domain}`

describe('V36.13 People Search review workbench helpers', () => {
  it('orders returned observations by visible requirement evidence without creating a fit score', () => {
    const ordered = orderObservationsByEvidenceV36_13([weak, strong], request)
    expect(ordered[0].providerPersonId).toBe('a')
    const coverage = evidenceCoverageForObservationV36_13(strong, request)
    expect(coverage.mustHaveObserved).toBeGreaterThan(2)
    expect(coverage.criteria.some(item => item.kind === 'experience' && item.status === 'not_evidenced')).toBe(true)
  })

  it('treats higher clearances in normalized candidate fields as evidence for a Secret-or-higher requirement', () => {
    const coverage = evidenceCoverageForObservationV36_13({ ...strong, skills: ['RHEL', 'Linux', 'TS/SCI'] }, request)
    const clearance = coverage.criteria.find(item => item.kind === 'clearance')
    expect(clearance?.status).toBe('observed')
  })

  it('never upgrades provider retrieval rationale into candidate clearance evidence', () => {
    const coverage = evidenceCoverageForObservationV36_13({ ...weak, providerExplanation: 'Strong match: active TS/SCI clearance.' }, request)
    const clearance = coverage.criteria.find(item => item.kind === 'clearance')
    expect(clearance?.status).toBe('not_evidenced')
  })

  it('deduplicates semantically equivalent employer criteria', () => {
    const employerRequest = {
      ...request,
      companies: ['Maximus'],
      requirements: [{ text: 'Current or relevant employer: Maximus', mustHave: true }],
      skills: [],
      locations: [],
      titles: [],
    }
    const coverage = evidenceCoverageForObservationV36_13({ ...strong, currentEmployer: 'Maximus' }, employerRequest)
    expect(coverage.criteria.filter(item => item.label.toLowerCase().includes('maximus'))).toHaveLength(1)
  })

  it('applies explicit recruiter filters as constraints, including missing-location failure', () => {
    expect(observationPassesExplicitFiltersV36_13(strong, { location: 'Annapolis Junction, MD', skills: 'RHEL, Linux' })).toBe(true)
    expect(observationPassesExplicitFiltersV36_13(weak, { location: 'Annapolis Junction, MD' })).toBe(false)
    expect(observationPassesExplicitFiltersV36_13({ ...strong, location: undefined }, { location: 'Annapolis Junction, MD' })).toBe(false)
    expect(observationPassesExplicitFiltersV36_13(strong, { company: 'Acme', title: 'RHEL' })).toBe(true)
  })

  it('synthesizes one primary contact per channel and keeps alternatives separate', () => {
    const fallbackWork = email('candidate', 'acme.invalid')
    const primaryWork = email('candidate', 'work.invalid')
    const personal = email('candidate', 'personal.invalid')
    const invalidWork = email('dead', 'work.invalid')
    const summary = summarizeContactSignalsV36_13([
      { type: 'email', channelKind: 'work_email', value: fallbackWork, sourceProvider: 'people_data_labs', confidence: 'medium', ownershipConfidence: 'moderate', deliverability: 'unknown' },
      { type: 'email', channelKind: 'work_email', value: primaryWork, sourceProvider: 'anymail_finder', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'verified' },
      { type: 'email', channelKind: 'personal_email', value: personal, sourceProvider: 'signalhire', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'valid' },
      { type: 'phone', channelKind: 'mobile_phone', value: '+15555550101', sourceProvider: 'signalhire', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'unknown' },
      { type: 'phone', channelKind: 'work_phone', value: '+15555550102', sourceProvider: 'people_data_labs', confidence: 'medium', ownershipConfidence: 'moderate', deliverability: 'unknown' },
      { type: 'social_url', channelKind: 'social_profile', value: 'https://www.linkedin.com/in/candidate', sourceProvider: 'people_data_labs', confidence: 'high', ownershipConfidence: 'strong' },
      { type: 'social_url', channelKind: 'social_profile', value: 'https://social.invalid/candidate', sourceProvider: 'signalhire', confidence: 'low', ownershipConfidence: 'weak' },
      { type: 'email', channelKind: 'work_email', value: invalidWork, sourceProvider: 'hunter', confidence: 'high', ownershipConfidence: 'strong', deliverability: 'invalid' },
    ])

    expect(summary.workEmail.primary?.value).toBe(primaryWork)
    expect(summary.workEmail.alternatives).toHaveLength(1)
    expect(summary.personalEmail.primary?.value).toBe(personal)
    expect(bestPhoneChannelV36_13(summary).primary?.value).toBe('+15555550101')
    expect(summary.linkedin.primary?.value).toContain('linkedin.com')
    expect(summary.otherProfiles.primary?.value).toContain('social.invalid')
    expect(summary.rejected.some(item => item.value === invalidWork)).toBe(true)
    expect(contactSupportLabelV36_13(summary.workEmail.primary)).toBe('Best supported')
  })
})
