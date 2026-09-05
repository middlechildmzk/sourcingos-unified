import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  classifyResumeCvUrlV40_5I,
  extractUrlsFromTextV40_5I,
  normalizeResumeCvUrlV40_5I,
  resumeCvUrlIsFetchEligibleV40_5I,
} from '@/lib/fleet/resume-providers/url-safety-v40-5i'
import { searchResumeCvWithSerperV40_5I } from '@/lib/fleet/resume-providers/serper-resume-v40-5i'
import { buildExaResumeQueryV40_5I, searchResumeCvWithExaV40_5I } from '@/lib/fleet/resume-providers/exa-resume-v40-5i'
import { searchResumeCvWithBrightDataFallbackV40_5I } from '@/lib/fleet/resume-providers/brightdata-resume-fallback-v40-5i'
import { discoverResumeCvUrlsV40_5I } from '@/lib/fleet/resume-providers/orchestrator-v40-5i'
import {
  RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I,
  RESUME_SPRINT_PROVIDER_STRATEGY_V40_5I,
  resumeSprintCanaryCeilingV40_5I,
  resumeSprintClaimArgsV40_5I,
  resumeSprintReleaseGateV40_5I,
  resumeSprintReleaseModeV40_5I,
} from '@/lib/fleet/resume-providers/release-gate-v40-5i'
import { isLocalOrPrivateHostV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'
import { searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'

vi.mock('@/lib/agent-data/brightdata-mcp-v36-16', () => ({
  searchWebWithBrightDataV36_16: vi.fn(),
}))

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const savedEnv = new Map<string, string | undefined>()
const envKeys = ['SERPER_API_KEY', 'EXA_API_KEY', 'BRIGHTDATA_API_KEY', 'RESUME_SPRINT_RELEASE_MODE', 'RESUME_SPRINT_CANARY_CEILING'] as const
function saveAndSet(key: typeof envKeys[number], value: string | undefined) {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key])
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

beforeEach(() => {
  // Default: Bright Data reports "not configured" unless a test explicitly
  // arranges otherwise. This keeps the fallback's not-configured/failed
  // distinction testable without depending on real env-var state, since the
  // module itself is mocked for this whole file.
  vi.mocked(searchWebWithBrightDataV36_16).mockReset().mockRejectedValue(new Error('Bright Data is not configured.'))
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const key of envKeys) {
    const value = savedEnv.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  savedEnv.clear()
})

describe('V40.5i URL safety', () => {
  it('rejects localhost, private IPv4, credential-bearing, and non-http(s) URLs', () => {
    expect(isLocalOrPrivateHostV36_16('127.0.0.1')).toBe(true)
    expect(isLocalOrPrivateHostV36_16('10.0.0.5')).toBe(true)
    expect(isLocalOrPrivateHostV36_16('192.168.1.1')).toBe(true)
    expect(normalizeResumeCvUrlV40_5I('http://127.0.0.1/resume.pdf')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('http://10.0.0.5/resume.pdf')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('http://internal-host.internal/resume.pdf')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('http://user:pass@example.com/resume.pdf')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('javascript:alert(1)')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('data:text/plain;base64,aGVsbG8=')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('not a url')).toBeNull()
  })

  it('rejects search-engine redirect/click-tracking wrapper URLs', () => {
    expect(normalizeResumeCvUrlV40_5I('https://www.google.com/url?q=https://example.com/resume.pdf')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('https://www.bing.com/ck/a?u=abc')).toBeNull()
    expect(normalizeResumeCvUrlV40_5I('https://l.facebook.com/l.php?u=abc')).toBeNull()
  })

  it('accepts and normalizes legitimate public HTTPS URLs, dropping fragments', () => {
    expect(normalizeResumeCvUrlV40_5I('https://example.edu/jane-resume.pdf#page=2')).toBe('https://example.edu/jane-resume.pdf')
  })

  it('classifies direct documents, resume pages, metadata-only, and irrelevant URLs', () => {
    expect(classifyResumeCvUrlV40_5I('https://example.edu/jane-resume.pdf')).toBe('direct_document')
    expect(classifyResumeCvUrlV40_5I('https://drive.google.com/file/d/abc123/view')).toBe('direct_document')
    expect(classifyResumeCvUrlV40_5I('https://raw.githubusercontent.com/jane/site/main/resume.md')).toBe('direct_document')
    expect(classifyResumeCvUrlV40_5I('https://mybucket.s3.amazonaws.com/jane-resume.pdf')).toBe('direct_document')
    expect(classifyResumeCvUrlV40_5I('https://janedoe.dev/resume')).toBe('resume_page')
    expect(classifyResumeCvUrlV40_5I('https://www.scribd.com/document/12345/jane-resume')).toBe('metadata_only')
    expect(classifyResumeCvUrlV40_5I('https://www.linkedin.com/in/jane-doe')).toBe('metadata_only')
    expect(classifyResumeCvUrlV40_5I('https://storage.googleapis.com/bucket/file.pdf?X-Amz-Signature=abc&X-Amz-Credential=def')).toBe('metadata_only')
    expect(classifyResumeCvUrlV40_5I('https://example.com/about-us')).toBe('irrelevant')
  })

  it('exposes a conservative fetch-eligibility helper matching the classification enum', () => {
    expect(resumeCvUrlIsFetchEligibleV40_5I('direct_document')).toBe(true)
    expect(resumeCvUrlIsFetchEligibleV40_5I('resume_page')).toBe(true)
    expect(resumeCvUrlIsFetchEligibleV40_5I('metadata_only')).toBe(false)
    expect(resumeCvUrlIsFetchEligibleV40_5I('irrelevant')).toBe(false)
  })

  it('recovers literal and JSON-escaped public result URLs without decoding private redirect targets', () => {
    const urls = extractUrlsFromTextV40_5I([
      'https://example.edu/jane_resume.pdf',
      '{"url":"https:\\/\\/cdn.example.org\\/jane-cv.pdf?x=1\\u0026y=2"}',
      '[CV](https://docs.google.com/document/d/public-example)',
    ].join('\n'))
    expect(urls).toContain('https://example.edu/jane_resume.pdf')
    expect(urls).toContain('https://cdn.example.org/jane-cv.pdf?x=1&y=2')
    expect(urls).toContain('https://docs.google.com/document/d/public-example')
    expect(urls).toHaveLength(3)
  })
})

describe('V40.5i Serper Resume/CV adapter', () => {
  it('reports unavailable without SERPER_API_KEY, without making a network call', async () => {
    delete process.env.SERPER_API_KEY
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await searchResumeCvWithSerperV40_5I('"Jane Engineer" resume filetype:pdf')
    expect(result.telemetry.status).toBe('unavailable')
    expect(result.records).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps organic results into normalized provider records', async () => {
    saveAndSet('SERPER_API_KEY', 'serper-test-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      organic: [{ title: 'Jane Engineer Resume', link: 'https://example.edu/jane-resume.pdf', snippet: 'Resume for Jane Engineer' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await searchResumeCvWithSerperV40_5I('"Jane Engineer" resume filetype:pdf')
    expect(result.telemetry.status).toBe('completed')
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toEqual(expect.objectContaining({ provider: 'serper', url: 'https://example.edu/jane-resume.pdf', rank: 1 }))
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('X-API-KEY')).toBe('serper-test-key')
  })

  it('isolates provider failure: a non-2xx response is reported as failed, not thrown', async () => {
    saveAndSet('SERPER_API_KEY', 'serper-test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }))
    const result = await searchResumeCvWithSerperV40_5I('"Jane Engineer" resume filetype:pdf')
    expect(result.telemetry.status).toBe('failed')
    expect(result.records).toEqual([])
  })
})

describe('V40.5i Exa Resume/CV adapter', () => {
  it('builds a semantic natural-language query from candidate context, not a boolean string', () => {
    const query = buildExaResumeQueryV40_5I({ id: 'c1', canonical_name: 'Jane Engineer', current_company: 'Acme Federal', current_title: 'Linux Engineer', location: 'Des Moines, IA' })
    expect(query).toContain('Jane Engineer')
    expect(query).toContain('Linux Engineer')
    expect(query).not.toContain('filetype:')
    expect(query).not.toContain('site:')
  })

  it('reports unavailable without EXA_API_KEY', async () => {
    delete process.env.EXA_API_KEY
    const result = await searchResumeCvWithExaV40_5I('Public resume for Jane Engineer.')
    expect(result.telemetry.status).toBe('unavailable')
    expect(result.records).toEqual([])
  })

  it('maps Exa results into normalized provider records', async () => {
    saveAndSet('EXA_API_KEY', 'exa-test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      results: [{ url: 'https://janeengineer.dev/resume', title: 'Jane Engineer', highlights: ['Public portfolio and resume'], score: 0.91 }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await searchResumeCvWithExaV40_5I('Public resume for Jane Engineer.')
    expect(result.telemetry.status).toBe('completed')
    expect(result.records).toEqual([expect.objectContaining({ provider: 'exa', url: 'https://janeengineer.dev/resume', rank: 0.91 })])
  })
})

describe('V40.5i Bright Data optional fallback', () => {
  it('distinguishes "not configured" from a genuine provider error', async () => {
    vi.mocked(searchWebWithBrightDataV36_16).mockRejectedValueOnce(new Error('Bright Data is not configured.'))
    const notConfigured = await searchResumeCvWithBrightDataFallbackV40_5I('"Jane Engineer" resume filetype:pdf')
    expect(notConfigured.telemetry.status).toBe('unavailable')
    expect(notConfigured.telemetry.errors).toBe(0)

    vi.mocked(searchWebWithBrightDataV36_16).mockRejectedValueOnce(new Error('Bright Data MCP search_engine returned an error.'))
    const failed = await searchResumeCvWithBrightDataFallbackV40_5I('"Jane Engineer" resume filetype:pdf')
    expect(failed.telemetry.status).toBe('failed')
    expect(failed.telemetry.errors).toBe(1)
  })
})

describe('V40.5i provider-agnostic orchestrator', () => {
  it('runs Serper then Exa, dedupes across providers, and skips Bright Data when either lane already found URLs', async () => {
    saveAndSet('SERPER_API_KEY', 'serper-test-key')
    saveAndSet('EXA_API_KEY', 'exa-test-key')
    const shared = 'https://example.edu/jane-resume.pdf'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('serper.dev')) {
        return new Response(JSON.stringify({ organic: [{ title: 'Jane', link: shared, snippet: 'x' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('exa.ai')) {
        return new Response(JSON.stringify({ results: [{ url: shared, title: 'Jane' }, { url: 'https://janeengineer.dev/portfolio', title: 'Jane portfolio' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch to ${url}`)
    })

    const run = await discoverResumeCvUrlsV40_5I({
      candidate: { id: 'c1', canonical_name: 'Jane Engineer' },
      serperQueries: ['"Jane Engineer" resume filetype:pdf'],
    })

    expect(run.urls.map(item => item.url).sort()).toEqual([shared, 'https://janeengineer.dev/portfolio'].sort())
    expect(run.urls.find(item => item.url === shared)?.classification).toBe('direct_document')
    expect(searchWebWithBrightDataV36_16).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalled()
    expect(run.providerTelemetry.map(item => item.provider).sort()).toEqual(['exa', 'serper'])
  })

  it('falls back to Bright Data only when Serper and Exa both return zero records', async () => {
    saveAndSet('SERPER_API_KEY', 'serper-test-key')
    saveAndSet('EXA_API_KEY', 'exa-test-key')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('serper.dev')) return new Response(JSON.stringify({ organic: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('exa.ai')) return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      throw new Error(`unexpected fetch to ${url}`)
    })
    vi.mocked(searchWebWithBrightDataV36_16).mockResolvedValue({
      provider: 'brightdata', transport: 'mcp', tool: 'search_engine',
      text: 'https://example.edu/jane-resume.pdf',
      observedAt: new Date().toISOString(), freshness: 'live',
      trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
    } as any)

    const run = await discoverResumeCvUrlsV40_5I({
      candidate: { id: 'c1', canonical_name: 'Jane Engineer' },
      serperQueries: ['"Jane Engineer" resume filetype:pdf'],
    })
    expect(searchWebWithBrightDataV36_16).toHaveBeenCalledTimes(1)
    expect(run.providerTelemetry.map(item => item.provider).sort()).toEqual(['brightdata', 'exa', 'serper'])
    expect(run.urls).toEqual([expect.objectContaining({ url: 'https://example.edu/jane-resume.pdf', provider: 'brightdata' })])
  })

  it('reports zero-yield cleanly when no provider is configured', async () => {
    delete process.env.SERPER_API_KEY
    delete process.env.EXA_API_KEY
    const run = await discoverResumeCvUrlsV40_5I({
      candidate: { id: 'c1', canonical_name: 'Jane Engineer' },
      serperQueries: ['"Jane Engineer" resume filetype:pdf'],
    })
    expect(run.urls).toEqual([])
    expect(run.providerTelemetry.every(item => item.status === 'unavailable')).toBe(true)
  })
})

function fakeSupabase(rows: Array<{ candidate_id: string }>, opts: { error?: { message: string } } = {}) {
  const chain: any = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve(opts.error ? { data: null, error: opts.error } : { data: rows, error: null }),
  }
  return chain
}

describe('V40.5i governed canary release gate', () => {
  it('defaults to canary mode with a ceiling between 6 and 12', () => {
    delete process.env.RESUME_SPRINT_RELEASE_MODE
    delete process.env.RESUME_SPRINT_CANARY_CEILING
    expect(resumeSprintReleaseModeV40_5I()).toBe('canary')
    expect(resumeSprintCanaryCeilingV40_5I()).toBe(RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I)
    expect(RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I).toBeGreaterThanOrEqual(6)
    expect(RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I).toBeLessThanOrEqual(12)
  })

  it('holds new searches once the canary ceiling of already-canaried candidates is reached', async () => {
    saveAndSet('RESUME_SPRINT_CANARY_CEILING', '2')
    const sb = fakeSupabase([{ candidate_id: 'a' }, { candidate_id: 'b' }])
    const gate = await resumeSprintReleaseGateV40_5I(sb, 'v40_5_resume_sprint_5000')
    expect(gate.mode).toBe('canary')
    expect(gate.canariedCount).toBe(2)
    expect(gate.allowNewSearch).toBe(false)
  })

  it('allows new searches below the ceiling', async () => {
    saveAndSet('RESUME_SPRINT_CANARY_CEILING', '12')
    const sb = fakeSupabase([{ candidate_id: 'a' }])
    const gate = await resumeSprintReleaseGateV40_5I(sb, 'v40_5_resume_sprint_5000')
    expect(gate.allowNewSearch).toBe(true)
  })

  it('fails closed when the gate query itself errors', async () => {
    const sb = fakeSupabase([], { error: { message: 'db unavailable' } })
    const gate = await resumeSprintReleaseGateV40_5I(sb, 'v40_5_resume_sprint_5000')
    expect(gate.allowNewSearch).toBe(false)
  })

  it('lifts the hold entirely once RESUME_SPRINT_RELEASE_MODE is scaled', async () => {
    saveAndSet('RESUME_SPRINT_RELEASE_MODE', 'scaled')
    const sb = fakeSupabase([{ candidate_id: 'a' }, { candidate_id: 'b' }, { candidate_id: 'c' }])
    const gate = await resumeSprintReleaseGateV40_5I(sb, 'v40_5_resume_sprint_5000')
    expect(gate.mode).toBe('scaled')
    expect(gate.allowNewSearch).toBe(true)
  })

  it('measures the NEW provider-agnostic strategy specifically, not legacy Bright-Data-only attempts', () => {
    expect(RESUME_SPRINT_PROVIDER_STRATEGY_V40_5I).toBe('v40_5i_provider_agnostic')
  })

  // The ceiling itself is enforced in PostgreSQL (see
  // tests/v40-5i-canary-admission.test.ts for the executable proof). What the
  // application must get right is handing the database the right ceiling and
  // mode, rather than trying to decide headroom itself.
  it('passes the configured ceiling and canary mode into the claim RPC', () => {
    delete process.env.RESUME_SPRINT_RELEASE_MODE
    saveAndSet('RESUME_SPRINT_CANARY_CEILING', '6')
    const args = resumeSprintClaimArgsV40_5I({ limit: 36, worker: 'w', now: '2026-09-05T00:00:00.000Z' })
    expect(args).toEqual({
      p_limit: 36,
      p_worker: 'w',
      p_now: '2026-09-05T00:00:00.000Z',
      p_canary_ceiling: 6,
      p_scaled: false,
    })
  })

  it('only sets p_scaled when scaled mode is explicitly enabled', () => {
    saveAndSet('RESUME_SPRINT_RELEASE_MODE', 'scaled')
    expect(resumeSprintClaimArgsV40_5I({ limit: 36, worker: 'w', now: 'n' }).p_scaled).toBe(true)
  })

  it('does not throttle the overall claim limit, so parse work keeps draining', () => {
    // The ceiling applies per task-kind inside SQL; clamping the row limit here
    // would slow resume_fetch_parse for no safety benefit.
    const sprint = read('lib/fleet/resume-sprint-v40-5.ts')
    expect(sprint).toContain('limit: RESUME_SPRINT_CLAIM_LIMIT_V40_5')
  })
})

describe('V40.5i migration and runtime wiring', () => {
  it('creates durable per-provider telemetry alongside the atomic claim gate', () => {
    const migration = read('supabase/migrations/20260905030000_v40_5i_provider_agnostic_resume_discovery.sql')
    expect(migration).toContain('create table if not exists public.resume_sprint_provider_events')
    expect(migration).toContain("check (provider in ('serper','exa','brightdata'))")
    expect(migration).toContain('create or replace function public.claim_resume_sprint_tasks_v40_5i(')
  })

  it('wires the sprint runtime through the provider-agnostic orchestrator and the release gate', () => {
    const sprint = read('lib/fleet/resume-sprint-v40-5.ts')
    expect(sprint).toContain("from './resume-providers/orchestrator-v40-5i'")
    expect(sprint).toContain("from './resume-providers/release-gate-v40-5i'")
    expect(sprint).toContain('resumeSprintReleaseGateV40_5I')
    expect(sprint).toContain("sb.rpc('claim_resume_sprint_tasks_v40_5i'")
    expect(sprint).not.toContain('searchWebWithBrightDataV36_16')
  })

  it('wires the shared enrichment discovery path through the same provider-agnostic orchestrator', () => {
    const intelligence = read('lib/fleet/resume-intelligence-v40-4.ts')
    expect(intelligence).toContain("from './resume-providers/orchestrator-v40-5i'")
    expect(intelligence).toContain('discoverResumeCvUrlsV40_5I')
  })

  it('documents SERPER_API_KEY and Bright Data as optional in the environment example', () => {
    const env = read('.env.example')
    expect(env).toContain('SERPER_API_KEY=')
    expect(env).toContain('BRIGHTDATA_API_KEY=')
    expect(env).toContain('RESUME_SPRINT_RELEASE_MODE')
    expect(env).toContain('RESUME_SPRINT_CANARY_CEILING')
  })
})
