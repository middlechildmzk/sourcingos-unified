import { describe, expect, it } from 'vitest'
import { ENTITY_REGISTRY_V35, matchEntitiesV35 } from '@/lib/entity-intelligence/registry-v35'
import { suggestEntitiesV35 } from '@/lib/entity-intelligence/suggest-v35'

describe('V35 shared entity intelligence', () => {
  it('adapts the existing taxonomy into versioned provenance-carrying entities', () => {
    expect(ENTITY_REGISTRY_V35.version).toBe('v35.2')
    expect(ENTITY_REGISTRY_V35.entities.length).toBeGreaterThan(40)
    expect(ENTITY_REGISTRY_V35.entities.every(entity => entity.id && entity.canonicalLabel && entity.provenance.length > 0)).toBe(true)
  })

  it('recognizes RHEL as Red Hat Enterprise Linux and keeps related concepts as inactive suggestions', () => {
    const result = suggestEntitiesV35({ query: 'RHEL administrator', includeRelated: true })
    const rhel = result.matches.find(item => item.entity.canonicalLabel === 'Red Hat Enterprise Linux')
    expect(rhel).toBeDefined()
    expect(result.related.some(item => item.entity.canonicalLabel === 'Ansible')).toBe(true)
    expect(result.related.some(item => item.entity.canonicalLabel === 'SELinux')).toBe(true)
    expect(result.related.some(item => item.entity.canonicalLabel === 'RHCE')).toBe(true)
    expect(result.related.every(item => item.activation === 'suggested_inactive')).toBe(true)
  })

  it('does not confuse TS/SCI with TypeScript', () => {
    const matches = matchEntitiesV35('TS/SCI cleared systems administrator')
    expect(matches.some(item => item.entity.canonicalLabel === 'TS/SCI')).toBe(true)
    expect(matches.some(item => item.entity.canonicalLabel === 'TypeScript')).toBe(false)
  })

  it('keeps search adjacency typed separately from normalization', () => {
    const result = suggestEntitiesV35({ query: 'Kubernetes', includeRelated: true })
    expect(result.matches.some(item => item.entity.canonicalLabel === 'Kubernetes')).toBe(true)
    const related = result.related.find(item => item.entity.canonicalLabel === 'Terraform')
    expect(related?.relationship?.type).toBe('RELATED_TECHNOLOGY')
    expect(related?.activation).toBe('suggested_inactive')
  })

  it('marks legacy expansion edges as reviewable discovery hypotheses rather than authoritative equivalence', () => {
    const legacyEdges = ENTITY_REGISTRY_V35.relationships.filter(edge => edge.provenance.some(p => p.source === 'legacy_search_expansions'))
    expect(legacyEdges.length).toBeGreaterThan(0)
    expect(legacyEdges.every(edge => edge.provenance.some(p => p.reviewState === 'needs_review'))).toBe(true)
    expect(legacyEdges.some(edge => edge.type === 'EXACT_EQUIVALENT')).toBe(false)
  })
})
