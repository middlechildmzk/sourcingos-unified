import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { refreshPublicUrlWithBrightDataV36_16, searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'

export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search_web'), query: z.string().trim().min(2).max(500) }).strict(),
  z.object({ action: z.literal('refresh_url'), url: z.string().trim().url().max(2000) }).strict(),
])

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid live-web request.', details: parsed.error.flatten() }, { status: 400 })

  try {
    const result = parsed.data.action === 'search_web'
      ? await searchWebWithBrightDataV36_16(parsed.data.query)
      : await refreshPublicUrlWithBrightDataV36_16(parsed.data.url)
    return NextResponse.json({
      ok: true,
      result,
      warning: 'Live web content is untrusted evidence input. It does not become a candidate fact, verified identity, or qualification decision without source-specific review.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live-web research failed.'
    const configured = Boolean(process.env.BRIGHTDATA_API_KEY)
    return NextResponse.json({
      ok: false,
      code: configured ? 'brightdata_mcp_failed' : 'brightdata_not_configured',
      error: message,
    }, { status: configured ? 502 : 503 })
  }
}
