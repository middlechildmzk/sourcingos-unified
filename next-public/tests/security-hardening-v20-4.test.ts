import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  isDurablePersistenceConfigured,
  isSupabaseAuthConfigured,
  previewBypassEnabled,
  resolveServerAuthMode,
} from '@/lib/supabase/config'

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: getUserMock } }),
}))

import { middleware } from '@/middleware'

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

function configureAuth() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
}

function configureDurableOnly() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
}

beforeEach(() => {
  originalEnv = {}
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key]
  clearEnv()
  getUserMock.mockReset()
})

afterEach(() => {
  clearEnv()
  for (const key of ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key]
  }
})

describe('shared Supabase configuration contract', () => {
  it('distinguishes authentication from durable service-role persistence', () => {
    configureAuth()
    expect(isSupabaseAuthConfigured()).toBe(true)
    expect(isDurablePersistenceConfigured()).toBe(false)

    clearEnv()
    configureDurableOnly()
    expect(isSupabaseAuthConfigured()).toBe(false)
    expect(isDurablePersistenceConfigured()).toBe(true)
  })

  it('permits preview bypass only with no auth and no durable persistence', () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    expect(previewBypassEnabled()).toBe(true)
    expect(resolveServerAuthMode()).toBe('preview-bypass')

    configureAuth()
    expect(previewBypassEnabled()).toBe(false)
    expect(resolveServerAuthMode()).toBe('authenticated')

    clearEnv()
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    configureDurableOnly()
    expect(previewBypassEnabled()).toBe(false)
    expect(resolveServerAuthMode()).toBe('unavailable')
  })

  it('never permits preview bypass in production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    expect(previewBypassEnabled()).toBe(false)
    expect(resolveServerAuthMode()).toBe('unavailable')
  })
})

describe('middleware uses the shared fail-closed rule', () => {
  it('allows explicit isolated preview bypass', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const response = await middleware(new NextRequest('https://preview.vercel.app/app'))
    expect(response.status).toBe(200)
    expect(response.headers.get('x-sourcingos-auth-mode')).toBe('preview-bypass')
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('fails closed when durable persistence exists without an auth key', async () => {
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    configureDurableOnly()
    const response = await middleware(new NextRequest('https://preview.vercel.app/app'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('validates configured sessions with getUser and rejects invalid sessions', async () => {
    configureAuth()
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('expired') })
    const response = await middleware(new NextRequest('https://preview.vercel.app/app'))
    expect(getUserMock).toHaveBeenCalledOnce()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows a server-validated user', async () => {
    configureAuth()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const response = await middleware(new NextRequest('https://preview.vercel.app/app'))
    expect(response.status).toBe(200)
  })

  it('does not enable preview bypass on the production host', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.ALLOW_PREVIEW_BYPASS = 'true'
    const response = await middleware(new NextRequest('https://www.getsourcingos.com/app'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
