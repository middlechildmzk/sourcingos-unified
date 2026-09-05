import { describe, expect, it } from 'vitest'
import { evidenceBearingFirstReviewBatch, type ReviewSlateDiscovery } from '@/lib/agent-review-slate-v33-3'
import type { RoleIntake } from '@/lib/role-workspace'
import type { SourceResult } from '@/lib/source-types'

function role(overrides: Partial<RoleIntake>): RoleIntake {
  return {
    title: 'Unspecified role',
    location: 'Not specified',
    workMode: 'unknown',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: [],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: '',
    ...overrides,
  }
}

function discovery(id: string, skills: string[], location = 'Not specified'): ReviewSlateDiscovery {
  const observedAt = '2026-09-01T00:00:00.000Z'
  const sourceResult: SourceResult = {
    id: `github:${id}`,
    source: 'github',
    sourceProfileId: id,
    entityKind: 'person',
    displayName: `Candidate ${id}`,
    headline: skills.join(' / '),
    location: location === 'Not specified' ? undefined : location,
    profileUrl: `https://github.com/${id}`,
    skills,
    evidence: skills.map((skill, index) => ({
      id: `${id}-e${index}`,
      label: `Observed ${skill}`,
      detail: `Public work evidence references ${skill}.`,
      source: 'github',
      confidence: 'medium',
      observedAt,
    })),
    contactSignals: [],
    identitySignals: [],
    refreshedAt: observedAt,
  }
  return {
    sourceKey: 'github',
    sourceId: id,
    sourceUrl: sourceResult.profileUrl,
    displayName: sourceResult.displayName,
    headline: sourceResult.headline,
    location: sourceResult.location,
    evidence: sourceResult.evidence.map(item => ({ kind: 'public_work', label: item.label, value: item.detail, observedAt: item.observedAt })),
    identityConfidence: 0.7,
    profileQuality: 0.8,
    saveEligible: true,
    sourceResult,
  }
}

describe('V34 cross-domain first-review evidence admission', () => {
  it('does not admit a TypeScript expert to an RHEL slate and keeps years/clearance unverified', () => {
    const intake = role({
      title: 'RHEL administrator',
      location: 'Annapolis Junction, MD',
      clearance: 'Secret or higher',
      mustHaves: ['RHEL', '5+ years relevant experience'],
    })
    const wrong = discovery('typescript-person', ['TypeScript', 'React'], 'Fort Meade, MD')
    const right = discovery('rhel-person', ['RHEL', 'Linux', 'Ansible'], 'Fort Meade, MD')
    const result = evidenceBearingFirstReviewBatch([wrong, right], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['rhel-person'])
    const wrongCheck = result.checks.find(check => check.discovery.sourceId === 'typescript-person')!
    expect(wrongCheck.admitted).toBe(false)
    expect(wrongCheck.explanation).toMatch(/mandatory RHEL/i)
    const rightCheck = result.checks.find(check => check.discovery.sourceId === 'rhel-person')!
    expect(rightCheck.matchedMustHaves).toContain('RHEL')
    expect(rightCheck.unverifiedRequirements).toEqual(expect.arrayContaining([
      '5+ years relevant experience',
      'Clearance: Secret or higher',
    ]))
  })

  it('requires both TypeScript and React when both are recruiter-approved frontend must-haves', () => {
    const intake = role({ title: 'Senior Frontend Engineer', mustHaves: ['TypeScript', 'React'] })
    const partial = discovery('ts-only', ['TypeScript'])
    const complete = discovery('ts-react', ['TypeScript', 'React'])
    const result = evidenceBearingFirstReviewBatch([partial, complete], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['ts-react'])
    expect(result.checks.find(check => check.discovery.sourceId === 'ts-only')?.explanation).toMatch(/mandatory React/i)
  })

  it('requires the full approved cybersecurity skill pair rather than broad security adjacency', () => {
    const intake = role({ title: 'SOC Analyst', mustHaves: ['Splunk', 'SIEM'] })
    const partial = discovery('splunk-only', ['Splunk', 'cybersecurity'])
    const complete = discovery('soc-complete', ['Splunk', 'SIEM', 'incident response'])
    const result = evidenceBearingFirstReviewBatch([partial, complete], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['soc-complete'])
    expect(result.checks.find(check => check.discovery.sourceId === 'splunk-only')?.matchedMustHaves).toEqual(['Splunk'])
  })

  it('requires both observed AI capabilities for an AI/ML first batch', () => {
    const intake = role({ title: 'Machine Learning Engineer', mustHaves: ['PyTorch', 'LLM'] })
    const partial = discovery('pytorch-only', ['PyTorch'])
    const complete = discovery('ml-complete', ['PyTorch', 'LLM'])
    const result = evidenceBearingFirstReviewBatch([partial, complete], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['ml-complete'])
  })

  it('requires all approved cloud/devops capabilities instead of admitting Kubernetes-only profiles', () => {
    const intake = role({ title: 'DevOps Engineer', mustHaves: ['Kubernetes', 'Terraform', 'AWS'] })
    const partial = discovery('k8s-only', ['Kubernetes'])
    const complete = discovery('devops-complete', ['Kubernetes', 'Terraform', 'AWS'])
    const result = evidenceBearingFirstReviewBatch([partial, complete], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['devops-complete'])
  })

  it('understands common EMR/EHR evidence variants for clinical matching', () => {
    const intake = role({ title: 'Clinical Informatics Specialist', mustHaves: ['Epic', 'EMR/EHR'] })
    const partial = discovery('epic-only', ['Epic'])
    const complete = discovery('clinical-complete', ['Epic', 'EMR'])
    const result = evidenceBearingFirstReviewBatch([partial, complete], intake)

    expect(result.batch.map(item => item.sourceId)).toEqual(['clinical-complete'])
    expect(result.checks.find(check => check.discovery.sourceId === 'epic-only')?.explanation).toMatch(/EMR\/EHR/i)
  })
})
