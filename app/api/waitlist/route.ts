import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
  role: z.string().max(120).optional(),
  focus: z.string().max(120).optional(),
  intent: z.string().max(240).optional(),
  source_page: z.string().max(240).optional(),
})

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'waitlist')
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid waitlist payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, role, focus, intent, source_page } = parsed.data
  const isProduction = process.env.VERCEL_ENV === 'production'

  // ── Supabase persistence when configured ──────────────────────────────────
  if (isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      const { error } = await sb.from('waitlist').upsert(
        { email, role: role || null, focus: focus || null, intent: intent || null, source_page: source_page || null },
        { onConflict: 'email' }   // idempotent — re-joins don't create duplicates
      )
      if (!error) {
        return NextResponse.json({
          ok: true,
          mode: 'supabase',
          message: 'You are on the list. We will reach out when your cohort opens.',
        })
      }
      // HONEST FAILURE: the write did not happen. Never tell the user it did.
      console.error('[SourcingOS waitlist] Supabase write error:', error.message)
      return NextResponse.json(
        {
          ok: false,
          error:
            'We could not save your request just now, so you are not on the list yet. Please try again in a minute.',
        },
        { status: 503 }
      )
    }
  }

  // ── No persistence backend available ──────────────────────────────────────
  if (isProduction) {
    // Production must never fake a signup. Fail honestly.
    console.error('[SourcingOS waitlist] Persistence unavailable in production (Supabase not configured)')
    return NextResponse.json(
      {
        ok: false,
        error:
          'We could not save your request just now, so you are not on the list yet. Please try again in a minute.',
      },
      { status: 503 }
    )
  }

  // ── Preview/dev fallback (never reachable in production) ──────────────────
  console.log('[SourcingOS waitlist] Preview signup:', { email, role, focus, intent, source_page })
  return NextResponse.json({
    ok: true,
    mode: 'preview',
    persisted: false,
    message:
      'Captured in preview mode. Connect Supabase (or Resend/ConvertKit) to enable durable waitlist storage.',
  })
}
