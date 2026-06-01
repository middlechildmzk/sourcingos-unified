// ─────────────────────────────────────────────────────────────────────────────
// app/auth/confirm/route.ts — Server-side magic-link confirmation via token_hash.
//
// WHY THIS REPLACES THE PKCE FLOW:
//   exchangeCodeForSession(code) requires a PKCE code verifier stored by the
//   browser client. In practice the verifier is lost or inaccessible when:
//     - Supabase redirects through its own hosted domain before hitting /auth/callback
//     - The verifier cookie is not forwarded to the server route handler
//     - The server-side cookies() API is read-only in Next.js 14 GET handlers
//
//   verifyOtp({ token_hash, type }) is stateless: it sends the token hash to
//   Supabase's auth API which validates it and returns a session. No browser
//   storage needed. Works reliably server-side.
//
// HOW TO ENABLE:
//   In Supabase Dashboard → Authentication → Email Templates → Magic Link
//   Change the button/link URL from:
//     {{ .ConfirmationURL }}
//   To:
//     {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app/candidate-search
//
// FLOW:
//   1. User clicks magic link → lands on /auth/confirm?token_hash=xxx&type=email
//   2. This route handler calls supabase.auth.verifyOtp({ token_hash, type })
//   3. On success: session cookies are set on the redirect response → user lands on /app/candidate-search
//   4. On error: redirect to /login?error=...
//
// COOKIE PATTERN:
//   We build NextResponse.redirect() BEFORE calling verifyOtp.
//   The @supabase/ssr cookie set/remove callbacks write directly into that response.
//   This bypasses the read-only cookies() limitation in Next.js GET route handlers.
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { safeRelativePath } from '@/lib/safe-redirect'

export const dynamic = 'force-dynamic'

// All token_hash types Supabase may send for email-based auth flows.
// https://supabase.com/docs/reference/javascript/auth-verifyotp
const VALID_TYPES = new Set([
  'email',          // standard OTP / magic link (most common)
  'magiclink',      // magic link alternate type
  'signup',         // email confirmation after signup
  'invite',         // user invite link
  'recovery',       // password recovery (future use)
])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const rawNext    = searchParams.get('next') ?? '/app/candidate-search'

  // Sanitise the redirect destination — prevent open redirect
  const next = safeRelativePath(rawNext)

  // ── Validate params ────────────────────────────────────────────────────────
  if (!token_hash) {
    return NextResponse.redirect(
      new URL('/login?error=Missing+token_hash.+Use+the+sign-in+link+from+your+email.', origin)
    )
  }

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.redirect(
      new URL('/login?error=Invalid+auth+link.+Request+a+new+sign-in+link.', origin)
    )
  }

  // ── Preview mode: no Supabase configured ──────────────────────────────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnon) {
    // Skip verification in preview — redirect directly
    return NextResponse.redirect(new URL(next, origin))
  }

  // ── Build the success redirect response BEFORE calling verifyOtp ──────────
  // This is the critical pattern: @supabase/ssr's set()/remove() callbacks
  // write session cookies directly into successResponse. There is no copy step
  // and no dependency on next/headers cookies() (which is read-only in GET handlers).
  const successResponse = NextResponse.redirect(new URL(next, origin))

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        // Read any existing cookies from the incoming request
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // Write new session cookies directly to the redirect response
        successResponse.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        successResponse.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // ── Exchange token hash for session ───────────────────────────────────────
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as 'email' | 'magiclink' | 'signup' | 'invite' | 'recovery',
  })

  if (error) {
    // Common error messages and their user-friendly equivalents
    const msg = error.message.includes('expired')
      ? 'Sign-in link has expired. Please request a new one.'
      : error.message.includes('invalid')
      ? 'Sign-in link is invalid or already used. Please request a new one.'
      : error.message

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, origin)
    )
  }

  // Session cookies are already set on successResponse — return it
  return successResponse
}
