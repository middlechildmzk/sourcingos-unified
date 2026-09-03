import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCrustdataPersonSearchBodyV36_16 } from '@/lib/candidate-data/providers/crustdata-v36-16'
import { buildApolloPeopleSearchUrlV36_16 } from '@/lib/candidate-data/providers/apollo-v36-16'
import { buildSerperXrayQueriesV36_16, searchSerperXrayV36_16 } from '@/lib/candidate-data/providers/serper-xray-v36-16'
import { agentProviderStatusesV36_16 } from '@/lib/agent-data/provider-registry-v36-16'
import { enrichWithApolloV36_16 } from '@/lib/contact-enrichment/providers/apollo-v36-16'
import { buildLushaEnrichBodyV36_16, buildLushaSearchBodyV36_16, enrichWithLushaV36_16 } from '@/lib/contact-enrichment/providers/lusha-v36-16'
import { contactGoalStateV36_12 } from '@/lib/contact-enrichment/orchestrator-v35'
import { buildApifyPublicPageInputV36_16 } from '@/lib/agent-data/apify-public-web-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'
import { callAllowlistedRemoteMcpToolV36_16 } from '@/lib/mcp/streamable-http-v36-16'

const savedEnv = new Map<string, string | undefined>()
const envKeys = [
  'CRUSTDATA_API_KEY', 'APOLLO_API_KEY', 'WIZA_API_KEY', 'FULLENRICH_API_KEY',
  'BRIGHTDATA_API_KEY', 'COLDIQ_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY', 'MERGE_API_KEY',
  'SERPER_API_KEY', 'LUSHA_API_KEY', 'LUSA_API_KEY', 'APIFY_API_TOKEN',
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

  it('generates a bounded portfolio of distinct Serper X-ray strategies from structured criteria', () => {
    const strategies = buildSerperXrayQueriesV36_16({
      query: 'Find RHEL admins near Annapolis Junction',
      titles: ['RHEL Administrator'],
      skills: ['RHEL', 'Ansible', 'Linux'],
      companies: ['Northstar Systems'],
      locations: ['Annapolis Junction, MD'],
      requirements: [{ text: 'Secret clearance or higher', mustHave: true }],
      limit: 25,
    })

    expect(strategies.length).toBeGreaterThanOrEqual(5)
    expect(strategies.length).toBeLessThanOrEqual(8)
    expect(new Set(strategies.map(item => item.query.toLowerCase())).size).toBe(strategies.length)
    expect(strategies.some(item => item.query.includes('site:linkedin.com/in/'))).toBe(true)
    expect(strategies.some(item => /filetype:pdf/i.test(item.query))).toBe(true)
    expect(strategies.some(item => /site:github\.com/i.test(item.query))).toBe(true)
    expect(strategies.some(item => item.query.includes('Northstar Systems'))).toBe(true)
  })

  it('keeps Serper snippets as retrieval context instead of candidate qualification fields', async () => {
    saveAndSet('SERPER_API_KEY', 'serper-test-key')
    const linkedin = 'https://www.linkedin.com/in/sample-candidate/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      organic: [{
        title: 'Sample Candidate - Senior Linux Engineer | LinkedIn',
        link: linkedin,
        snippet: 'Secret clearance. 10+ years. RHEL, Ansible, Kubernetes. Northstar Systems.',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await searchSerperXrayV36_16({
      query: 'Find RHEL admins near Annapolis Junction',
      titles: ['RHEL Administrator'],
      skills: ['RHEL', 'Ansible'],
      locations: ['Annapolis Junction, MD'],
      requirements: [{ text: 'Secret clearance or higher', mustHave: true }],
      limit: 20,
    })

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(result.observations).toHaveLength(1)
    const person = result.observations[0]
    expect(person.displayName).toBe('Sample Candidate - Senior Linux Engineer')
    expect(person.skills).toEqual([])
    expect(person.currentEmployer).toBeUndefined()
    expect(person.currentTitle).toBeUndefined()
    expect(person.location).toBeUndefined()
    expect(person.contactAvailability).toEqual({ email: 'unknown', phone: 'unknown' })
    expect(person.providerExplanation).toContain('retrieval context only')
    expect(person.profileUrls).toEqual([{ kind: 'linkedin', url: linkedin }])
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-API-KEY')).toBe('serper-test-key')
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
    saveAndSet('SERPER_API_KEY', 'serper-secret-fixture')
    saveAndSet('LUSHA_API_KEY', 'lusha-secret-fixture')
    saveAndSet('APIFY_API_TOKEN', 'apify-secret-fixture')

    const statuses = agentProviderStatusesV36_16()
    expect(statuses.find(item => item.id === 'crustdata')).toEqual(expect.objectContaining({ configured: true, executableNow: true }))
    expect(statuses.find(item => item.id === 'apollo')).toEqual(expect.objectContaining({ configured: true, executableNow: true }))
    expect(statuses.find(item => item.id === 'serper')).toEqual(expect.objectContaining({ configured: true, executableNow: true, capabilities: expect.arrayContaining(['search_people', 'search_web']) }))
    expect(statuses.find(item => item.id === 'lusha')).toEqual(expect.objectContaining({ configured: true, executableNow: true, capabilities: expect.arrayContaining(['find_contacts']) }))
    expect(statuses.find(item => item.id === 'apify')).toEqual(expect.objectContaining({ configured: true, executableNow: true, capabilities: expect.arrayContaining(['refresh_entity']) }))
    expect(statuses.find(item => item.id === 'brightdata')).toEqual(expect.objectContaining({ configured: true, executableNow: true, transports: ['mcp'] }))
    expect(statuses.find(item => item.id === 'qdrant')).toEqual(expect.objectContaining({ configured: true, executableNow: false }))
    expect(statuses.find(item => item.id === 'merge')).toEqual(expect.objectContaining({ configured: true, executableNow: false }))
    const serialized = JSON.stringify(statuses)
    for (const secret of ['crust-secret-fixture', 'apollo-secret-fixture', 'wiza-secret-fixture', 'bright-secret-fixture', 'vector-secret-fixture', 'ats-secret-fixture', 'serper-secret-fixture', 'lusha-secret-fixture', 'apify-secret-fixture']) {
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

  it('keeps Lusha reveal scoped to requested fields and never invokes nested Waterfall Reveal', async () => {
    saveAndSet('LUSHA_API_KEY', 'lusha-test-key')
    const workEmail = ['candidate', 'company.test'].join(String.fromCharCode(64))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [{ id: 'lusha-contact-1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [{
        id: 'lusha-contact-1',
        emails: [{ email: workEmail, type: 'work', confidence: 'high' }],
        phones: [{ number: '+15555550123', type: 'mobile', doNotCall: true }],
      }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const request = { fullName: 'Sample Candidate', currentCompany: 'Northstar Systems', linkedinUrl: 'https://www.linkedin.com/in/sample-candidate/' }
    expect(buildLushaSearchBodyV36_16(request)).toEqual({
      contacts: [{ clientReferenceId: 'sourcingos-1', linkedinUrl: 'https://www.linkedin.com/in/sample-candidate/' }],
      options: { includePartialProfiles: true },
    })
    expect(buildLushaEnrichBodyV36_16(['lusha-contact-1'], ['emails', 'phones'])).toEqual({ ids: ['lusha-contact-1'], reveal: ['emails', 'phones'] })

    const result = await enrichWithLushaV36_16(request, { revealEmails: true, revealPhones: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const enrichBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || '{}'))
    expect(enrichBody).toEqual({ ids: ['lusha-contact-1'], reveal: ['emails', 'phones'] })
    expect(enrichBody.waterfallReveal).toBeUndefined()
    expect(result.signals.some(item => item.type === 'email' && item.channelKind === 'work_email' && item.value === workEmail)).toBe(true)
    const dnc = result.signals.find(item => item.type === 'phone')
    expect(dnc).toEqual(expect.objectContaining({ channelKind: 'mobile_phone', permissionStatus: 'do_not_contact' }))
    expect(contactGoalStateV36_12(result.signals, ['work_email', 'phone'])).toEqual({
      requested: ['work_email', 'phone'], satisfied: ['work_email'], missing: ['phone'],
    })
  })

  it('bounds Apify to the maintained single-page public crawler and blocks social/login deep refresh', () => {
    const input = buildApifyPublicPageInputV36_16('https://portfolio.test/work')
    expect(input.startUrls).toEqual([{ url: 'https://portfolio.test/work' }])
    expect(input.maxCrawlDepth).toBe(0)
    expect(input.maxCrawlPages).toBe(1)
    expect(input.respectRobotsTxtFile).toBe(true)
    expect(input.initialCookies).toEqual([])
    expect(input.summarize).toBe(false)
    expect(() => publicDeepRefreshUrlV36_16('http://127.0.0.1/private')).toThrow(/private|local/i)
    expect(() => publicDeepRefreshUrlV36_16('https://www.linkedin.com/in/sample-candidate/')).toThrow(/not allowed|login-gated|social/i)
    expect(() => publicDeepRefreshUrlV36_16('https://instagram.com/sample')).toThrow(/not allowed|login-gated|social/i)
  })

  it('performs an MCP initialize/list/call sequence only against an allowlisted host and tool', async () => {
    const seen: Array<{ method: string; headers: Headers; body: Record<string, any> }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, any>
      const headers = new Headers(init?.headers)
      seen.push({ method: String(body.method || ''), headers, body })
      if (body.method === 'initialize') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'fixture', version: '1' } } }), {
          status: 200, headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'session-fixture' },
        })
      }
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 })
      if (body.method === 'tools/list') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'search_engine', description: 'fixture', inputSchema: { type: 'object' } }] } }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (body.method === 'tools/call') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'live web fixture result' }], isError: false } }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('unexpected', { status: 500 })
    })

    const result = await callAllowlistedRemoteMcpToolV36_16({
      endpoint: 'https://mcp.brightdata.com/mcp?token=test-token',
      allowedHosts: ['mcp.brightdata.com'],
      allowedTools: ['search_engine', 'scrape_as_markdown'],
      tool: 'search_engine',
      arguments: { query: 'current recruiting market' },
      clientName: 'sourcingos-test',
    })

    expect(result.text).toBe('live web fixture result')
    expect(seen.map(item => item.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call'])
    expect(seen.slice(1).every(item => item.headers.get('Mcp-Session-Id') === 'session-fixture')).toBe(true)
    expect(seen.find(item => item.method === 'tools/call')?.body.params.name).toBe('search_engine')
  })

  it('rejects arbitrary MCP hosts and non-allowlisted tools before network execution', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(callAllowlistedRemoteMcpToolV36_16({
      endpoint: 'https://untrusted.invalid/mcp',
      allowedHosts: ['mcp.brightdata.com'],
      allowedTools: ['search_engine'],
      tool: 'search_engine',
      arguments: { query: 'test' },
      clientName: 'sourcingos-test',
    })).rejects.toThrow(/allowlist/i)
    await expect(callAllowlistedRemoteMcpToolV36_16({
      endpoint: 'https://mcp.brightdata.com/mcp',
      allowedHosts: ['mcp.brightdata.com'],
      allowedTools: ['search_engine'],
      tool: 'scraping_browser_navigate',
      arguments: {},
      clientName: 'sourcingos-test',
    })).rejects.toThrow(/allowlist/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
