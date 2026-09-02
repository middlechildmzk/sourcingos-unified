import { describe, expect, it } from 'vitest'
import { boundedTermIndex } from '@/lib/evidence-span'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
import { buildRequirementAssessments } from '@/lib/requirement-assessment-v32'
import { buildRoleCandidateIntelligenceV35 } from '@/lib/entity-intelligence/role-candidate-intelligence-v35'
import { setApprovedSearchEntityV35 } from '@/lib/entity-intelligence/search-approval-v35'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'

const NOW = '2026-09-02T00:00:00.000Z'

function role(overrides: Partial<RoleIntake> = {}): RoleIntake {
  return {
    title: 'RHEL administrator',
    location: 'Annapolis Junction, MD',
    workMode: 'onsite',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: ['RHEL'],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: 'RHEL administrator in or near Annapolis Junction, MD',
    ...overrides,
  }
}

function candidate(overrides: Partial<RoleCandidate> = {}): RoleCandidate {
  return {
    id: 'role-candidate-1',
    candidateId: 'candidate-1',
    name: 'Jordan Example',
    headline: 'Linux systems administrator',
    company: 'Example Systems',
    location: 'Fort Meade, MD',
    source: 'candidate_database',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: ['Ansible'],
    contactStatus: 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function claim(term: string, sourceText: string, sourceType: EvidenceClaim['sourceType'] = 'public_artifact'): EvidenceClaim {
  const start = boundedTermIndex(sourceText, term)
  if (start < 0) throw new Error(`Missing bounded test term ${term}`)
  return {
    id: `claim-${term.toLowerCase().replace(/\W+/g, '-')}`,
    candidateId: 'candidate-1',
    sourceProfileId: 'profile-1',
    fieldName: 'skills',
    claimedValue: term,
    detail: sourceText,
    evidenceClass: 'supported_inference',
    baseEvidenceClass: 'supported_inference',
    confidenceScore: 80,
    source: 'synthetic_source',
    sourceType,
    retrievedAt: NOW,
    freshnessWindowDays: 180,
    freshness: 'fresh',
    reviewerStatus: 'requires_review',
    permittedUse: 'research_only',
    containsPii: false,
    notes: [],
    spanStart: start,
    spanEnd: start + term.length,
    spanText: sourceText.slice(start, start + term.length),
    sourceTextRef: 'source:synthetic:1',
    spanValidated: true,
  }
}

function approvals() {
  let state = setApprovedSearchEntityV35(undefined, 'entity:technology:ansible', true, new Date('2026-09-02T00:01:00Z'))
  state = setApprovedSearchEntityV35(state, 'loc:installation:fort-meade-md', true, new Date('2026-09-02T00:02:00Z'))
  if (!state) throw new Error('Expected search approvals')
  return state
}

describe('V35.3 role ↔ candidate intelligence bridge', () => {
  it('shows approved Ansible as a discovery signal without letting it satisfy RHEL', () => {
    const intake = role()
    const person = candidate()
    const claims: EvidenceClaim[] = [claim('Ansible', 'Maintains Ansible automation for Linux fleets.')]
    const requirements = buildRequirementAssessments(intake, claims, person)
    const packet = buildRoleCandidateIntelligenceV35(intake, person, requirements, claims, approvals())

    expect(requirements.find(item => item.requirementText === 'RHEL')?.state).toBe('unknown')
    expect(packet.requirements.missingEvidence).toContain('RHEL')
    expect(packet.discoverySignals.find(item => item.label === 'Ansible')).toMatchObject({
      observed: true,
      state: 'search_only_observed',
    })
    expect(packet.explanation.join(' ')).toMatch(/retrieval, not qualification/i)
  })

  it('reports direct span-backed RHEL evidence as supported independently of search expansion', () => {
    const intake = role()
    const person = candidate()
    const claims = [claim('RHEL', 'Operates production RHEL servers and SELinux policy.')]
    const requirements = buildRequirementAssessments(intake, claims, person)
    const packet = buildRoleCandidateIntelligenceV35(intake, person, requirements, claims, approvals())

    expect(requirements.find(item => item.requirementText === 'RHEL')?.state).toBe('supported')
    expect(packet.requirements.supported).toContain('RHEL')
  })

  it('uses recruiter-approved Fort Meade only as search geography while preserving Annapolis Junction role truth', () => {
    const intake = role()
    const person = candidate({ location: 'Fort Meade, MD' })
    const packet = buildRoleCandidateIntelligenceV35(intake, person, buildRequirementAssessments(intake, [], person), [], approvals())

    expect(intake.location).toBe('Annapolis Junction, MD')
    expect(packet.geography.roleAnchor).toBe('Annapolis Junction, MD')
    expect(packet.geography.approvedSearchLocations).toContain('Fort Meade, MD')
    expect(packet.geography.state).toBe('compatible')
  })

  it('keeps candidate geography unknown when the profile location is not modeled rather than inventing distance', () => {
    const intake = role()
    const person = candidate({ location: 'Somewhere Else' })
    const packet = buildRoleCandidateIntelligenceV35(intake, person, buildRequirementAssessments(intake, [], person), [], approvals())

    expect(packet.geography.state).toBe('unknown')
    expect(packet.geography.explanation).toMatch(/remains unknown/i)
  })

  it('keeps public-profile clearance evidence verification-gated', () => {
    const intake = role({ clearance: 'Secret' })
    const person = candidate()
    const clearance = claim('Secret', 'Public profile says active Secret clearance.', 'public_profile')
    const requirements = buildRequirementAssessments(intake, [clearance], person)
    const packet = buildRoleCandidateIntelligenceV35(intake, person, requirements, [clearance], approvals())

    expect(requirements.find(item => item.kind === 'clearance')?.state).toBe('needs_verification')
    expect(packet.requirements.needsVerification).toContain('Secret')
  })
})
