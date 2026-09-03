import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCrustdataPersonSearchBodyV36_16 } from '@/lib/candidate-data/providers/crustdata-v36-16'
import { buildApolloPeopleSearchUrlV36_16 } from '@/lib/candidate-data/providers/apollo-v36-16'
import { agentProviderStatusesV36_16 } from '@/lib/agent-data/provider-registry-v36-16'
import { enrichWithApolloV36_16 } from '@/lib/contact-enrichment/providers/apollo-v36-16'

const savedEnv = new Map<string, string | undefined>()
const envKeys = [
  'CRUSTDATA_API_KEY', 'APOLLO_API_KEY', 'WIZA_API_KEY', 'FULLENRICH_API_KEY',
  'BRIGHTDATA_API_KEY', 'COLDIQ_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY', 'MERGE_API_KEY',
] as const

function saveAndSet(key: typeof envKeys[number], value: string | undefined) {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key])
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const key of envKeys) {
    const value = savedEnv.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  savedEnv.clear()
})

describe('V36.16 provider data fabric', () => {
  it('keeps Crustdata hard constraints separate from semantic ranking context', () => {
    const body = buildCrustdataPersonSearchBodyV36_16({
      query: 'Find backend engineers in Minneapolis, MN with AWS and Kubernetes',
      titles: ['backend engineer'],
      skills: ['AWS', 'Kubernetes', 'Terraform'],
      companies: ['Northstar Systems'],
      locations: ['Minneapolis, MN'],
      requirements: [
        { text: 'AWS', mustHave: true },
        { text: 'Kubernetes', mustHave: true },
        { text: 'Terraform', mustHave: false },
      ],
      limit: 25,
    }) as Record<string, any>

    expect(body.mode).toBe('exact')
    expect(body.search).toEqual(expect.objectContaining({ mode: 'hybrid' }))
    expect(body.search.query).toContain('Terraform')
    const serialized = JSON.stringify(body.filters)
    expect(serialized).toContain('experience.employment_details.current.company_name')
    expect(serialized).toContain('basic_profile.location.full_location')
    expect(serialized).toContain('AWS')
    expect(serialized).toContain('Kubernetes')
    expect(serialized).not.toContain('Terraform')
    expect(body.fields).toEqual(expect.arrayContaining(['crustdata_person_id', 'basic_profile', 'experience', 'skills']))
  })

  it('builds Apollo search as strict contact-free discovery', () => {
    const url = new URL(buildApolloPeopleSearchUrlV36_16({
      query: 'Find backend engineers in Minneapolis, MN with AWS and Kubernetes',
      titles: ['backend engineer'],
      skills: ['AWS', 'Kubernetes'],
      locations: ['Minneapolis, MN'],
      limit: 25,
    }))

    expect(url.pathname).toBe('/api/v1/mixed_people/api_search')
    expect(url.searchParams.getAll('person_titles[]')).toEqual(['backend engineer'])
    expect(url.searchParams.get('include_similar_titles')).toBe('false')
    expect(url.searchParams.getAll('person_locations[]')).toEqual(['Minneapolis, MN'])
    expect(url.searchParams.get('q_keywords')).toContain('AWS')
    expect(url.searchParams.get('q_keywords')).toContain('Kubernetes')
    expect(url.searchParams.has('reveal_personal_emails')).toBe(false)
    expect(url.searchParams.has('reveal_phone_number')).toBe(false)
  })

  it('reports connected capabilities without ever returning secret values', () => {
    saveAndSet('CRUSTDATA_API_KEY', 'crust-secret-fixture')
    saveAndSet('APOLLO_API_KEY', 'apollo-secret-fixture')
    saveAndSet('WIZA_API_KEY', 'wiza-secret-fixture')
    saveAndSet('FULLENRICH_API_KEY', 'full-secret-fixture')
    saveAndSet('BRIGHTDATA_API_KEY', 'bright-secret-fixture')
    saveAndSet('COLDIQ_API_KEY', 'cold-secret-fixture')
    saveAndSet('QDRANT_URL', 'https://vector.invalid')
    saveAndSet('QDRANT_API_KEY', 'vector-secret-fixture')
    saveAndSet('MERGE_API_KEY', 'ats-secret-fixture')

    const statuses = agentProviderStatusesV36_16()
    expect(statuses.find(item => item.id === 'crustdata')).toEqual(expect.objectContaining({ configured: true, executableNow: true }))
    expect(statuses.find(item => item.id === 'apollo')).toEqual(expect.objectContaining({ configured: true, executableNow: true }))
    expect(statuses.find(item => item.id === 'qdrant')).toEqual(expect.objectContaining({ configured: true, executableNow: false }))
    expect(statuses.find(item => item.id === 'merge')).toEqual(expect.objectContaining({ configured: true, executableNow: false }))
    const serialized = JSON.stringify(statuses)
    for (const secret of ['crust-secret-fixture', 'apollo-secret-fixture', 'wiza-secret-fixture', 'vector-secret-fixture', 'ats-secret-fixture']) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('keeps Apollo mobile reveal out of the synchronous email enrichment request', async () => {
    saveAndSet('APOLLO_API_KEY', 'apollo-test-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      person: {
        id: 'person-123',
        name: 'Sample Candidate',
        title: 'Backend Engineer',
        organization: { name: 'Northstar Systems' },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await enrichWithApolloV36_16({
      providerName: 'apollo',
      providerPersonId: 'person-123',
      fullName: 'Sample Candidate',
      currentCompany: 'Northstar Systems',
    }, { revealPersonalEmail: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(init?.body || '{}'))
    expect(body.reveal_personal_emails).toBe(true)
    expect(body.reveal_phone_number).toBe(false)
    expect(body.webhook_url).toBeUndefined()
  })
})
