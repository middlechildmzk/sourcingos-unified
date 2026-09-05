// tests/auth-gate.test.ts — fail-closed auth gate semantics.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getRouteSessionMock = vi.fn()
vi.mock('@/lib/supabase/route-session', () => ({
  getRouteSession: () => getRouteSessionMock(),
}))

import { requireAdmin, requireSession } from '@/lib/auth-gate'

const ENV_KEYS = [
  'VERCEL_ENV',
  'ALLOW_PREVIEW_BYPASS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const
let originalEnv: Record<string, string | undefined>

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

function configureSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
}

beforeEach(() => {
  originalEnv = {}
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key]
  clearEnv()
  getRouteSessionMock.mockReset()
})

afterEach(() => {
  clearEnv()
  for (const key of ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key]
  }
})

describe('requireSession — fail closed', () => {
  it('returns 503 when auth is unavailable and no bypass is set', async () => {
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.response.status).toBe(503)
      const body = await gate.response.json()
      expect(body.code).toBe('auth_unavailable')
      expect(JSON.stringify(body)).not.toMatch(/SUPABASE|ANTHROPIC|env/i)
    }
  })

  it('allows preview only with the explicit isolated bypass', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const gate = await requireSession()
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.preview).toBe(true)
      expect(gate.userId).toBe('preview-user')
    }
  })

  it('does not bypass when durable persistence is configured without auth', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(503)
  })

  it('returns 401 when configured but unauthenticated', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: false, userId: null, isAdmin: false })
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(401)
  })

  it('returns userId when configured and authenticated', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: true, userId: 'user-123', isAdmin: false })
    const gate = await requireSession()
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.userId).toBe('user-123')
      expect(gate.preview).toBe(false)
    }
  })

  it('returns 503 when the session layer throws', async () => {
    configureSupabase()
    getRouteSessionMock.mockImplementation(async () => { throw new Error('boom') })
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(503)
  })
})

describe('requireAdmin', () => {
  it('never grants admin access through preview bypass', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const gate = await requireAdmin()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(403)
  })

  it('returns 403 for an authenticated non-admin', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: true, userId: 'user-123', isAdmin: false })
    const gate = await requireAdmin()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(403)
  })

  it('passes for a validated admin', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: true, userId: 'admin-1', isAdmin: true })
    const gate = await requireAdmin()
    expect(gate.ok).toBe(true)
  })
})
