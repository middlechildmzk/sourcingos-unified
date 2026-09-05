// ─────────────────────────────────────────────────────────────────────────────
// /api/analytics — Public client-event ingestion.
// Bounded, rate-limited, privacy-minimized analytics.
// Stores no raw IP address or user agent. Session identifiers are one-way hashed.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const eventSchema = z.object({
  event: z.string().min(1).max(64),
  label: z.string().max(200).optional(),
  page: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  variant: z.string().max(120).optional(),
  ts: z.number().int().positive().optional(),
  session: z.string().max(128).optional(),
}).strip()

function hashSession(value?: string): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'analytics')
  if (!rl.ok) return rl.response

  const body = await parseBody(req, eventSchema, 2 * 1024)
  if (!body.ok) return body.response

  const occurredAt = body.data.ts
    ? new Date(body.data.ts).toISOString()
    : new Date().toISOString()

  const record = {
    event: body.data.event,
    label: body.data.label ?? null,
    page: body.data.page ?? null,
    source: body.data.source ?? null,
    variant: body.data.variant ?? null,
    session_hash: hashSession(body.data.session),
    occurred_at: occurredAt,
  }

  const sb = createServerSupabaseClient()
  if (sb) {
    const { error } = await sb.from('analytics_events').insert(record)
    if (!error) return NextResponse.json({ ok: true, persisted: true })
    console.error('[analytics] Supabase write failed:', error.message)
  }

  // Fail open for analytics only: never interrupt a user workflow because the
  // telemetry sink is unavailable. Keep a bounded structured log as fallback.
  console.log('[analytics:fallback]', JSON.stringify({ ...record, session_hash: record.session_hash ? 'hashed' : null }).slice(0, 768))
  return NextResponse.json({ ok: true, persisted: false }, { status: 202 })
}
