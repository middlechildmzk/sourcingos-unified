import { describe, expect, it } from 'vitest'
import { buildRequirementAssessments } from '@/lib/requirement-assessment-v32'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
import type { RoleIntake } from '@/lib/role-workspace'

function role(mustHave: string): RoleIntake {
  return {
    title: 'Test role',
    location: 'Not specified',
    workMode: 'unknown',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: [mustHave],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: '',
  }
}

function claim(text: string): EvidenceClaim {
  return {
    id: `claim-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    fieldName: 'skill',
    claimedValue: text,
    detail: text,
    evidenceClass: 'verified_fact',
    baseEvidenceClass: 'verified_fact',
    confidenceScore: 90,
    source: 'github',
    sourceType: 'public_artifact',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    freshnessWindowDays: 180,
    freshness: 'fresh',
    reviewerStatus: 'unreviewed',
    permittedUse: 'research_only',
    containsPii: false,
    notes: [],
    spanStart: 0,
    spanEnd: text.length,
    spanText: text,
    sourceTextRef: `source:${text}`,
    spanValidated: true,
  }
}

describe('V35 reviewed qualification alias boundary', () => {
  it('does not let Pulumi satisfy a Terraform must-have merely because legacy search aliases grouped them', () => {
    const [assessment] = buildRequirementAssessments(role('Terraform'), [claim('Pulumi')])
    expect(assessment.state).toBe('unknown')
    expect(assessment.claims).toEqual([])
  })

  it('does not let FHIR satisfy EMR/EHR merely because the legacy search dictionary grouped them', () => {
    const [assessment] = buildRequirementAssessments(role('EMR/EHR'), [claim('FHIR')])
    expect(assessment.state).toBe('unknown')
  })

  it('keeps reviewed narrow equivalence such as Kubernetes and k8s usable for evidence matching', () => {
    const [assessment] = buildRequirementAssessments(role('Kubernetes'), [claim('k8s')])
    expect(assessment.state).toBe('supported')
  })

  it('keeps reviewed EMR/EHR abbreviation equivalence while excluding adjacent interoperability standards', () => {
    const [assessment] = buildRequirementAssessments(role('EMR/EHR'), [claim('EHR')])
    expect(assessment.state).toBe('supported')
  })

  it('does not let bare TS satisfy a TypeScript requirement', () => {
    const [assessment] = buildRequirementAssessments(role('TypeScript'), [claim('TS')])
    expect(assessment.state).toBe('unknown')
  })
})
