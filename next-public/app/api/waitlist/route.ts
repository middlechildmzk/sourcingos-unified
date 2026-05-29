import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email(),
  role: z.string().max(120).optional(),
  focus: z.string().max(120).optional(),
  intent: z.string().max(240).optional(),
  source_page: z.string().max(240).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid waitlist payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, role, focus, intent, source_page } = parsed.data

  // ── Supabase persistence when configured ──────────────────────────────────
  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { error } = await sb.from('waitlist').upsert(
        { email, role: role || null, focus: focus || null, intent: intent || null, source_page: source_page || null },
        { onConflict: 'email' }   // idempotent — re-joins don't create duplicates
      )
      if (error) {
        console.error('[SourcingOS waitlist] Supabase write error:', error.message)
        // Don't surface DB errors to the user — fall through to preview response
      } else {
        return NextResponse.json({
          ok: true,
          mode: 'supabase',
          message: 'You are on the list. We will reach out when your cohort opens.',
        })
      }
    }
  }

  // ── Preview fallback ───────────────────────────────────────────────────────
  console.log('[SourcingOS waitlist] Preview signup:', { email, role, focus, intent, source_page })
  return NextResponse.json({
    ok: true,
    mode: 'preview',
    message:
      'Captured in preview mode. Connect Supabase (or Resend/ConvertKit) to enable durable waitlist storage.',
  })
}
