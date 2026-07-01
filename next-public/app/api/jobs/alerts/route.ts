import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody } from '@/lib/validate'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const alertSchema = z.object({
  email: z.string().email().max(200),
  query: z.string().max(120).optional().default(''),
  location: z.string().max(120).optional().default(''),
  category: z.string().max(120).optional().default(''),
  frequency: z.enum(['daily', 'weekly']).optional().default('weekly'),
}).strip()

const globalAlerts = globalThis as unknown as { __sourcingosJobAlerts?: unknown[] }

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'submit')
  if (!rl.ok) return rl.response

  const parsed = await parseBody(req, alertSchema, 4 * 1024)
  if (!parsed.ok) return parsed.response

  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { error } = await sb.from('job_alert_signups').insert({
        email: parsed.data.email,
        query: parsed.data.query || null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        frequency: parsed.data.frequency,
        consent_at: new Date().toISOString(),
      })
      if (!error) return NextResponse.json({ ok: true, mode: 'supabase' })
      console.error('[SourcingOS jobs/alerts] Supabase write error:', error.message)
    }
  }

  if (!globalAlerts.__sourcingosJobAlerts) globalAlerts.__sourcingosJobAlerts = []
  globalAlerts.__sourcingosJobAlerts.unshift({ ...parsed.data, createdAt: new Date().toISOString() })
  return NextResponse.json({ ok: true, mode: 'preview' })
}
