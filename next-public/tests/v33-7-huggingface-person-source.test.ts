import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { classifyRealSourceResults } from '@/lib/entity-classification'
import { discoverHuggingFacePeople, huggingFaceRetrievalTerms } from '@/lib/connectors/huggingface-person-v33-7'
import type { RoleIntake, } from '@/lib/role-workspace'

function intake(overrides: Partial<RoleIntake>): RoleIntake {
  return {
    title: 'Machine Learning Engineer',
    location: 'Remote',
    workMode: 'remote',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: ['PyTorch', 'LLM'],
    niceToHaves: ['Transformers'],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: ['AI Engineer'],
    hiringManagerNotes: '',
    rawDescription: 'Machine Learning Engineer with PyTorch and LLM experience',
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('V33.7 Hugging Face person source', () => {
  it('activates Hugging Face for AI/ML roles but not ordinary infrastructure roles', () => {
    const aiPlan = buildCanonicalAgenticSearchPlan(intake({}))
    const aiConnectors = aiPlan.lanes.flatMap(lane => lane.tasks.flatMap(task => task.connectorKeys || []))
    expect(aiPlan.domainPacks.map(pack => pack.id)).toContain('ai')
    expect(aiConnectors).toContain('huggingface')

    const linuxPlan = buildCanonicalAgenticSearchPlan(intake({
      title: 'RHEL Administrator',
      mustHaves: ['Linux'],
      niceToHaves: [],
      adjacentBackgrounds: ['Linux Systems Administrator'],
      rawDescription: 'RHEL Administrator with Linux experience',
    }))
    const linuxConnectors = linuxPlan.lanes.flatMap(lane => lane.tasks.flatMap(task => task.connectorKeys || []))
    expect(linuxPlan.domainPacks.map(pack => pack.id)).not.toContain('ai')
    expect(linuxConnectors).not.toContain('huggingface')
  })

  it('uses AI capabilities as retrieval terms without treating them as evidence', () => {
    expect(huggingFaceRetrievalTerms('Senior LLM engineer with PyTorch, RAG, and Secret clearance'))
      .toEqual(expect.arrayContaining(['llm', 'pytorch', 'rag']))
  })

  it('promotes only resolved public users and keeps candidate skills artifact-observed', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/models?')) {
        return new Response(JSON.stringify([
          {
            id: 'alice/demo-model',
            author: 'alice',
            tags: ['pytorch', 'text-generation'],
            pipeline_tag: 'text-generation',
            lastModified: '2026-08-30T12:00:00Z',
          },
          {
            id: 'example-org/org-model',
            author: 'example-org',
            tags: ['pytorch', 'transformers'],
            lastModified: '2026-08-29T12:00:00Z',
          },
        ]), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/api/datasets?') || url.includes('/api/spaces?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/api/users/alice/overview')) {
        return new Response(JSON.stringify({
          _id: 'user-1',
          user: 'alice',
          type: 'user',
          fullname: 'Alice Example',
          details: 'Building open machine learning systems.',
          avatarUrl: 'https://example.com/alice.png',
          numModels: 4,
          numDatasets: 1,
          numSpaces: 2,
          orgs: [{ name: 'research-lab', fullname: 'Research Lab' }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/api/users/example-org/overview')) {
        return new Response(JSON.stringify({
          _id: 'org-1',
          user: 'example-org',
          type: 'organization',
          fullname: 'Example Org',
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const raw = await discoverHuggingFacePeople({
      query: 'Machine Learning Engineer with PyTorch and totally-secret-query-term',
      limit: 8,
    })
    const people = classifyRealSourceResults(raw).filter(result => result.entityKind === 'person')

    expect(people).toHaveLength(1)
    expect(people[0].displayName).toBe('Alice Example')
    expect(people[0].sourceProfileId).toBe('alice')
    expect(people[0].skills).toEqual(expect.arrayContaining(['pytorch', 'text-generation']))
    expect(people[0].skills.join(' ')).not.toContain('totally-secret-query-term')
    expect(people[0].evidence.some(item => item.detail.includes('alice/demo-model'))).toBe(true)
    expect(raw.some(result => result.sourceProfileId === 'example-org')).toBe(false)
  })

  it('does not trust a client-supplied person kind for legacy Hugging Face artifact records', () => {
    const [classified] = classifyRealSourceResults([{
      id: 'huggingface:fake-model',
      source: 'huggingface',
      sourceProfileId: 'fake/model',
      entityKind: 'person',
      displayName: 'fake',
      profileUrl: 'https://huggingface.co/fake/model',
      skills: ['query-injected-skill'],
      evidence: [],
      contactSignals: [],
      identitySignals: [],
      refreshedAt: new Date().toISOString(),
      raw: { tags: ['transformers'] },
    }])

    expect(classified.entityKind).toBe('artifact')
  })
})
