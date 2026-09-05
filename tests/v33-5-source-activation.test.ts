import { describe, expect, it } from 'vitest'

import { newRunReport } from '../lib/connectors/contract-v33-3'
import { buildGitHubDossier } from '../lib/connectors/github-v2'
import { dossierToSourceResult } from '../lib/connectors/source-truth-v33-3'
import {
  canonicalizeTechnicalDossiers,
  preferTechnicalV2,
  technicalActivationBudget,
  technicalDiscoveryIntent,
} from '../lib/connectors/technical-v2-activation'
import { OBSERVED_AT, caseAGitHub, caseCGitHub } from './fixtures/v33-3a-technical-talent-graph'

const sourcePerson = dossierToSourceResult(buildGitHubDossier(caseAGitHub)!)

describe('V33.5 technical source activation', () => {
  it('keeps anonymous GitHub runs deliberately smaller than credentialed runs', () => {
    const anonymous = technicalActivationBudget('github', false)
    const credentialed = technicalActivationBudget('github', true)

    expect(anonymous.maxRequests).toBeLessThan(credentialed.maxRequests)
    expect(anonymous.maxPeople).toBeLessThan(credentialed.maxPeople)
    expect(anonymous.maxRequests).toBe(12)
    expect(credentialed.maxRequests).toBe(24)
    expect(technicalActivationBudget('stackoverflow').maxRequests).toBe(12)
  })

  it('treats recruiter language as retrieval intent rather than evidence', () => {
    const intent = technicalDiscoveryIntent({
      query: 'Senior Kubernetes platform engineer',
      skills: ['kubernetes', 'terraform'],
      location: 'Washington, DC',
      limit: 10,
    })

    expect(String(intent.hypothesis)).toBe('Senior Kubernetes platform engineer')
    expect(intent.capabilityTerms.map(String)).toEqual(['kubernetes', 'terraform'])
    expect(String(intent.location)).toBe('Washington, DC')
  })

  it('prefers a usable V2 person result and does not call fallback', async () => {
    let fallbackCalls = 0
    const report = newRunReport('github')
    const activated = await preferTechnicalV2({
      source: 'github',
      runV2: async () => ({ results: [sourcePerson], report, message: 'V2 healthy.' }),
      runFallback: async () => {
        fallbackCalls += 1
        return { results: [] }
      },
    })

    expect(activated.mode).toBe('v2')
    expect(activated.degraded).toBe(false)
    expect(activated.results).toHaveLength(1)
    expect(fallbackCalls).toBe(0)
  })

  it('falls back when V2 returns no eligible people and says so explicitly', async () => {
    const report = newRunReport('github')
    const activated = await preferTechnicalV2({
      source: 'github',
      runV2: async () => ({ results: [], report }),
      runFallback: async () => ({ results: [sourcePerson], message: 'Legacy GitHub remained available.' }),
    })

    expect(activated.mode).toBe('legacy_fallback')
    expect(activated.degraded).toBe(true)
    expect(activated.results).toHaveLength(1)
    expect(activated.message).toContain('V2 returned no eligible people')
    expect(activated.message).toContain('fallback')
  })

  it('falls back when V2 errors instead of turning a source outage into zero candidates', async () => {
    const activated = await preferTechnicalV2({
      source: 'stackoverflow',
      runV2: async () => {
        throw new Error('quota temporarily unavailable')
      },
      runFallback: async () => ({ results: [sourcePerson] }),
    })

    expect(activated.mode).toBe('legacy_fallback')
    expect(activated.degraded).toBe(true)
    expect(activated.results).toHaveLength(1)
    expect(activated.message).toContain('V2 degraded')
    expect(activated.message).toContain('fallback')
  })

  it('removes retrieval-contaminated observations before canonical SourceResult ingestion', () => {
    const dossier = buildGitHubDossier(caseCGitHub)!
    const contaminated = {
      ...dossier,
      technologies: [
        ...dossier.technologies,
        {
          value: 'kubernetes',
          provenance: {
            source: 'github' as const,
            sourceField: 'intent.capabilityTerms',
            sourceRecordId: 'search',
            basis: 'source_stated' as const,
            observedAt: OBSERVED_AT,
          },
        },
      ],
    }
    const intent = technicalDiscoveryIntent({
      query: 'Senior Kubernetes platform engineer',
      skills: ['kubernetes'],
      limit: 5,
    })
    const report = newRunReport('github')

    const [result] = canonicalizeTechnicalDossiers([contaminated], intent, report)

    expect(result.skills.map(value => value.toLowerCase())).not.toContain('kubernetes')
    expect(report.partial).toBe(true)
    expect(report.warnings.join(' ')).toContain('retrieval-contaminated')
  })
})
