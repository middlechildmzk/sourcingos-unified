/**
 * Edge-safe Supabase environment helpers.
 *
 * This module intentionally has no `server-only` import and creates no clients,
 * so middleware, server components, and route handlers can share one auth-mode
 * decision without pulling service-role code into the Edge bundle.
 */

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function isDurablePersistenceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function previewBypassEnabled(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false
  if (process.env.ALLOW_PREVIEW_BYPASS !== 'true') return false
  if (isSupabaseAuthConfigured()) return false
  if (isDurablePersistenceConfigured()) return false
  return true
}

export type ServerAuthMode = 'authenticated' | 'preview-bypass' | 'unavailable'

export function resolveServerAuthMode(): ServerAuthMode {
  if (isSupabaseAuthConfigured()) return 'authenticated'
  if (previewBypassEnabled()) return 'preview-bypass'
  return 'unavailable'
}
