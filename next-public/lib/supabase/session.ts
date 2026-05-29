// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/session.ts — Server-component / route-handler session helper.
//
// Uses @supabase/ssr + next/headers cookies() to read the current user session
// in server components and route handlers. SERVER-ONLY.
//
// Do NOT use this in middleware (middleware cannot use next/headers).
// Do NOT use the service-role client here — this is user-scoped, RLS-enforced.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Runtime guard
if (typeof window !== 'undefined') {
  throw new Error('[SourcingOS] lib/supabase/session.ts is server-only.')
}

/** Build a session-aware Supabase client using next/headers cookies. */
function buildSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const cookieStore = cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      // Server components cannot set cookies — set/remove are no-ops here.
      // The middleware handles cookie refresh on every request.
      set() {},
      remove() {},
    },
  })
}

export type SessionUser = {
  id: string
  email: string
  role: 'beta_user' | 'admin' | 'employer'
  plan: string
}

export type SessionResult =
  | { authenticated: true; user: SessionUser; mode: 'supabase' }
  | { authenticated: false; user: null; mode: 'supabase' | 'preview' }

/**
 * Get the current session in a server component or route handler.
 * Returns preview mode result when Supabase is not configured.
 */
export async function getSession(): Promise<SessionResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return { authenticated: false, user: null, mode: 'preview' }
  }

  const sb = buildSessionClient()
  if (!sb) return { authenticated: false, user: null, mode: 'supabase' }

  try {
    const { data: { session }, error } = await sb.auth.getSession()
    if (error || !session?.user) {
      return { authenticated: false, user: null, mode: 'supabase' }
    }

    // Fetch the profile for role information
    const { data: profile } = await sb
      .from('profiles')
      .select('role, plan')
      .eq('id', session.user.id)
      .single()

    return {
      authenticated: true,
      mode: 'supabase',
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        role: (profile?.role ?? 'beta_user') as SessionUser['role'],
        plan: profile?.plan ?? 'free',
      },
    }
  } catch {
    return { authenticated: false, user: null, mode: 'supabase' }
  }
}

/**
 * Convenience: returns the user or null. Use when you only need the user object.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await getSession()
  return result.authenticated ? result.user : null
}
