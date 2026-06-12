// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/server.ts — SERVICE ROLE client. SERVER-ONLY.
//
// This file uses 'server-only' to cause a BUILD ERROR if accidentally imported
// in a client component. The runtime guard below provides a secondary check.
//
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// NEVER use this client for user-authenticated reads (use the anon client + RLS).
// Service role bypasses RLS — use only for admin/server writes.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Secondary runtime guard: throw at runtime if somehow called in browser context
if (typeof window !== 'undefined') {
  throw new Error(
    '[SourcingOS] lib/supabase/server.ts was imported in a browser context. ' +
    'This file is server-only. Never import it in client components.'
  )
}

let _cachedClient: SupabaseClient | null = null

/**
 * Returns a Supabase service-role client, or null if env vars are not configured.
 * Uses a module-level singleton to avoid creating a new client per request.
 *
 * IMPORTANT: This client bypasses RLS. Use only in server-side route handlers.
 * For user-scoped reads, use the anon client + pass the user's JWT.
 */
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

/** True when both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Get a user-scoped Supabase client by passing the caller's JWT.
 * This respects RLS — use for user-initiated reads/writes.
 */
export function createUserSupabaseClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** The default owner_id to use when no user session is available (dev/preview). */
/** @deprecated Security sprint 2026-06: implicit owner fallback removed.
 *  All candidate/project writes must be scoped to the authenticated user. */
export function getDefaultOwnerId(): string | null {
  return null
}
