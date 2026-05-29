// ─────────────────────────────────────────────────────────────────────────────
// middleware.ts — Route protection using @supabase/ssr for real session checks.
//
// Replaces the Sprint 0 heuristic cookie-name check with actual session
// validation via supabase.auth.getSession(). Cookie refresh is forwarded
// so tokens stay live on every request.
//
// Behavior:
//   Supabase NOT configured → preview bypass (pass through, add warning header)
//   Session present          → pass through (cookies refreshed if needed)
//   No session               → redirect to /login?from=<path>
//
// /login and /auth/callback are always public.
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Paths that are always public regardless of auth state
const ALWAYS_PUBLIC = ['/login', '/auth/callback', '/waitlist']

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC.some(
    p => pathname === p || pathname === p + '/' || pathname.startsWith(p + '/')
  )
}

// Paths that require auth when Supabase is configured
const PROTECTED_PREFIXES = ['/app', '/jobs/admin']

function isProtectedPath(pathname: string): boolean {
  const clean = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return PROTECTED_PREFIXES.some(
    prefix => clean === prefix || clean.startsWith(prefix + '/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes bypass all checks
  if (isAlwaysPublic(pathname)) return NextResponse.next()

  // Non-protected routes bypass all checks
  if (!isProtectedPath(pathname)) return NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ── Preview mode: Supabase not configured ─────────────────────────────────
  if (!supabaseUrl || !supabaseAnonKey) {
    const res = NextResponse.next()
    res.headers.set('x-sourcingos-auth-mode', 'preview-bypass')
    res.headers.set('x-sourcingos-persistence', 'preview')
    return res
  }

  // ── Real session check via @supabase/ssr ──────────────────────────────────
  // We build a mutable response so cookie refreshes can be forwarded.
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // Forward refreshed cookies to both the request and response
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // getSession() reads from cookies — no network call, safe for middleware
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Authenticated — pass through with any refreshed cookies
    return response
  }

  // Unauthenticated — redirect to login, preserving intended destination
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match /app, /app/* and /jobs/admin — with or without trailing slash.
     * Exclude static assets (_next, images, favicon, robots).
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
