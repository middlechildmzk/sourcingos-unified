import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('V37.3 production security hardening', () => {
  it('cannot disable rate limiting through a production environment flag', () => {
    const source = read('lib/rate-limit.ts')
    expect(source).toContain("process.env.RATE_LIMIT_DISABLED === 'true' && process.env.NODE_ENV !== 'production'")
    expect(source).toContain("authBootstrap:   { limit: 8,  windowSec: 900, sharedFallback: true, failClosed: true }")
    expect(source).toContain("waitlist:        { limit: 3,  windowSec: 3_600, sharedFallback: true }")
    expect(source).toContain("submit:          { limit: 5,  windowSec: 3_600, sharedFallback: true }")
    expect(source).toContain("count === null && def.failClosed && process.env.NODE_ENV === 'production'")
  })

  it('keeps the shared database limiter RLS-protected and service-role-only', () => {
    const migration = read('supabase/migrations/20260825_create_shared_rate_limit_counters.sql')
    expect(migration).toContain('alter table public.rate_limit_counters enable row level security')
    expect(migration).toContain('revoke all on table public.rate_limit_counters from anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on table public.rate_limit_counters to service_role')
    expect(migration).toContain('revoke all on function public.consume_rate_limit(text, integer) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.consume_rate_limit(text, integer) to service_role')
  })

  it('rate limits one-time password bootstrap before token lookup', () => {
    const source = read('app/api/auth/bootstrap-password/route.ts')
    expect(source).toContain("rateLimit(request, 'authBootstrap')")
    expect(source.indexOf("rateLimit(request, 'authBootstrap')")).toBeLessThan(source.indexOf('request.json()'))
  })

  it('keeps cron secrets out of query strings', () => {
    const helper = read('lib/cron-auth.ts')
    const refresh = read('app/api/candidates/cron-refresh/route.ts')
    const autosource = read('app/api/cron/autosource/route.ts')
    expect(helper).toContain("request.headers.get('authorization')")
    expect(helper).toContain("request.headers.get('x-cron-secret')")
    expect(helper).not.toContain('searchParams')
    expect(refresh).not.toMatch(/searchParams|get\(['\"]secret['\"]\)/)
    expect(autosource).not.toMatch(/searchParams|get\(['\"]secret['\"]\)/)
  })

  it('enforces a production CSP without unsafe-eval and denies framing', () => {
    const source = read('next.config.mjs')
    const productionStart = source.indexOf('const productionCsp')
    const previewStart = source.indexOf('const previewCsp')
    const production = source.slice(productionStart, previewStart)
    expect(production).toContain("script-src 'self' 'unsafe-inline'")
    expect(production).not.toContain('unsafe-eval')
    expect(production).toContain("frame-ancestors 'none'")
    expect(production).toContain("frame-src 'none'")
    expect(source).toContain("'Content-Security-Policy'")
    expect(source).toContain("{ key: 'X-Frame-Options', value: 'DENY' }")
    expect(source).toContain('Strict-Transport-Security')
  })

  it('keeps the public tool surface recruiter-only with no music utilities', () => {
    const toolRoot = join(process.cwd(), 'app/tools')
    const routes = readdirSync(toolRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name.toLowerCase())
    expect(routes.join(' ')).not.toMatch(/music|song|audio|spotify|lyrics|bpm|chord|artist/)
  })
})
