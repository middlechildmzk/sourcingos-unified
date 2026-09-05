import { describe, expect, it } from 'vitest'
import {
  ENTITY_REGISTRY_V35,
  entityByIdV35,
  matchEntitiesV35,
} from '@/lib/entity-intelligence/registry-v35'
import {
  AUTHORITATIVE_SOURCE_BASELINES_V36_3,
  escoRecordV36_3,
  knowledgeImportReplayKeyV36_3,
  normalizeKnowledgeImportV36_3,
  onetRecordV36_3,
} from '@/lib/entity-intelligence/importers-v36-3'
import {
  ROLE_INTELLIGENCE_PACKETS_V36_3,
  buildRolePacketSourceTermsV36_3,
  rolePacketByIdV36_3,
} from '@/lib/entity-intelligence/role-packets-v36-3'
import { assessLocationRadiusV36_3, distanceMilesV36_3 } from '@/lib/entity-intelligence/radius-v36-3'
import { getSearchAssistSuggestions } from '@/lib/search-assist'
import type { EntityProvenance, EntityRelationship, IntelligenceEntity } from '@/lib/entity-intelligence/types-v35'

const TEST_PROVENANCE: EntityProvenance = {
  source: 'other', sourceRef: 'v36.3-test', version: 'v36.3', reviewState: 'reviewed',
}

function place(id: string, latitude?: number, longitude?: number): IntelligenceEntity {
  return {
    id,
    kind: 'place',
    canonicalLabel: id,
    aliases: [id.toLowerCase()],
    provenance: [TEST_PROVENANCE],
    metadata: { placeType: 'city', latitude, longitude },
  }
}

describe('V36.3 reviewed recruiting knowledge overlay', () => {
  it('materially expands the shared registry across recruiting domains', () => {
    expect(ENTITY_REGISTRY_V35.entities.length).toBeGreaterThan(100)
    for (const label of ['RHCSA', 'Platform Engineer', 'CISSP', 'Machine Learning Engineer', 'PA-C', 'FAA A&P', 'Federal Government Contracting']) {
      expect(ENTITY_REGISTRY_V35.entities.some(entity => entity.canonicalLabel === label), label).toBe(true)
    }
  })

  it('overrides dangerous TypeScript bare-TS legacy normalization', () => {
    const typescript = entityByIdV35('entity:skill:typescript')
    expect(typescript?.provenance.some(item => item.version === 'v36.3' && item.reviewState === 'reviewed')).toBe(true)
    expect(typescript?.aliases).toContain('typescript')
    expect(typescript?.aliases).not.toContain('ts')
    expect(matchEntitiesV35('TS/SCI systems administrator').some(item => item.entity.canonicalLabel === 'TypeScript')).toBe(false)
  })

  it('keeps related technologies and adjacent titles out of exact equivalence', () => {
    const forbiddenPairs = [
      ['entity:skill:kubernetes', 'entity:technology:eks'],
      ['entity:skill:terraform', 'entity:technology:pulumi'],
      ['entity:title:devsecops-engineer', 'entity:title:platform-engineer'],
      ['entity:title:devsecops-engineer', 'entity:occupation:site-reliability-engineer'],
      ['entity:title:data-scientist', 'entity:title:research-scientist'],
    ]
    for (const [from, to] of forbiddenPairs) {
      expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.fromEntityId === from && rel.toEntityId === to && rel.type === 'EXACT_EQUIVALENT')).toBe(false)
    }
  })

  it('keeps RN, NP and PA as distinct occupations and credentials', () => {
    const rn = entityByIdV35('entity:title:registered-nurse')
    const np = entityByIdV35('entity:title:nurse-practitioner')
    const pa = entityByIdV35('entity:title:physician-assistant')
    expect(new Set([rn?.id, np?.id, pa?.id]).size).toBe(3)
    expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.fromEntityId === np?.id && rel.toEntityId === pa?.id && rel.type === 'DO_NOT_INFER_FROM')).toBe(true)
    expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.fromEntityId === pa?.id && rel.toEntityId === np?.id && rel.type === 'DO_NOT_INFER_FROM')).toBe(true)
  })

  it('treats credentials as verification signals, not capability equivalence', () => {
    expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.fromEntityId === 'entity:credential:rhcsa' && rel.toEntityId === 'entity:skill:rhel' && rel.type === 'CREDENTIAL_FOR')).toBe(true)
    expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.fromEntityId === 'entity:certification:cissp' && rel.type === 'EXACT_EQUIVALENT')).toBe(false)
  })

  it('does not suggest Polygraph or stronger clearance as a similar Secret search concept', () => {
    const suggestions = getSearchAssistSuggestions('Secret').suggestions.map(item => item.value)
    expect(suggestions).not.toContain('Polygraph')
    expect(suggestions).not.toContain('TS/SCI')
    expect(suggestions).not.toContain('Top Secret')
  })
})

describe('V36.3 smart recruiter typeahead', () => {
  it('categorizes reviewed credentials and titles from the shared registry', () => {
    const credential = getSearchAssistSuggestions('RHCS').suggestions.find(item => item.value === 'RHCSA')
    const title = getSearchAssistSuggestions('Platf').suggestions.find(item => item.value === 'Platform Engineer')
    expect(credential?.kind).toBe('credential')
    expect(title?.kind).toBe('title')
  })

  it('refuses to silently resolve bare TS', () => {
    const result = getSearchAssistSuggestions('TS')
    expect(result.recognized.some(item => item.canonical === 'TypeScript' || item.canonical === 'Top Secret')).toBe(false)
    expect(result.suggestions.some(item => item.value === 'TypeScript' || item.value === 'Top Secret')).toBe(false)
  })

  it('keeps GitHub suggestions free of clearance/location/exclusion terms', () => {
    const result = getSearchAssistSuggestions('RHEL administrator Secret Annapolis Junction', { selectedLaneId: 'github' })
    const kinds = new Set(result.suggestions.map(item => item.kind))
    expect(kinds.has('clearance')).toBe(false)
    expect(kinds.has('location')).toBe(false)
    expect(kinds.has('exclusion')).toBe(false)
    expect(result.notes.join(' ').toLowerCase()).toContain('public technical evidence')
  })
})

describe('V36.3 authoritative importer contracts', () => {
  it('pins observed source baselines without making them permanent parser assumptions', () => {
    expect(AUTHORITATIVE_SOURCE_BASELINES_V36_3.onet.observedCurrentVersion).toBe('31.0')
    expect(AUTHORITATIVE_SOURCE_BASELINES_V36_3.esco.observedCurrentVersion).toBe('1.2.1')
    expect(AUTHORITATIVE_SOURCE_BASELINES_V36_3.naics.observedCurrentVersion).toBe('2022')
  })

  it('normalizes deterministically and yields replay-stable keys', () => {
    const records = [
      { externalId: '15-1252.00', kind: 'occupation' as const, canonicalLabel: 'Software Developers', aliases: ['Software Developer'] },
      { externalId: '15-1244.00', kind: 'occupation' as const, canonicalLabel: 'Network and Computer Systems Administrators', aliases: ['Systems Administrator'] },
    ]
    const a = normalizeKnowledgeImportV36_3({ source: 'onet', sourceVersion: '31.0', sourceRef: 'official-test-fixture', records })
    const b = normalizeKnowledgeImportV36_3({ source: 'onet', sourceVersion: '31.0', sourceRef: 'official-test-fixture', records: [...records].reverse() })
    expect(a.valid).toBe(true)
    expect(a.records).toEqual(b.records)
    expect(knowledgeImportReplayKeyV36_3(a.records[0])).toBe(`onet:31.0:${a.records[0].externalId}`)
  })

  it('quarantines ambiguous short aliases even when an importer requests equivalence', () => {
    const result = normalizeKnowledgeImportV36_3({
      source: 'esco', sourceVersion: '1.2.1', sourceRef: 'official-test-fixture',
      records: [{ externalId: 'urn:test:type-script', kind: 'skill', canonicalLabel: 'TypeScript', aliases: ['TS'], aliasPolicy: 'reviewed_equivalence' }],
    })
    expect(result.records[0].aliases.find(alias => alias.value === 'ts')?.disposition).toBe('quarantined')
  })

  it('rejects O*NET scored values without Scale ID and accepts them with Scale ID', () => {
    const withoutScale = normalizeKnowledgeImportV36_3({
      source: 'onet', sourceVersion: '31.0', sourceRef: 'official-test-fixture',
      records: [onetRecordV36_3({ onetSocCode: '15-1252.00', title: 'Software Developers', dataValue: 4.2 })],
    })
    expect(withoutScale.valid).toBe(false)
    expect(withoutScale.diagnostics.some(item => item.code === 'onet_scale_id_required')).toBe(true)

    const withScale = normalizeKnowledgeImportV36_3({
      source: 'onet', sourceVersion: '31.0', sourceRef: 'official-test-fixture',
      records: [onetRecordV36_3({ onetSocCode: '15-1252.00', title: 'Software Developers', dataValue: 4.2, scaleId: 'IM' })],
    })
    expect(withScale.valid).toBe(true)
    expect(withScale.records).toHaveLength(1)
  })

  it('preserves ESCO occupation-skill relationships instead of flattening skills into title aliases', () => {
    const occupation = escoRecordV36_3({
      uri: 'urn:esco:occupation:test', preferredLabel: 'systems administrator', kind: 'occupation',
      relationships: [{ toExternalId: 'urn:esco:skill:linux', type: 'RELATED_TECHNOLOGY', sourceRelation: 'essentialSkill' }],
    })
    const result = normalizeKnowledgeImportV36_3({ source: 'esco', sourceVersion: '1.2.1', sourceRef: 'official-test-fixture', records: [occupation] })
    expect(result.records[0].relationships[0]).toMatchObject({ toExternalId: 'urn:esco:skill:linux', sourceRelation: 'essentialSkill' })
    expect(result.records[0].aliases.some(alias => alias.value === 'linux')).toBe(false)
  })
})

describe('V36.3 geography/radius safety', () => {
  it('uses coordinates when both locations have trusted coordinates', () => {
    const anchor = place('anchor', 0, 0)
    const nearby = place('nearby', 0, 0.1)
    const distance = distanceMilesV36_3(anchor, nearby)
    expect(distance).not.toBeNull()
    expect(distance!).toBeGreaterThan(6)
    expect(distance!).toBeLessThan(8)
    const assessment = assessLocationRadiusV36_3({ anchor, candidateLocation: nearby, radiusMiles: 10 })
    expect(assessment.status).toBe('within_radius')
    expect(assessment.basis).toBe('coordinates')
    expect(assessment.candidateResidenceInferred).toBe(false)
  })

  it('falls back only to reviewed graph geography when coordinates are absent', () => {
    const anchor = place('anchor')
    const nearby = place('nearby')
    const relationship: EntityRelationship = {
      id: 'near-test', fromEntityId: anchor.id, toEntityId: nearby.id, type: 'NEAR', direction: 'symmetric', provenance: [TEST_PROVENANCE], confidence: 'strong',
    }
    const graph = assessLocationRadiusV36_3({ anchor, candidateLocation: nearby, radiusMiles: 25, relationships: [relationship] })
    expect(graph.status).toBe('graph_nearby')
    expect(graph.basis).toBe('graph')
    expect(graph.distanceMiles).toBeUndefined()
    expect(graph.candidateResidenceInferred).toBe(false)

    const unknown = assessLocationRadiusV36_3({ anchor, candidateLocation: place('unknown'), radiusMiles: 25 })
    expect(unknown.status).toBe('unknown')
    expect(unknown.explanation.toLowerCase()).toContain('will not invent proximity')
  })
})

describe('V36.3 Role Intelligence Packets', () => {
  it('covers a broad cross-domain archetype set', () => {
    expect(ROLE_INTELLIGENCE_PACKETS_V36_3.length).toBeGreaterThanOrEqual(15)
    expect(new Set(ROLE_INTELLIGENCE_PACKETS_V36_3.map(packet => packet.family)).size).toBeGreaterThanOrEqual(8)
  })

  it('keeps federal clearance as a verification gate while public GitHub terms stay capability-only', () => {
    const packet = rolePacketByIdV36_3('federal-cleared-infrastructure')
    expect(packet?.verificationGateEntityIds).toEqual(expect.arrayContaining(['entity:clearance:secret', 'entity:clearance:ts-sci']))
    const github = buildRolePacketSourceTermsV36_3('federal-cleared-infrastructure', 'github')
    expect(github.publicTechnicalSource).toBe(true)
    expect(github.executionClaim).toBe(false)
    expect(github.terms.some(term => /secret|clearance|ts\/sci|citizen/i.test(term))).toBe(false)
    expect(github.terms).toEqual(expect.arrayContaining(['Linux', 'Ansible']))
  })

  it('never claims a configured source strategy executed', () => {
    for (const packet of ROLE_INTELLIGENCE_PACKETS_V36_3) {
      expect(packet.sourceStrategies.every(source => source.executionClaim === false)).toBe(true)
      expect(packet.guardrails.join(' ').toLowerCase()).toContain('search intelligence')
    }
  })
})
