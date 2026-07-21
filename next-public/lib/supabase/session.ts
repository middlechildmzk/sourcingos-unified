// Server-component session helper. Identity is validated with Supabase Auth.
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { resolveServerAuthMode } from './config'

if (typeof window !== 'undefined') {
  throw new Error('[SourcingOS] lib/supabase/session.ts is server-only.')
}

function buildSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const cookieStore = cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
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

export async function getSession(): Promise<SessionResult> {
  const authMode = resolveServerAuthMode()
  if (authMode !== 'authenticated') {
    return {
      authenticated: false,
      user: null,
      mode: authMode === 'preview-bypass' ? 'preview' : 'supabase',
    }
  }

  const sb = buildSessionClient()
  if (!sb) return { authenticated: false, user: null, mode: 'supabase' }

  try {
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) {
      return { authenticated: false, user: null, mode: 'supabase' }
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('role, plan')
      .eq('id', user.id)
      .single()

    return {
      authenticated: true,
      mode: 'supabase',
      user: {
        id: user.id,
        email: user.email ?? '',
        role: (profile?.role ?? 'beta_user') as SessionUser['role'],
        plan: profile?.plan ?? 'free',
      },
    }
  } catch {
    return { authenticated: false, user: null, mode: 'supabase' }
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await getSession()
  return result.authenticated ? result.user : null
}
