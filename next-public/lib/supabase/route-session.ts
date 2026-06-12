// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/route-session.ts — Cookie-based session for route handlers.
//
// Route handlers (app/api/**) can use cookies() from next/headers.
// This helper reads the session from the request cookies — no Authorization
// header required. This fixes the issue where logged-in users get 401 because
// the client didn't send a Bearer token.
//
// SERVER-ONLY. Do not import in 'use client' components.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, isSupabaseConfigured } from './server'

export interface RouteSession {
  authenticated: boolean
  userId: string | null
  role: 'beta_user' | 'admin' | 'employer' | null
  isAdmin: boolean
  mode: 'supabase' | 'preview'
}

/**
 * Reads the current user session from request cookies in a route handler.
 * Falls back to preview mode when Supabase env vars are missing.
 *
 * Usage in a route handler:
 *   const session = await getRouteSession()
 *   if (!session.authenticated && session.mode === 'supabase') {
 *     return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
 *   }
 *   const ownerId = session.userId  // never fall back to a shared/default owner
 */
export async function getRouteSession(): Promise<RouteSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return { authenticated: false, userId: null, role: null, isAdmin: false, mode: 'preview' }
  }

  const cookieStore = cookies()
  const sb = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set() {},
      remove() {},
    },
  })

  try {
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.user) {
      return { authenticated: false, userId: null, role: null, isAdmin: false, mode: 'supabase' }
    }

    // Fetch profile for role
    const serviceSb = createServerSupabaseClient()
    let role: RouteSession['role'] = 'beta_user'
    if (serviceSb) {
      const { data: profile } = await serviceSb.from('profiles').select('role').eq('id', session.user.id).single()
      role = (profile?.role ?? 'beta_user') as RouteSession['role']
    }

    return {
      authenticated: true,
      userId: session.user.id,
      role,
      isAdmin: role === 'admin',
      mode: 'supabase',
    }
  } catch {
    return { authenticated: false, userId: null, role: null, isAdmin: false, mode: 'supabase' }
  }
}

/**
 * Require authentication. Returns an error response object or null.
 * Usage: const err = await requireAuth(); if (err) return err;
 */
export async function requireAuth(): Promise<{ ok: false; error: string; status: number } | null> {
  if (!isSupabaseConfigured()) return null // preview bypass
  const session = await getRouteSession()
  if (!session.authenticated) return { ok: false, error: 'Authentication required.', status: 401 }
  return null
}

/**
 * Require admin role via cookies. Fixes the 401 issue when clients don't send Bearer tokens.
 */
export async function requireAdminCookie(): Promise<{ ok: false; error: string; status: number } | null> {
  if (!isSupabaseConfigured()) return null // preview bypass
  const session = await getRouteSession()
  if (!session.authenticated) return { ok: false, error: 'Authentication required.', status: 401 }
  if (!session.isAdmin) return { ok: false, error: 'Admin access required.', status: 403 }
  return null
}
