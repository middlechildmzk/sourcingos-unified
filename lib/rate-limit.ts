// ─────────────────────────────────────────────────────────────────────────────
// lib/rate-limit.ts — Centralized rate limiting for API routes.
//
// Backend selection:
//   1. Upstash Redis REST (preferred on Vercel) when both
//      UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
//   2. For critical public fan-out/end-user intake endpoints, a shared Supabase RPC fallback.
//   3. In-memory Map as the final best-effort fallback only for policies that permit it.
//
// Authentication bootstrap fails closed in production if no shared limiter can
// be reached, preventing distributed brute-force attempts across instances.
// SERVER-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type RatePolicy =
  | 'ai'
  | 'enrichment'
  | 'enrichmentDaily'
  | 'workbench'
  | 'sources'
  | 'waitlist'
  | 'contact'
  | 'submit'
  | 'authBootstrap'
  | 'public'
  | 'jobsSearch'
  | 'analytics'

interface PolicyDef {
  limit: number
  windowSec: number
  sharedFallback?: boolean
  failClosed?: boolean
}

const POLICIES: Record<RatePolicy, PolicyDef> = {
  ai:              { limit: 10, windowSec: 60 },
  enrichment:      { limit: 5,  windowSec: 60 },
  enrichmentDaily: { limit: 50, windowSec: 86_400 },
  workbench:       { limit: 30, windowSec: 60 },
  sources:         { limit: 30, windowSec: 60 },
  waitlist:        { limit: 3,  windowSec: 3_600, sharedFallback: true },
  contact:         { limit: 5,  windowSec: 3_600, sharedFallback: true },
  submit:          { limit: 5,  windowSec: 3_600, sharedFallback: true },
  authBootstrap:   { limit: 8,  windowSec: 900, sharedFallback: true, failClosed: true },
  public:          { limit: 30, windowSec: 60 },
  jobsSearch:      { limit: 20, windowSec: 60, sharedFallback: true },
  analytics:       { limit: 60, windowSec: 60 },
}

export interface RateOk { ok: true; remaining: number }
export interface RateFail { ok: false; response: NextResponse }
export type RateResult = RateOk | RateFail

export function rateIdentifier(req: Request | null | undefined, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const fwd = req?.headers?.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : req?.headers?.get('x-real-ip')
  return ip ? `ip:${ip}` : 'anon'
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashHit(key: string, windowSec: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as Array<{ result?: number }>
    const count = json?.[0]?.result
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

async function supabaseHit(key: string, windowSec: number): Promise<number | null> {
  const sb = createServerSupabaseClient()
  if (!sb) return null

  try {
    const { data, error } = await sb.rpc('consume_rate_limit', {
      counter_key: key,
      window_seconds: windowSec,
    })
    if (error) return null
    const count = typeof data === 'number' ? data : Number(data)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

const memory = new Map<string, { count: number; resetAt: number }>()
let warnedSharedFallback = false
let warnedMemoryFallback = false

function memoryHit(key: string, windowSec: number): number {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return 1
  }
  entry.count += 1
  return entry.count
}

function limited(windowSec: number): RateFail {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'Too many requests. Please slow down and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.min(windowSec, 3600)) } }
    ),
  }
}

function limiterUnavailable(): RateFail {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, code: 'rate_limit_unavailable', error: 'This protected action is temporarily unavailable. Please try again shortly.' },
      { status: 503, headers: { 'Retry-After': '60' } }
    ),
  }
}

export async function rateLimit(
  req: Request | null | undefined,
  policy: RatePolicy,
  userId?: string | null
): Promise<RateResult> {
  if (process.env.RATE_LIMIT_DISABLED === 'true' && process.env.NODE_ENV !== 'production') {
    return { ok: true, remaining: 999 }
  }

  const def = POLICIES[policy]
  const id = rateIdentifier(req, userId)
  const baseKey = `rl:${policy}:${id}`
  const bucket = Math.floor(Date.now() / (def.windowSec * 1000))
  const upstashKey = `${baseKey}:${bucket}`

  let count: number | null = null

  if (upstashConfigured()) count = await upstashHit(upstashKey, def.windowSec)

  if (count === null && def.sharedFallback) {
    count = await supabaseHit(baseKey, def.windowSec)
    if (count !== null && !warnedSharedFallback && process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] Upstash unavailable or unconfigured — using shared Supabase fallback for critical endpoint.')
      warnedSharedFallback = true
    }
  }

  if (count === null && def.failClosed && process.env.NODE_ENV === 'production') {
    console.error(`[rate-limit] Shared limiter unavailable for fail-closed policy: ${policy}`)
    return limiterUnavailable()
  }

  if (count === null) {
    if (!warnedMemoryFallback && process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] Shared rate-limit backend unavailable — using per-instance in-memory fallback.')
      warnedMemoryFallback = true
    }
    count = memoryHit(upstashKey, def.windowSec)
  }

  if (count > def.limit) return limited(def.windowSec)
  return { ok: true, remaining: Math.max(0, def.limit - count) }
}
