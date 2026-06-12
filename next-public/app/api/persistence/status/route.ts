import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const durable = isSupabaseConfigured() && !gate.preview
  return NextResponse.json({
    ok: true,
    persistence: durable ? 'durable' : 'preview',
    note: durable
      ? 'Saved work is persisted to your account.'
      : 'Preview mode: saved work will NOT survive a restart.',
  })
}
