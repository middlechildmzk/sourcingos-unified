import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { discoveryIntent, observedTechnology, observedTechnologyValues } from '../lib/connectors/contract-v33-3'
import { buildGitHubDossier, isSubstantiveRepository, classifyRepositoryRelationship } from '../lib/connectors/github-v2'
import { buildStackOverflowDossier, planStackOverflowStrategies, planStackOverflowTags } from '../lib/connectors/stackoverflow-v2'
import { dossierToSourceResult, findRetrievalLeaks, enforceRetrievalBoundary } from '../lib/connectors/source-truth-v33-3'
import {
  OBSERVED_AT,
  caseAGitHub,
  caseCGitHub,
  caseDStackOverflow,
  caseEGitHubOrganization,
  forkOnlyGitHub,
} from './fixtures/v33-3a-technical-talent-graph'

const ROLE_INTENT = discoveryIntent({
  hypothesis: 'Senior Kubernetes platform engineer with Terraform and AWS',
  capabilityTerms: ['kubernetes', 'terraform', 'aws', 'distributed systems'],
  location: 'Washington, DC',
  limit: 10,
})

describe('V33.3A regression gate: search criteria are never candidate evidence', () => {
  it('Case C — requested terms with no candidate-level support do not become skills', () => {
    const dossier = buildGitHubDossier(caseCGitHub)
    expect(dossier).not.toBeNull()

    const skills = observedTechnologyValues(dossier!.technologies).map(value => value.toLowerCase())
    expect(skills).toContain('go')
    expect(skills).toContain('postgresql')

    for (const requested of ['kubernetes', 'terraform', 'aws', 'amazon-web-services', 'distributed systems']) {
      expect(skills).not.toContain(requested)
    }

    const result = dossierToSourceResult(dossier!)
    const serialized = JSON.stringify({
      skills: result.skills,
      identitySignals: result.identitySignals,
      evidence: result.evidence.map(item => ({ label: item.label, detail: item.detail })),
    }).toLowerCase()
    expect(serialized).not.toContain('terraform')
  })

  it('Case D — tags the API returned for this specific user do become evidence', () => {
    const dossier = buildStackOverflowDossier(caseDStackOverflow)
    expect(dossier).not.toBeNull()

    const skills = observedTechnologyValues(dossier!.technologies)
    expect(skills).toContain('kubernetes')
    expect(skills).toContain('terraform')
    // The role also asked about AWS. Stack Exchange returned nothing for this
    // user under that tag, so it stays absent rather than defaulting to false.
    expect(skills).not.toContain('amazon-web-services')

    expect(findRetrievalLeaks(dossier!, ROLE_INTENT)).toEqual([])
  })

  it('flags a technology whose provenance points at the retrieval intent', () => {
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

    const leaks = findRetrievalLeaks(contaminated, ROLE_INTENT)
    expect(leaks).toHaveLength(1)
    expect(leaks[0].value).toBe('kubernetes')

    const { dossier: cleaned } = enforceRetrievalBoundary(contaminated, ROLE_INTENT)
    expect(observedTechnologyValues(cleaned.technologies)).not.toContain('kubernetes')
  })

  it('refuses to construct an observed technology from model inference or missing provenance', () => {
    expect(
      observedTechnology('kubernetes', {
        source: 'github',
        sourceField: 'repository.topics',
        sourceRecordId: 'repo:x/y',
        basis: 'model_inference',
        observedAt: OBSERVED_AT,
      }),
    ).toBeNull()

    expect(
      observedTechnology('kubernetes', {
        source: 'github',
        sourceField: '',
        sourceRecordId: '',
        basis: 'observed_artifact',
        observedAt: OBSERVED_AT,
      }),
    ).toBeNull()
  })

  it('keeps the connector source files free of an intent-to-skill assignment', () => {
    const root = path.resolve(process.cwd())
    for (const file of ['lib/connectors/github-v2.ts', 'lib/connectors/stackoverflow-v2.ts']) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      // The V22 contamination pattern, in any of its shapes.
      expect(source).not.toMatch(/skills:\s*uniq\(input\.skills\)/)
      expect(source).not.toMatch(/skills:\s*\[?\.\.\.\s*(intent|input)\.(capabilityTerms|skills)/)
    }
  })
})

describe('V33.3A regression gate: provenance survives', () => {
  it('every observed technology names a source field and a source record', () => {
    const github = buildGitHubDossier(caseAGitHub)!
    const stack = buildStackOverflowDossier(caseDStackOverflow)!

    for (const dossier of [github, stack]) {
      expect(dossier.technologies.length).toBeGreaterThan(0)
      for (const technology of dossier.technologies) {
        expect(technology.provenance.sourceField).toBeTruthy()
        expect(technology.provenance.sourceRecordId).toBeTruthy()
        expect(technology.provenance.observedAt).toBe(OBSERVED_AT)
        expect(technology.provenance.basis).not.toBe('model_inference')
      }
    }
  })

  it('carries artifact URLs and timestamps into the SourceResult evidence', () => {
    const result = dossierToSourceResult(buildGitHubDossier(caseAGitHub)!)
    const repoEvidence = result.evidence.find(item => item.id === 'github-repo:janesmith/helm-operator')
    expect(repoEvidence?.url).toBe('https://github.com/janesmith/helm-operator')
    expect(repoEvidence?.observedAt).toBe(OBSERVED_AT)
  })

  it('records what the source could not establish instead of leaving it silent', () => {
    const result = dossierToSourceResult(buildGitHubDossier(caseAGitHub)!)
    const limits = result.evidence.filter(item => item.label.startsWith('Not established by'))
    expect(limits.length).toBeGreaterThanOrEqual(3)
    expect(limits.map(item => item.detail).join(' ')).toContain('not evidence that the person lacks it')
  })
})

describe('V33.3A regression gate: non-person and derivative records', () => {
  it('Case E — an organization account cannot become a candidate person', () => {
    expect(buildGitHubDossier(caseEGitHubOrganization)).toBeNull()
  })

  it('a fork is recorded as an artifact but never promotes a technology', () => {
    const dossier = buildGitHubDossier(forkOnlyGitHub)!
    expect(dossier.artifacts).toHaveLength(1)
    expect(dossier.artifacts[0].derivative).toBe(true)
    expect(dossier.artifacts[0].relationship).toBe('activity_participant')
    expect(dossier.technologies).toEqual([])
    expect(dossier.limits.map(limit => limit.topic)).toContain('technology evidence')
  })

  it('distinguishes ownership, substantial contribution and activity history', () => {
    const dossier = buildGitHubDossier(caseAGitHub)!
    const owned = dossier.artifacts.find(artifact => artifact.artifactId === 'repo:janesmith/helm-operator')
    const substantial = dossier.artifacts.find(artifact => artifact.artifactId === 'commits:kubernetes/kubernetes')
    const incidental = dossier.artifacts.find(artifact => artifact.artifactId === 'commits:someorg/tiny')

    expect(owned?.relationship).toBe('owner_maintainer')
    expect(substantial?.relationship).toBe('substantial_contributor')
    expect(incidental?.relationship).toBe('activity_participant')
  })

  it('treats a trivial repository as too weak to support a person-level claim', () => {
    expect(
      isSubstantiveRepository({ fork: false, stargazers_count: 0, forks_count: 0, topics: [], description: '' }),
    ).toBe(false)
    expect(
      isSubstantiveRepository({ fork: false, stargazers_count: 0, forks_count: 0, topics: ['kubernetes'], description: '' }),
    ).toBe(true)
    expect(classifyRepositoryRelationship({ fork: true, owner: { login: 'jane' } }, 'jane')).toBe('activity_participant')
  })
})

describe('V33.3A regression gate: no candidate fit score and no outreach', () => {
  it('the SourceResult exposes no suitability percentage', () => {
    const result = dossierToSourceResult(buildGitHubDossier(caseAGitHub)!) as Record<string, unknown>
    for (const forbidden of ['fitScore', 'matchScore', 'suitability', 'rank', 'qualified']) {
      expect(result[forbidden]).toBeUndefined()
    }
    expect(JSON.stringify(result).toLowerCase()).not.toContain('qualified')
  })

  it('connector modules contain no contact or outreach action', () => {
    const root = path.resolve(process.cwd())
    for (const file of [
      'lib/connectors/github-v2.ts',
      'lib/connectors/stackoverflow-v2.ts',
      'lib/connectors/identity-anchors-v33-3.ts',
      'lib/connectors/source-truth-v33-3.ts',
    ]) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      expect(source).not.toMatch(/sendMessage|sendEmail|createOutreach|autoReject|autoShortlist/)
    }
  })
})

describe('V33.3A Stack Overflow discovery planning', () => {
  it('maps recruiter vocabulary onto real Stack Overflow tags', () => {
    const plan = planStackOverflowTags(ROLE_INTENT)
    expect(plan.primaryTags).toContain('kubernetes')
    expect(plan.primaryTags).toContain('terraform')
    expect(plan.validationTags).toContain('amazon-web-services')
  })

  it('produces several discovery strategies rather than one keyword request', () => {
    const strategies = planStackOverflowStrategies(ROLE_INTENT)
    expect(strategies.length).toBeGreaterThanOrEqual(4)
    expect(strategies.some(strategy => strategy.window === 'all_time')).toBe(true)
    expect(strategies.some(strategy => strategy.window === 'month')).toBe(true)
    expect(new Set(strategies.map(strategy => strategy.tag)).size).toBeGreaterThanOrEqual(2)
  })

  it('describes what was observed rather than asserting expertise', () => {
    const dossier = buildStackOverflowDossier(caseDStackOverflow)!
    const detail = dossierToSourceResult(dossier)
      .evidence.map(item => item.detail)
      .join(' ')
      .toLowerCase()
    expect(detail).toContain('top answerers')
    expect(detail).not.toContain('years of experience')
    expect(detail).not.toContain('expert with')
  })
})
