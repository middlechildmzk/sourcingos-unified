import 'server-only'
import { NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export interface GateOk {
  ok: true
  userId: string
  isAdmin: boolean
  preview: boolean
}
export interface GateFail {
  ok: false
  response: NextResponse
}
export type GateResult = GateOk | GateFail

function fail(status: 401 | 403 | 503, code: string, error: string): GateFail {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, code, error }, { status }),
  }
}

export function previewBypassEnabled(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false
  return process.env.ALLOW_PREVIEW_BYPASS === 'true'
}

export async function requireSession(opts?: { admin?: boolean }): Promise<GateResult> {
  if (!isSupabaseConfigured()) {
    if (previewBypassEnabled()) {
      return { ok: true, userId: 'preview-user', isAdmin: false, preview: true }
    }
    return fail(503, 'auth_unavailable', 'Authentication is unavailable. Please try again later.')
  }

  let session
  try {
    session = await getRouteSession()
  } catch {
    return fail(503, 'auth_unavailable', 'Authentication is unavailable. Please try again later.')
  }

  if (!session.authenticated || !session.userId) {
    return fail(401, 'auth_required', 'Sign in required.')
  }

  if (opts?.admin && !session.isAdmin) {
    return fail(403, 'forbidden', 'You do not have access to this resource.')
  }

  return { ok: true, userId: session.userId, isAdmin: session.isAdmin, preview: false }
}

export function requireAdmin(): Promise<GateResult> {
  return requireSession({ admin: true })
}
