import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TOKEN_SHA256 = 'ef8090d93afa44ae614f9bad2c9e770b05dabb5fa01bffb6aefeb7b4c4053fdb'
const EMAIL_SHA256 = '2edbdf1be7220a83ad0d3a261a3eb9ca927017666c8345f3526702c6f4593637'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function safeHashEquals(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, error: 'preview_only' }, { status: 404 })
  }

  const token = request.nextUrl.searchParams.get('token') ?? ''
  const email = (request.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()

  if (
    !safeHashEquals(sha256(token), TOKEN_SHA256) ||
    !safeHashEquals(sha256(email), EMAIL_SHA256)
  ) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return NextResponse.json({ ok: false, error: 'supabase_admin_unavailable' }, { status: 503 })
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { beta_access: true },
  })

  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'user_creation_failed' },
      { status: error?.status ?? 500 },
    )
  }

  const { error: profileError } = await sb.from('profiles').upsert({
    id: data.user.id,
    email,
    role: 'beta_user',
    plan: 'beta',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (profileError) {
    await sb.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ ok: false, error: 'profile_entitlement_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id, plan: 'beta' })
}
