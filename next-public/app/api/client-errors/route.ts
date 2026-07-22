import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const Payload = z.object({
  kind: z.enum(['window_error', 'unhandled_rejection']),
  name: z.string().max(100),
  message: z.string().max(500),
  stack: z.string().max(2500),
  route: z.string().max(300),
  build: z.string().max(100),
  occurredAt: z.string().max(100),
})

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/[^\s)\]}]+/gi, '[redacted-url]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[redacted-id]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[redacted-phone]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted-token]')
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const limited = await rateLimit(req, 'workbench', gate.userId)
  if (!limited.ok) return limited.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = Payload.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid client error payload.' }, { status: 400 })

  const event = {
    kind: parsed.data.kind,
    name: redact(parsed.data.name),
    message: redact(parsed.data.message),
    stack: redact(parsed.data.stack),
    route: parsed.data.route.startsWith('/app') ? parsed.data.route : '/app',
    build: redact(parsed.data.build),
    occurredAt: parsed.data.occurredAt,
  }

  // Structured output is intentionally free of user ids, email addresses, contact
  // data, URLs, and tokens. Vercel runtime logs can alert on this event marker.
  console.error('[SourcingOSClientError]', JSON.stringify(event))
  return NextResponse.json({ ok: true })
}
