// ─────────────────────────────────────────────────────────────────────────────
// app/auth/callback/route.ts — Magic-link code exchange handler.
//
// Supabase sends the user to this URL after they click the magic link:
//   /auth/callback?code=<pkce-code>
//
// This handler:
//   1. Exchanges the PKCE code for a session via exchangeCodeForSession()
//   2. Sets the session cookies (handled internally by @supabase/ssr)
//   3. Redirects to the intended destination or /app/candidate-search
//   4. On error → redirects to /login?error=<message>
//
// IMPORTANT: Add https://[your-site]/auth/callback to your Supabase project's
// "Redirect URLs" list (Authentication → URL Configuration).
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { safeRelativePath } from '@/lib/safe-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app/candidate-search'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Surface any auth errors from Supabase
  if (errorParam) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', errorDescription ?? errorParam)
    return NextResponse.redirect(loginUrl)
  }

  if (!code) {
    // No code and no error — unexpected state
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', 'Missing auth code. Please try signing in again.')
    return NextResponse.redirect(loginUrl)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // Preview mode — no Supabase configured
    return NextResponse.redirect(new URL('/app/candidate-search', origin))
  }

  const cookieStore = cookies()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.delete({ name, ...options })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', error.message)
    return NextResponse.redirect(loginUrl)
  }

  // Session set — sanitise destination to prevent open redirect
  const destination = safeRelativePath(next)
  return NextResponse.redirect(new URL(destination, origin))
}
