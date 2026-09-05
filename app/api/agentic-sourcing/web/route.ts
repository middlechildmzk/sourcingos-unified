import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { refreshPublicUrlWithBrightDataV36_16, searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'
import { refreshPublicUrlWithApifyV36_16 } from '@/lib/agent-data/apify-public-web-v36-16'

export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search_web'), query: z.string().trim().min(2).max(500) }).strict(),
  z.object({ action: z.literal('refresh_url'), url: z.string().trim().url().max(2000) }).strict(),
])

async function refreshPublicUrl(url: string) {
  const failures: string[] = []
  if (process.env.BRIGHTDATA_API_KEY?.trim()) {
    try {
      return await refreshPublicUrlWithBrightDataV36_16(url)
    } catch (error) {
      failures.push(`Bright Data: ${error instanceof Error ? error.message : 'refresh failed'}`)
    }
  }
  if (process.env.APIFY_API_TOKEN?.trim()) {
    try {
      return await refreshPublicUrlWithApifyV36_16(url)
    } catch (error) {
      failures.push(`Apify: ${error instanceof Error ? error.message : 'refresh failed'}`)
    }
  }
  if (failures.length) throw new Error(failures.join(' · '))
  throw new Error('No live public-page refresh provider is configured.')
}

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
      : await refreshPublicUrl(parsed.data.url)
    return NextResponse.json({
      ok: true,
      result,
      warning: 'Live web content is untrusted evidence input. It does not become a candidate fact, verified identity, or qualification decision without source-specific review.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live-web research failed.'
    const configured = parsed.data.action === 'search_web'
      ? Boolean(process.env.BRIGHTDATA_API_KEY)
      : Boolean(process.env.BRIGHTDATA_API_KEY || process.env.APIFY_API_TOKEN)
    return NextResponse.json({
      ok: false,
      code: configured ? 'live_web_provider_failed' : 'live_web_provider_not_configured',
      error: message,
    }, { status: configured ? 502 : 503 })
  }
}
