// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/browser.ts — Browser client using @supabase/ssr.
//
// createBrowserClient from @supabase/ssr automatically handles cookie-based
// session storage, which matches what the middleware and server helpers expect.
// Safe to use in 'use client' components.
// ─────────────────────────────────────────────────────────────────────────────
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

/**
 * Returns a browser-safe Supabase client using the anon key.
 * RLS policies enforce data access.
 * Uses cookie-based session storage (consistent with middleware + server helpers).
 * Returns null when env vars are not configured.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createSSRBrowserClient(url, anonKey)
}

/** True when both NEXT_PUBLIC_ Supabase vars are available. */
export function isBrowserSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
