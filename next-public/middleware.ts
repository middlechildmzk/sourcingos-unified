import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const CANONICAL_SITE_URL = 'https://www.getsourcingos.com'

const ALWAYS_PUBLIC = ['/login', '/auth/callback', '/waitlist']
function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC.some(p => pathname === p || pathname === p + '/' || pathname.startsWith(p + '/'))
}

const PROTECTED_PREFIXES = ['/app', '/jobs/admin', '/admin']
function isProtectedPath(pathname: string): boolean {
  const clean = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return PROTECTED_PREFIXES.some(prefix => clean === prefix || clean.startsWith(prefix + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const canonicalHost = new URL(CANONICAL_SITE_URL).host
  if (process.env.VERCEL_ENV === 'production' && request.nextUrl.host !== canonicalHost) {
    const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_SITE_URL)
    return NextResponse.redirect(redirectUrl, 308)
  }

  if (isAlwaysPublic(pathname)) return NextResponse.next()
  if (!isProtectedPath(pathname)) return NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.ALLOW_PREVIEW_BYPASS === 'true' && process.env.VERCEL_ENV !== 'production') {
      const res = NextResponse.next()
      res.headers.set('x-sourcingos-auth-mode', 'preview-bypass')
      res.headers.set('x-sourcingos-persistence', 'preview')
      return res
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({ request: { headers: request.headers } })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return request.cookies.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
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

  const { data: { session } } = await supabase.auth.getSession()
  if (session) return response

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'] }
