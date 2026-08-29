import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { contactRequestSchema } from '@/lib/contact-request'

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'contact')
  if (!rl.ok) return rl.response

  const body = await req.json().catch(() => null)
  const parsed = contactRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid contact request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Contact intake is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Contact intake is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  const { category, email, subject, candidate_reference, message } = parsed.data
  const { error } = await sb.from('contact_requests').insert({
    category,
    email,
    subject: subject || null,
    candidate_reference: candidate_reference || null,
    message,
  })

  if (error) {
    console.error('[SourcingOS contact] persistence error:', error.message)
    return NextResponse.json(
      { ok: false, error: 'We could not save your request. Please try again later.' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ok: true,
    message:
      category === 'security'
        ? 'Security report received. Please avoid sending secrets, credentials, or unnecessary personal data in follow-up messages.'
        : 'Request received. We will review it as part of the beta support queue.',
  })
}
