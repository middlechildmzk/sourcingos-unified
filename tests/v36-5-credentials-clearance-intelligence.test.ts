import { describe, expect, it } from 'vitest'
import {
  CREDENTIAL_CLEARANCE_ENTITIES_V36_5,
  CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5,
  clearanceConceptTypeV36_5,
  federalTermSemanticsV36_5,
} from '@/lib/entity-intelligence/credentials-clearance-v36-5'
import { ENTITY_REGISTRY_V35, entityByIdV35 } from '@/lib/entity-intelligence/registry-v35'
import { getSearchAssistSuggestions } from '@/lib/search-assist'

describe('V36.5 credential intelligence breadth', () => {
  it('covers major recruiter credential ecosystems without treating credentials as skills', () => {
    const credentials = CREDENTIAL_CLEARANCE_ENTITIES_V36_5.filter(entity => entity.kind === 'credential')
    expect(credentials.length).toBeGreaterThanOrEqual(80)
    for (const label of [
      'CompTIA Security+', 'CISSP', 'GCIH', 'CCNA',
      'AWS Certified Solutions Architect – Associate', 'Microsoft Azure Administrator (AZ-104)',
      'Google Cloud Professional Cloud Architect', 'RHCE', 'CKA', 'HashiCorp Terraform Associate',
      'ServiceNow Certified System Administrator', 'Salesforce Certified Administrator',
      'PMP', 'CFA', 'RN License', 'Epic Certification', 'FAA A&P',
    ]) {
      expect(ENTITY_REGISTRY_V35.entities.some(entity => entity.canonicalLabel === label), label).toBe(true)
    }
  })

  it('keeps credential relationships typed as signals rather than exact qualification equivalence', () => {
    expect(CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5.some(rel => rel.fromEntityId === 'entity:credential:cncf-cka' && rel.toEntityId === 'entity:skill:kubernetes' && rel.type === 'CREDENTIAL_FOR')).toBe(true)
    expect(CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5.some(rel => rel.type === 'EXACT_EQUIVALENT')).toBe(false)
  })

  it('makes credential codes available to shared smart-filter typeahead', () => {
    expect(getSearchAssistSuggestions('AZ-10').suggestions.some(item => item.value.includes('AZ-104') && item.kind === 'credential')).toBe(true)
    expect(getSearchAssistSuggestions('CKA').recognized.some(item => item.type === 'certification')).toBe(true)
    expect(getSearchAssistSuggestions('GCI').suggestions.some(item => item.value === 'GCIH')).toBe(true)
  })
})

describe('V36.5 federal clearance / suitability semantics', () => {
  it('models security levels, access, suitability, polygraph, investigations and status separately', () => {
    const concepts = new Set(CREDENTIAL_CLEARANCE_ENTITIES_V36_5.filter(entity => entity.kind === 'clearance').map(clearanceConceptTypeV36_5))
    expect(concepts).toEqual(new Set(['clearance_level', 'access', 'suitability', 'polygraph', 'investigation', 'status']))
  })

  it('states that Public Trust is suitability, not a security clearance', () => {
    const publicTrust = entityByIdV35('entity:clearance:public-trust')!
    expect(clearanceConceptTypeV36_5(publicTrust)).toBe('suitability')
    expect(publicTrust.metadata?.notSecurityClearance).toBe(true)
    const semantics = federalTermSemanticsV36_5(publicTrust)
    expect(semantics.canBeTreatedAsClearanceLevel).toBe(false)
    expect(semantics.warning?.toLowerCase()).toContain('not a national-security clearance')
  })

  it('does not treat SCI, SAP, polygraphs or investigation tiers as standalone clearance levels', () => {
    for (const id of [
      'entity:clearance:sci-access', 'entity:clearance:sap-access',
      'entity:clearance:ci-polygraph', 'entity:clearance:full-scope-polygraph',
      'entity:clearance:tier-3-investigation', 'entity:clearance:tier-5-investigation',
    ]) {
      const entity = entityByIdV35(id)!
      expect(federalTermSemanticsV36_5(entity).canBeTreatedAsClearanceLevel, id).toBe(false)
    }
  })

  it('keeps every federal concept verification-gated and blocks unsafe inferences', () => {
    for (const entity of CREDENTIAL_CLEARANCE_ENTITIES_V36_5.filter(entity => entity.kind === 'clearance')) {
      expect(entity.metadata?.candidateFactRequiresExplicitEvidence, entity.canonicalLabel).toBe(true)
      expect(entity.metadata?.verificationRequired, entity.canonicalLabel).toBe(true)
    }
    expect(CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5.some(rel => rel.fromEntityId === 'entity:clearance:public-trust' && rel.toEntityId === 'entity:clearance:secret' && rel.type === 'DO_NOT_INFER_FROM')).toBe(true)
    expect(CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5.some(rel => rel.fromEntityId === 'entity:clearance:tier-5-investigation' && rel.toEntityId === 'entity:clearance:top-secret' && rel.type === 'DO_NOT_INFER_FROM')).toBe(true)
  })

  it('still refuses stronger-clearance/polygraph Find Similar broadening from Secret', () => {
    const values = getSearchAssistSuggestions('Secret').suggestions.map(item => item.value)
    for (const forbidden of ['Top Secret', 'TS/SCI', 'CI Polygraph', 'Full Scope Polygraph', 'Polygraph']) {
      expect(values, forbidden).not.toContain(forbidden)
    }
  })

  it('retains TypeScript vs TS ambiguity defense after the federal vocabulary expansion', () => {
    const result = getSearchAssistSuggestions('TS')
    expect(result.recognized.some(item => item.canonical === 'TypeScript' || item.canonical === 'Top Secret')).toBe(false)
    expect(ENTITY_REGISTRY_V35.relationships.some(rel => rel.type === 'DO_NOT_INFER_FROM' && rel.fromEntityId.includes('typescript') && rel.toEntityId === 'entity:clearance:ts-sci')).toBe(true)
  })
})
