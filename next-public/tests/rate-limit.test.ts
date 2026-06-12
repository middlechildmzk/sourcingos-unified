// tests/rate-limit.test.ts + validate behavior.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { rateLimit, rateIdentifier } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'

function reqWithIp(ip: string): Request {
  return new Request('http://test.local/api/x', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  })
}

describe('rateLimit (in-memory backend)', () => {
  it('allows up to the limit then returns 429 with Retry-After', async () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 250)}` // unique bucket per run
    const req = reqWithIp(ip)
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(req, 'waitlist') // 3/hour
      expect(r.ok).toBe(true)
    }
    const fourth = await rateLimit(req, 'waitlist')
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) {
      expect(fourth.response.status).toBe(429)
      expect(fourth.response.headers.get('Retry-After')).toBeTruthy()
      const body = await fourth.response.json()
      expect(body.code).toBe('rate_limited')
      expect(JSON.stringify(body)).not.toMatch(/upstash|redis|token/i)
    }
  })

  it('scopes limits per identifier (userId beats IP)', async () => {
    const req = reqWithIp('10.9.9.9')
    expect(rateIdentifier(req, 'u-abc')).toBe('u:u-abc')
    expect(rateIdentifier(req)).toBe('ip:10.9.9.9')
    // Different users on the same IP do not share a bucket.
    for (let i = 0; i < 3; i++) expect((await rateLimit(req, 'waitlist', 'user-A')).ok).toBe(true)
    expect((await rateLimit(req, 'waitlist', 'user-B')).ok).toBe(true)
  })

  it('honors RATE_LIMIT_DISABLED=true for tests only', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true'
    const req = reqWithIp('10.1.1.1')
    for (let i = 0; i < 20; i++) expect((await rateLimit(req, 'waitlist')).ok).toBe(true)
  })
})

describe('parseBody', () => {
  const schema = z.object({ name: z.string().min(1).max(50) }).strip()

  function jsonReq(body: string): Request {
    return new Request('http://test.local/api/x', { method: 'POST', body })
  }

  it('rejects oversized payloads with 413 before parsing', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(5000) })
    const r = await parseBody(jsonReq(big), schema, 2 * 1024)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(413)
  })

  it('rejects invalid JSON with 400', async () => {
    const r = await parseBody(jsonReq('{not json'), schema)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })

  it('rejects schema violations with field names only (never values)', async () => {
    const r = await parseBody(jsonReq(JSON.stringify({ name: '', secret: 'hunter2' })), schema)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const body = await r.response.json()
      expect(r.response.status).toBe(400)
      expect(body.error).toContain('name')
      expect(JSON.stringify(body)).not.toContain('hunter2')
    }
  })

  it('passes valid bodies and strips unknown keys', async () => {
    const r = await parseBody(jsonReq(JSON.stringify({ name: 'ok', extra: 1 })), schema)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual({ name: 'ok' })
  })
})
