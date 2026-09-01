import { afterEach, describe, expect, it, vi } from 'vitest'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import { enrichRoleIntakeWithOnet, type OnetRoleIntelligence } from '@/lib/onet-role-intelligence'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { discoverDevToTalent } from '@/lib/connectors/devto-v33-6'
import { classifySourceResult } from '@/lib/entity-classification'

const rhelRequest = 'find a rhel admin near washington dc with 5+ years of linux and secret clearance'

const badEducationMatch: OnetRoleIntelligence = {
  provider: 'onet',
  version: 'test',
  configured: true,
  matchedOccupation: { code: '11-9032.00', title: 'Education Administrators, Kindergarten through Secondary' },
  reportedTitles: ['Elementary Principal', 'School Administrator', 'Middle School Principal'],
  relatedOccupations: [{ code: '11-9031.00', title: 'Education and Childcare Administrators, Preschool and Daycare' }],
  technologyExamples: [],
  attribution: 'test',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('V33.6 retrieval quality and source breadth', () => {
  it('preserves the recruiter-stated 5+ years Linux requirement', () => {
    const brief = interpretRoleBrief(rhelRequest)
    expect(brief.intake.title.toLowerCase()).toContain('rhel admin')
    expect(brief.intake.location.toLowerCase()).toContain('washington dc')
    expect(brief.intake.clearance.toLowerCase()).toContain('secret')
    expect(brief.intake.mustHaves).toContain('5+ years Linux experience')
  })

  it('blocks an education-admin O*NET mismatch and supplies technical adjacencies', () => {
    const brief = interpretRoleBrief(rhelRequest)
    const enriched = enrichRoleIntakeWithOnet(brief.intake, badEducationMatch)
    const adjacency = enriched.adjacentBackgrounds.join(' | ')

    expect(adjacency).toContain('RHEL Administrator')
    expect(adjacency).toContain('Linux Systems Administrator')
    expect(adjacency).toContain('Infrastructure Engineer')
    expect(adjacency).not.toMatch(/Elementary Principal|School Administrator|Superintendent|Education Administrator/i)
  })

  it('treats RHEL/Linux administration as technical across multiple executable search lanes', () => {
    const brief = interpretRoleBrief(rhelRequest)
    const enriched = enrichRoleIntakeWithOnet(brief.intake, badEducationMatch)
    const plan = buildCanonicalAgenticSearchPlan(enriched)

    for (const lane of plan.lanes.filter(item => ['exact_title', 'adjacent_title', 'skill_cluster', 'evidence_first'].includes(item.id))) {
      const connectors = lane.tasks.flatMap(task => task.connectorKeys || [])
      expect(connectors).toContain('github')
      expect(connectors).toContain('stackoverflow')
      expect(connectors).toContain('devto')
    }
  })

  it('builds canonical DEV people from observed authored tags without turning the query into skills', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/articles?')) {
        return new Response(JSON.stringify([{
          id: 101,
          title: 'Running Linux services safely in production',
          url: 'https://dev.to/alice/linux-services-123',
          tag_list: ['linux', 'devops'],
          published_timestamp: '2026-08-01T12:00:00Z',
          user: {
            name: 'Alice Example',
            username: 'alice',
            github_username: 'alice-gh',
            website_url: 'https://alice.example.com',
            profile_image: 'https://example.com/alice.png',
          },
        }]), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.endsWith('/api/users/alice')) {
        return new Response(JSON.stringify({
          type_of: 'user',
          id: 1,
          username: 'alice',
          name: 'Alice Example',
          summary: 'Infrastructure engineer writing about Linux.',
          github_username: 'alice-gh',
          website_url: 'https://alice.example.com',
          location: 'Washington, DC',
          profile_image: 'https://example.com/alice.png',
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [rawPerson] = await discoverDevToTalent({
      query: 'RHEL admin 5+ years Linux experience',
      location: 'Washington, DC',
      limit: 8,
    })
    const person = classifySourceResult(rawPerson)

    expect(person.entityKind).toBe('person')
    expect(person.source).toBe('devto')
    expect(person.displayName).toBe('Alice Example')
    expect(person.skills).toEqual(expect.arrayContaining(['linux', 'devops']))
    expect(person.skills.join(' ')).not.toMatch(/rhel|admin|5\+|years|experience/i)
    expect(person.evidence.some(item => item.detail.includes('Running Linux services safely in production'))).toBe(true)
    expect(person.identitySignals.some(item => item.type === 'website' && item.value.includes('github.com/alice-gh'))).toBe(true)
  })
})
