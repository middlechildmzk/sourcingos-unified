import { describe, expect, it } from 'vitest'
import { domainPackById, type DomainPackId } from '@/lib/domain-packs-v31'

const PACK_IDS: DomainPackId[] = ['general', 'technical', 'ai', 'healthcare', 'research', 'federal', 'finance', 'aviation']

const KNOWLEDGE_ANCHORS: Partial<Record<DomainPackId, string[]>> = {
  technical: ['capability combinations over title-only matching'],
  ai: ['artifact owners'],
  healthcare: ['authoritative registries'],
  research: ['persistent identifiers'],
  federal: ['not to manufacture'],
  finance: ['authoritative registration sources'],
  aviation: ['authoritative certificate data'],
  general: ['preserve unknowns'],
}

describe('V31 domain-pack knowledge is preserved until typed RIG migration', () => {
  for (const id of PACK_IDS) {
    it(`${id}: retains hand-authored evidence policy`, () => {
      const pack = domainPackById(id)
      expect(pack, `domain pack ${id} was removed before migration`).toBeDefined()
      expect(pack?.evidenceHints.length, `${id} evidence hints were lost`).toBeGreaterThan(0)
      expect(pack?.heuristics.length, `${id} heuristics were lost`).toBeGreaterThan(0)
      expect(pack?.guardrails.length, `${id} guardrails were lost`).toBeGreaterThan(0)
      const corpus = [...(pack?.evidenceHints || []), ...(pack?.heuristics || []), ...(pack?.guardrails || [])].join(' ').toLowerCase()
      for (const anchor of KNOWLEDGE_ANCHORS[id] || []) expect(corpus).toContain(anchor)
    })
  }
})
