// tests/auth-gate.test.ts — fail-closed auth gate semantics.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the session layer so we can drive every auth state deterministically.
const getRouteSessionMock = vi.fn()
vi.mock('@/lib/supabase/route-session', () => ({
  getRouteSession: () => getRouteSessionMock(),
}))

import { requireSession, requireAdmin } from '@/lib/auth-gate'

function configureSupabase() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
}

// Block body matters: an expression body would RETURN the mock, and
// Vitest invokes returned functions as teardown — calling the mock again.
beforeEach(() => { getRouteSessionMock.mockReset() })

describe('requireSession — fail closed', () => {
  it('returns 503 when Supabase is NOT configured and no bypass is set', async () => {
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.response.status).toBe(503)
      const body = await gate.response.json()
      expect(body.code).toBe('auth_unavailable')
      // No env names, no internals
      expect(JSON.stringify(body)).not.toMatch(/SUPABASE|ANTHROPIC|env/i)
    }
  })

  it('allows preview ONLY with explicit ALLOW_PREVIEW_BYPASS=true', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const gate = await requireSession()
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.preview).toBe(true)
      expect(gate.userId).toBe('preview-user')
    }
  })

  it('does NOT bypass for truthy-but-wrong values', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = '1'
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
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

  it('returns 503 (not 200) when the session layer throws', async () => {
    configureSupabase()
    getRouteSessionMock.mockImplementation(async () => { throw new Error('boom') })
    const gate = await requireSession()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(503)
  })
})

describe('requireAdmin', () => {
  it('returns 403 for authenticated non-admin', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: true, userId: 'user-123', isAdmin: false })
    const gate = await requireAdmin()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(403)
  })

  it('passes for admin', async () => {
    configureSupabase()
    getRouteSessionMock.mockResolvedValue({ authenticated: true, userId: 'admin-1', isAdmin: true })
    const gate = await requireAdmin()
    expect(gate.ok).toBe(true)
  })
})
