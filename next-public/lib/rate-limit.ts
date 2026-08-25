// ─────────────────────────────────────────────────────────────────────────────
// lib/rate-limit.ts — Centralized rate limiting for API routes.
//
// Backend selection:
//   1. Upstash Redis REST (preferred on Vercel) when both
//      UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
//   2. For critical public fan-out endpoints, a shared Supabase RPC fallback.
//   3. In-memory Map as the final best-effort fallback only.
//
// The jobs-search policy intentionally uses the shared Supabase fallback when
// Upstash is not available so one serverless instance cannot bypass another.
// SERVER-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type RatePolicy =
  | 'ai'              // AI copilot generation
  | 'enrichment'      // contact enrichment, per-minute
  | 'enrichmentDaily' // contact enrichment, per-day cap
  | 'workbench'       // workbench + candidate-db + projects
  | 'sources'         // source connector search
  | 'waitlist'        // public waitlist signup
  | 'submit'          // public job submission
  | 'public'          // low-cost public read endpoints
  | 'jobsSearch'      // public jobs search; fans out to upstream job sources
  | 'analytics'       // public analytics events

interface PolicyDef {
  limit: number
  windowSec: number
  sharedFallback?: boolean
}

const POLICIES: Record<RatePolicy, PolicyDef> = {
  ai:              { limit: 10, windowSec: 60 },
  enrichment:      { limit: 5,  windowSec: 60 },
  enrichmentDaily: { limit: 50, windowSec: 86_400 },
  workbench:       { limit: 30, windowSec: 60 },
  sources:         { limit: 30, windowSec: 60 },
  waitlist:        { limit: 3,  windowSec: 3_600 },
  submit:          { limit: 5,  windowSec: 3_600 },
  public:          { limit: 30, windowSec: 60 },
  jobsSearch:      { limit: 20, windowSec: 60, sharedFallback: true },
  analytics:       { limit: 60, windowSec: 60 },
}

export interface RateOk { ok: true; remaining: number }
export interface RateFail { ok: false; response: NextResponse }
export type RateResult = RateOk | RateFail

// ── Identifier ────────────────────────────────────────────────────────────────
/** Prefer the authenticated userId; fall back to client IP; then 'anon'. */
export function rateIdentifier(req: Request | null | undefined, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const fwd = req?.headers?.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : req?.headers?.get('x-real-ip')
  return ip ? `ip:${ip}` : 'anon'
}

// ── Upstash REST backend ──────────────────────────────────────────────────────
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

// ── Shared Supabase fallback ──────────────────────────────────────────────────
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

// ── In-memory fallback ────────────────────────────────────────────────────────
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

/**
 * Apply a rate-limit policy.
 *
 * Upstash is preferred. Critical fan-out endpoints can opt into the shared
 * Supabase fallback. Memory remains a final availability fallback so a Redis or
 * database incident does not automatically make a public route unavailable.
 *
 * Set RATE_LIMIT_DISABLED=true only in automated tests.
 */
export async function rateLimit(
  req: Request | null | undefined,
  policy: RatePolicy,
  userId?: string | null
): Promise<RateResult> {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return { ok: true, remaining: 999 }

  const def = POLICIES[policy]
  const id = rateIdentifier(req, userId)
  const baseKey = `rl:${policy}:${id}`
  const bucket = Math.floor(Date.now() / (def.windowSec * 1000))
  const upstashKey = `${baseKey}:${bucket}`

  let count: number | null = null

  if (upstashConfigured()) {
    count = await upstashHit(upstashKey, def.windowSec)
  }

  if (count === null && def.sharedFallback) {
    count = await supabaseHit(baseKey, def.windowSec)
    if (count !== null && !warnedSharedFallback && process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] Upstash unavailable or unconfigured — using shared Supabase fallback for critical endpoint.')
      warnedSharedFallback = true
    }
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
