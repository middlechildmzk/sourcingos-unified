// ─────────────────────────────────────────────────────────────────────────────
// lib/supabase/auth.ts — Server-side auth helpers.
// Uses the service-role client to look up user roles.
// SERVER-ONLY (imports server.ts which imports server-only).
// ─────────────────────────────────────────────────────────────────────────────
import { createServerSupabaseClient, isSupabaseConfigured } from './server'

export type UserRole = 'beta_user' | 'admin' | 'employer'

export interface AuthResult {
  userId: string | null
  role: UserRole | null
  isAdmin: boolean
  isAuthenticated: boolean
  mode: 'supabase' | 'preview'
}

/**
 * Validates a Bearer token from an Authorization header and returns auth context.
 * Falls back to preview mode when Supabase is not configured.
 */
export async function getAuthFromHeader(
  authHeader: string | null
): Promise<AuthResult> {
  const preview: AuthResult = {
    userId: null, role: null, isAdmin: false, isAuthenticated: false, mode: 'preview'
  }

  if (!isSupabaseConfigured()) return preview

  if (!authHeader?.startsWith('Bearer ')) {
    return { ...preview, mode: 'supabase' }
  }

  const token = authHeader.slice(7)
  const sb = createServerSupabaseClient()
  if (!sb) return preview

  try {
    const { data: { user }, error } = await sb.auth.getUser(token)
    if (error || !user) return { ...preview, mode: 'supabase' }

    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'beta_user') as UserRole

    return {
      userId: user.id,
      role,
      isAdmin: role === 'admin',
      isAuthenticated: true,
      mode: 'supabase',
    }
  } catch {
    return { ...preview, mode: 'supabase' }
  }
}

/**
 * Returns the caller's user ID from the auth header.
 * Returns null if unauthenticated or Supabase not configured.
 */
export async function getUserIdFromHeader(
  authHeader: string | null
): Promise<string | null> {
  const auth = await getAuthFromHeader(authHeader)
  return auth.userId
}

/**
 * Requires admin role. Returns an error object if not authorized.
 * Usage: const err = await requireAdmin(req.headers.get('authorization'))
 *        if (err) return NextResponse.json(err, { status: err.status })
 */
export async function requireAdmin(
  authHeader: string | null
): Promise<{ ok: false; error: string; status: number } | null> {
  if (!isSupabaseConfigured()) {
    // Preview mode: pass through with a warning header
    return null
  }
  const auth = await getAuthFromHeader(authHeader)
  if (!auth.isAuthenticated) {
    return { ok: false, error: 'Authentication required.', status: 401 }
  }
  if (!auth.isAdmin) {
    return { ok: false, error: 'Admin access required.', status: 403 }
  }
  return null
}
