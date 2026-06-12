// ─────────────────────────────────────────────────────────────────────────────
// /api/analytics — Public client-event ingestion.
// Security sprint: zod-validated, 2KB payload cap, rate-limited per IP.
// Unknown keys are dropped; payloads are never echoed back.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'

const eventSchema = z.object({
  event: z.string().min(1).max(64),
  label: z.string().max(200).optional(),
  page: z.string().max(300).optional(),
  ts: z.number().int().positive().optional(),
}).strip() // drop unknown keys

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'analytics')
  if (!rl.ok) return rl.response

  const body = await parseBody(req, eventSchema, 2 * 1024) // 2KB cap
  if (!body.ok) return body.response

  // Preview sink: structured, bounded log line only.
  console.log('[analytics]', JSON.stringify(body.data).slice(0, 512))
  return NextResponse.json({ ok: true })
}
