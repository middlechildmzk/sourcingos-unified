import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { evidenceBearingFirstReviewBatch, type ReviewSlateDiscovery } from '@/lib/agent-review-slate-v33-3'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import type { SourceResult } from '@/lib/source-types'

const exactPrompt = 'RHEL admin with 5+ years of experience in or near annapolis junction, MD with a secret security clearance or higher'

function source(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:person',
    source: 'github',
    sourceProfileId: 'person',
    entityKind: 'person',
    displayName: 'Example Person',
    headline: 'Systems administrator',
    location: 'Annapolis Junction, Maryland',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-09-01T00:00:00.000Z',
    raw: {},
    ...overrides,
  }
}

function discovery(result: SourceResult): ReviewSlateDiscovery {
  return {
    sourceKey: result.source as ReviewSlateDiscovery['sourceKey'],
    sourceId: result.sourceProfileId,
    sourceUrl: result.profileUrl,
    displayName: result.displayName,
    headline: result.headline,
    organization: result.organization,
    location: result.location,
    evidence: result.evidence.map(item => ({ kind: 'source_evidence', label: item.label, value: item.detail, url: item.url, observedAt: item.observedAt })),
    identityConfidence: 80,
    profileQuality: 80,
    saveEligible: true,
    sourceResult: result,
  }
}

describe('V33.10 explicit match provenance', () => {
  it('preserves the exact RHEL recruiter request as role truth', () => {
    const result = interpretRoleBrief(exactPrompt)
    expect(result.intake.title).toBe('RHEL admin')
    expect(result.intake.location).toBe('Annapolis Junction, MD')
    expect(result.intake.clearance).toBe('Secret or higher')
    expect(result.intake.mustHaves).toContain('RHEL')
    expect(result.intake.mustHaves).toContain('5+ years relevant experience')
    expect(result.intake.location.toLowerCase()).not.toContain('or near')
  })

  it('keeps clearance in the role/search contract without leaking it into public connector queries', () => {
    const role = interpretRoleBrief(exactPrompt).intake
    const plan = buildCanonicalAgenticSearchPlan(role)
    const clearanceLane = plan.lanes.find(lane => lane.id === 'clearance_first')
    expect(clearanceLane).toBeTruthy()
    expect(clearanceLane?.query).toMatch(/secret/i)
    const publicTasks = clearanceLane?.tasks.filter(task => task.connectorKeys?.length) || []
    expect(publicTasks.length).toBeGreaterThan(0)
    publicTasks.forEach(task => expect(task.query).not.toMatch(/secret|clearance/i))
    expect(clearanceLane?.tasks.some(task => task.surface === 'clearancejobs' && /secret/i.test(task.query))).toBe(true)
  })

  it('does not admit a generic Linux/sysadmin profile when RHEL is a mandatory observable must-have', () => {
    const role = interpretRoleBrief(exactPrompt).intake
    const generic = discovery(source({
      id: 'github:generic',
      sourceProfileId: 'generic',
      skills: ['Linux'],
      headline: 'Linux systems administrator',
    }))
    const result = evidenceBearingFirstReviewBatch([generic], role)
    expect(result.batch).toEqual([])
    expect(result.checks[0].admitted).toBe(false)
    expect(result.checks[0].explanation).toMatch(/mandatory RHEL/i)
  })

  it('admits observed RHEL evidence while keeping years and clearance explicitly unverified', () => {
    const role = interpretRoleBrief(exactPrompt).intake
    const rhel = discovery(source({
      id: 'github:rhel-person',
      sourceProfileId: 'rhel-person',
      skills: ['RHEL', 'Shell'],
      headline: 'Red Hat Linux systems administrator',
      evidence: [{
        id: 'repo-rhel',
        label: 'Public repository contribution signal',
        detail: 'Contributor to a public Red Hat Enterprise Linux automation repository.',
        source: 'github',
        confidence: 'high',
        observedAt: '2026-09-01T00:00:00.000Z',
      }],
    }))
    const result = evidenceBearingFirstReviewBatch([rhel], role)
    expect(result.batch).toEqual([rhel])
    expect(result.checks[0].matchedMustHaves).toContain('RHEL')
    expect(result.checks[0].unverifiedRequirements).toContain('5+ years relevant experience')
    expect(result.checks[0].unverifiedRequirements).toContain('Clearance: Secret or higher')
    expect(result.checks[0].explanation).toMatch(/Still unverified:.*5\+ years.*Clearance: Secret or higher/i)
  })

  it('treats the Fort Meade / Annapolis Junction cluster as compatible without broadening to all Maryland', () => {
    const role = interpretRoleBrief(exactPrompt).intake
    const near = discovery(source({
      id: 'github:near',
      sourceProfileId: 'near',
      location: 'Fort Meade, MD',
      skills: ['RHEL'],
    }))
    const far = discovery(source({
      id: 'github:far',
      sourceProfileId: 'far',
      location: 'Ocean City, Maryland',
      skills: ['RHEL'],
    }))
    const result = evidenceBearingFirstReviewBatch([near, far], role)
    expect(result.batch).toEqual([near])
    expect(result.checks.find(check => check.discovery === near)?.locationState).toBe('compatible')
    expect(result.checks.find(check => check.discovery === far)?.locationState).toBe('outside_search_area')
  })
})
