// ─────────────────────────────────────────────────────────────────────────────
// lib/rate-limit.ts — Centralized rate limiting for API routes.
//
// Backend selection:
//   • Upstash Redis REST (recommended for Vercel) when both
//     UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
//     Fixed-window counters via atomic INCR + EXPIRE — no SDK dependency.
//   • In-memory Map fallback otherwise. NOTE: per-serverless-instance only —
//     best-effort protection, NOT a substitute for Redis in production.
//     A warning is logged once per instance when the fallback is active.
//
// Setup (Vercel):
//   1. Create an Upstash Redis database (Vercel Marketplace → Upstash).
//   2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to
//      Production + Preview environments.
//
// Error responses are generic 429s with Retry-After. No backend details leak.
// SERVER-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextResponse } from 'next/server'

export type RatePolicy =
  | 'ai'              // AI copilot generation
  | 'enrichment'      // contact enrichment, per-minute
  | 'enrichmentDaily' // contact enrichment, per-day cap
  | 'workbench'       // workbench + candidate-db + projects
  | 'sources'         // source connector search
  | 'waitlist'        // public waitlist signup
  | 'submit'          // public job submission
  | 'public'          // public read endpoints (jobs search)
  | 'analytics'       // public analytics events

interface PolicyDef { limit: number; windowSec: number }

const POLICIES: Record<RatePolicy, PolicyDef> = {
  ai:              { limit: 10, windowSec: 60 },
  enrichment:      { limit: 5,  windowSec: 60 },
  enrichmentDaily: { limit: 50, windowSec: 86_400 },
  workbench:       { limit: 30, windowSec: 60 },
  sources:         { limit: 30, windowSec: 60 },
  waitlist:        { limit: 3,  windowSec: 3_600 },
  submit:          { limit: 5,  windowSec: 3_600 },
  public:          { limit: 30, windowSec: 60 },
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
    // Pipeline: INCR key; EXPIRE key window NX  (atomic enough for fixed window)
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
    return null // backend trouble → fall through to in-memory
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memory = new Map<string, { count: number; resetAt: number }>()
let warnedFallback = false

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
 * Apply a rate-limit policy. Usage:
 *   const rl = await rateLimit(req, 'ai', gate.userId)
 *   if (!rl.ok) return rl.response
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
  // Fixed-window bucketing keeps Upstash keys bounded.
  const bucket = Math.floor(Date.now() / (def.windowSec * 1000))
  const key = `rl:${policy}:${id}:${bucket}`

  let count: number | null = null
  if (upstashConfigured()) count = await upstashHit(key, def.windowSec)

  if (count === null) {
    if (!warnedFallback && process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] Upstash unavailable or unconfigured — using per-instance in-memory fallback.')
      warnedFallback = true
    }
    count = memoryHit(key, def.windowSec)
  }

  if (count > def.limit) return limited(def.windowSec)
  return { ok: true, remaining: Math.max(0, def.limit - count) }
}
