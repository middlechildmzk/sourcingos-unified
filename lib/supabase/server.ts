// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/server.ts — SERVICE ROLE client. SERVER-ONLY.
//
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Service role bypasses RLS — use only in reviewed server-side operations.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { isDurablePersistenceConfigured } from './config'

export {
  isSupabaseAuthConfigured,
  isDurablePersistenceConfigured,
  previewBypassEnabled,
  resolveServerAuthMode,
  type ServerAuthMode,
} from './config'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SourcingOS] lib/supabase/server.ts was imported in a browser context. ' +
    'This file is server-only. Never import it in client components.'
  )
}

let _cachedClient: SupabaseClient | null = null

export function createServerSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  if (!_cachedClient) {
    _cachedClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  }
  return _cachedClient
}

/**
 * @deprecated Ambiguous legacy name. Existing call sites use this to mean
 * durable service-role persistence, not browser/session authentication.
 */
export function isSupabaseConfigured(): boolean {
  return isDurablePersistenceConfigured()
}

export function createUserSupabaseClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** @deprecated Implicit owner fallback was removed. */
export function getDefaultOwnerId(): string | null {
  return null
}
