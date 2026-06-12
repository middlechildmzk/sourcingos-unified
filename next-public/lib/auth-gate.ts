// ─────────────────────────────────────────────────────────────────────────────
// lib/auth-gate.ts — Centralized FAIL-CLOSED auth gate for API routes.
//
// Security Sprint (2026-06): replaces the fail-open pattern
//   `if (isSupabaseConfigured()) { ...check... }`
// which silently allowed full access whenever Supabase env vars were missing.
//
// Behavior:
//   Supabase NOT configured + ALLOW_PREVIEW_BYPASS !== 'true'  → 503 (fail closed)
//   Supabase NOT configured + ALLOW_PREVIEW_BYPASS === 'true'  → preview session
//   Configured, no session                                      → 401
//   Configured, session, admin required but not admin           → 403
//   Configured, valid session                                   → { ok: true, userId }
//
// NEVER set ALLOW_PREVIEW_BYPASS=true on a deployment that carries paid
// provider keys (ANTHROPIC_API_KEY / AI_PROVIDER_API_KEY / PDL keys).
// Error responses are generic: no env names, no stack traces, no internals.
// SERVER-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
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
  return process.env.ALLOW_PREVIEW_BYPASS === 'true'
}

/**
 * Require an authenticated session. Fails CLOSED when auth is unavailable.
 *
 * Usage:
 *   const gate = await requireSession()
 *   if (!gate.ok) return gate.response
 *   // gate.userId is always a string ('preview-user' only under explicit bypass)
 */
export async function requireSession(opts?: { admin?: boolean }): Promise<GateResult> {
  // ── Auth backend missing ───────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    if (previewBypassEnabled()) {
      // Explicit, opt-in preview mode for local dev / protected preview deploys.
      return { ok: true, userId: 'preview-user', isAdmin: false, preview: true }
    }
    // Fail closed. Do not reveal which configuration is missing.
    return fail(503, 'auth_unavailable', 'Authentication is unavailable. Please try again later.')
  }

  // ── Real session check (cookie-based) ──────────────────────────────────────
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

/** Shorthand for admin-only routes. */
export function requireAdmin(): Promise<GateResult> {
  return requireSession({ admin: true })
}
