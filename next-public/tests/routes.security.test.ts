// tests/routes.security.test.ts — behavioral tests against REAL route handlers.
// Baseline env is unconfigured (see setup.ts), so the fail-closed path is the
// default condition under test: protected routes must never return 200.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

function post(url: string, body: unknown, ip = '10.50.0.1'): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}
function get(url: string, ip = '10.50.0.1'): NextRequest {
  return new NextRequest(`http://test.local${url}`, { headers: { 'x-forwarded-for': ip } })
}

describe('protected routes fail closed when auth is unconfigured', () => {
  it('POST /api/ai/search-strategy → 503, never 200', async () => {
    const { POST } = await import('../app/api/ai/search-strategy/route')
    const res = await POST(post('/api/ai/search-strategy', { jobTitle: 'DevSecOps Engineer' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.code).toBe('auth_unavailable')
  })

  it('POST /api/candidate-db/persist → cannot write without auth', async () => {
    const { POST } = await import('../app/api/candidate-db/persist/route')
    const res = await POST(post('/api/candidate-db/persist', {}))
    expect(res.status).toBe(503)
  })

  it('GET /api/candidate-db/list → no candidate data without auth', async () => {
    const { GET } = await import('../app/api/candidate-db/list/route')
    const res = await GET(get('/api/candidate-db/list'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.candidates).toBeUndefined()
  })

  it('POST /api/contact-enrichment/find → paid endpoint blocked anonymously', async () => {
    const { POST } = await import('../app/api/contact-enrichment/find/route')
    const res = await POST(post('/api/contact-enrichment/find', { fullName: 'Test Person' }))
    expect(res.status).toBe(503)
  })

  it('GET /api/persistence/status → no env details leak', async () => {
    const { GET } = await import('../app/api/persistence/status/route')
    const res = await GET()
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toMatch(/SUPABASE|SERVICE_ROLE/i)
  })

  it('GET /api/candidates/cron-refresh → 503 when CRON_SECRET is unset', async () => {
    const { GET } = await import('../app/api/candidates/cron-refresh/route')
    const res = await GET(get('/api/candidates/cron-refresh'))
    expect(res.status).toBe(503)
  })
})

describe('explicit preview bypass', () => {
  it('ALLOW_PREVIEW_BYPASS=true admits, but persist still refuses durable writes', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    process.env.RATE_LIMIT_DISABLED = 'true'
    const { POST } = await import('../app/api/candidate-db/persist/route')
    const res = await POST(post('/api/candidate-db/persist', {}))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.mode).toBe('preview')
  })
})

describe('bad request bodies', () => {
  it('POST /api/ai/search-strategy with non-JSON body → 400 (after auth would pass)', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    process.env.RATE_LIMIT_DISABLED = 'true'
    const { POST } = await import('../app/api/ai/search-strategy/route')
    const req = new NextRequest('http://test.local/api/ai/search-strategy', {
      method: 'POST', body: '{nope', headers: { 'x-forwarded-for': '10.50.0.2' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST /api/analytics rejects oversized payloads (2KB cap) with 413', async () => {
    const { POST } = await import('../app/api/analytics/route')
    const res = await POST(post('/api/analytics', { event: 'x', label: 'y'.repeat(3000) }, '10.60.0.1'))
    expect([400, 413]).toContain(res.status)
  })

  it('POST /api/analytics accepts a valid bounded event', async () => {
    const { POST } = await import('../app/api/analytics/route')
    const res = await POST(post('/api/analytics', { event: 'tool_open', page: '/tools' }, '10.60.0.2'))
    expect(res.status).toBe(200)
  })

  it('POST /api/jobs/submit validates with zod (bad URL → 400) without auth required', async () => {
    const { POST } = await import('../app/api/jobs/submit/route')
    const res = await POST(post('/api/jobs/submit', {
      email: 'a@b.co', companyName: 'Acme', jobTitle: 'Sourcer', jobUrl: 'example.com/not-a-url',
    }, '10.61.0.1'))
    expect(res.status).toBe(400)
  })
})

describe('public routes stay public but rate-limited', () => {
  it('POST /api/waitlist works without auth, then 429s after 3/hour', async () => {
    const { POST } = await import('../app/api/waitlist/route')
    const ip = '10.70.0.9'
    for (let i = 0; i < 3; i++) {
      const res = await POST(post('/api/waitlist', { email: `t${i}@example.com` }, ip))
      expect(res.status).toBe(200)
    }
    const res4 = await POST(post('/api/waitlist', { email: 't4@example.com' }, ip))
    expect(res4.status).toBe(429)
  })

  it('GET /api/jobs/search works without auth (sources mocked) and rate-limits per IP', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jobs: [], data: [] }), { status: 200 }) as never
    )
    const { GET } = await import('../app/api/jobs/search/route')
    const ip = '10.80.0.5'
    const ok = await GET(get('/api/jobs/search?q=sourcer', ip))
    expect(ok.status).toBe(200)
    // 'public' policy = 30/min — exhaust it
    for (let i = 0; i < 30; i++) await GET(get('/api/jobs/search?q=sourcer', ip))
    const limited = await GET(get('/api/jobs/search?q=sourcer', ip))
    expect(limited.status).toBe(429)
    fetchSpy.mockRestore()
  })

  it('GET /api/jobs/submit (submission list w/ emails) is NOT public', async () => {
    const { GET } = await import('../app/api/jobs/submit/route')
    const res = await GET()
    expect([401, 403, 503]).toContain(res.status)
  })
})

describe('AI routes rate-limit per user', () => {
  it('returns 429 after 10 requests/min under preview bypass', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const { POST } = await import('../app/api/ai/search-next/route')
    let last = 0
    for (let i = 0; i < 11; i++) {
      const res = await POST(post('/api/ai/search-next', { query: 'kubernetes' }, '10.90.0.1'))
      last = res.status
    }
    expect(last).toBe(429)
  })
})
