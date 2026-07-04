// tests/prod-honesty.test.ts — Production must never fake success or open gates.
//
// 1. Waitlist / job alerts: when persistence is unavailable in production,
//    the API returns an honest failure. Users are never told they were saved
//    when they were not. Outside production, the explicit preview capture
//    mode still works (persisted: false).
// 2. ALLOW_PREVIEW_BYPASS is inert on production deployments, even if set.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

function post(url: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('waitlist honesty', () => {
  it('production + no persistence → honest failure, never ok:true', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const { POST } = await import('../app/api/waitlist/route')
    const res = await POST(post('/api/waitlist', { email: 'prod-a@example.com' }, '10.99.1.1'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(String(body.error).toLowerCase()).toContain('not on the list')
  })

  it('non-production + no persistence → explicit preview capture, persisted:false', async () => {
    const { POST } = await import('../app/api/waitlist/route')
    const res = await POST(post('/api/waitlist', { email: 'dev-a@example.com' }, '10.99.1.2'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.mode).toBe('preview')
    expect(body.persisted).toBe(false)
  })
})

describe('job alerts honesty', () => {
  it('production + no persistence → honest failure, never ok:true', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const { POST } = await import('../app/api/jobs/alerts/route')
    const res = await POST(post('/api/jobs/alerts', { email: 'prod-b@example.com' }, '10.99.2.1'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('non-production + no persistence → explicit preview capture, persisted:false', async () => {
    const { POST } = await import('../app/api/jobs/alerts/route')
    const res = await POST(post('/api/jobs/alerts', { email: 'dev-b@example.com' }, '10.99.2.2'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.mode).toBe('preview')
    expect(body.persisted).toBe(false)
  })
})

describe('preview bypass is inert in production', () => {
  it('ALLOW_PREVIEW_BYPASS=true + VERCEL_ENV=production + no Supabase → still fails closed', async () => {
    vi.stubEnv('ALLOW_PREVIEW_BYPASS', 'true')
    vi.stubEnv('VERCEL_ENV', 'production')
    const { requireSession } = await import('../lib/auth-gate')
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(503)
  })

  it('ALLOW_PREVIEW_BYPASS=true outside production still allows explicit preview', async () => {
    vi.stubEnv('ALLOW_PREVIEW_BYPASS', 'true')
    const { requireSession } = await import('../lib/auth-gate')
    const gate = await requireSession()
    expect(gate.ok).toBe(true)
    if (gate.ok) expect(gate.preview).toBe(true)
  })
})
