// Cookie-based, server-validated session helper for route handlers.
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { resolveServerAuthMode } from './config'

export interface RouteSession {
  authenticated: boolean
  userId: string | null
  role: 'beta_user' | 'admin' | 'employer' | null
  isAdmin: boolean
  mode: 'supabase' | 'preview'
}

export async function getRouteSession(): Promise<RouteSession> {
  const authMode = resolveServerAuthMode()
  if (authMode !== 'authenticated') {
    return {
      authenticated: false,
      userId: null,
      role: null,
      isAdmin: false,
      mode: authMode === 'preview-bypass' ? 'preview' : 'supabase',
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookieStore = cookies()
  const sb = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set() {},
      remove() {},
    },
  })

  try {
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) {
      return { authenticated: false, userId: null, role: null, isAdmin: false, mode: 'supabase' }
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'beta_user') as RouteSession['role']
    return {
      authenticated: true,
      userId: user.id,
      role,
      isAdmin: role === 'admin',
      mode: 'supabase',
    }
  } catch {
    return { authenticated: false, userId: null, role: null, isAdmin: false, mode: 'supabase' }
  }
}

export async function requireAuth(): Promise<{ ok: false; error: string; status: number } | null> {
  const mode = resolveServerAuthMode()
  if (mode === 'preview-bypass') return null
  if (mode === 'unavailable') return { ok: false, error: 'Authentication is unavailable.', status: 503 }

  const session = await getRouteSession()
  if (!session.authenticated) return { ok: false, error: 'Authentication required.', status: 401 }
  return null
}

export async function requireAdminCookie(): Promise<{ ok: false; error: string; status: number } | null> {
  const mode = resolveServerAuthMode()
  if (mode === 'preview-bypass') return { ok: false, error: 'Admin access is unavailable in preview mode.', status: 403 }
  if (mode === 'unavailable') return { ok: false, error: 'Authentication is unavailable.', status: 503 }

  const session = await getRouteSession()
  if (!session.authenticated) return { ok: false, error: 'Authentication required.', status: 401 }
  if (!session.isAdmin) return { ok: false, error: 'Admin access required.', status: 403 }
  return null
}
