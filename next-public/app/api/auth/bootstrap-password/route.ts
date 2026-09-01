import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface BootstrapBody {
  email?: unknown
  setupCode?: unknown
  password?: unknown
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

function validToken(providedCode: string, storedHash: string) {
  try {
    const providedHash = createHash('sha256').update(providedCode, 'utf8').digest()
    const expectedHash = Buffer.from(storedHash, 'hex')
    return expectedHash.length === providedHash.length && timingSafeEqual(providedHash, expectedHash)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  let body: BootstrapBody
  try {
    body = await request.json() as BootstrapBody
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const setupCode = typeof body.setupCode === 'string' ? body.setupCode.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !email.includes('@') || !setupCode) {
    return json({ error: 'Beta email and setup code are required.' }, 400)
  }
  if (password.length < 12 || password.length > 128) {
    return json({ error: 'Choose a password between 12 and 128 characters.' }, 400)
  }

  const sb = createServerSupabaseClient()
  if (!sb) return json({ error: 'Password setup is temporarily unavailable.' }, 503)

  const { data: tokenRow, error: tokenError } = await sb
    .from('auth_password_bootstrap_tokens')
    .select('user_id,email,token_hash,expires_at,used_at')
    .eq('email', email)
    .maybeSingle()

  const invalidMessage = 'Setup code is invalid, expired, or already used.'
  if (tokenError || !tokenRow || tokenRow.used_at) {
    return json({ error: invalidMessage }, 403)
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return json({ error: invalidMessage }, 403)
  }
  if (!validToken(setupCode, tokenRow.token_hash)) {
    return json({ error: invalidMessage }, 403)
  }

  const { data: authUser, error: authLookupError } = await sb.auth.admin.getUserById(tokenRow.user_id)
  const user = authUser?.user
  if (
    authLookupError ||
    !user ||
    user.email?.toLowerCase() !== email ||
    user.app_metadata?.beta_access !== true
  ) {
    return json({ error: 'This account is not eligible for beta password setup.' }, 403)
  }

  // Consume the setup token before changing the credential so a successful
  // password update cannot leave a reusable password-reset capability behind.
  const consumedAt = new Date().toISOString()
  const { data: consumed, error: consumeError } = await sb
    .from('auth_password_bootstrap_tokens')
    .update({ used_at: consumedAt })
    .eq('user_id', tokenRow.user_id)
    .is('used_at', null)
    .select('user_id')
    .maybeSingle()

  if (consumeError || !consumed) {
    return json({ error: invalidMessage }, 403)
  }

  const { error: updateError } = await sb.auth.admin.updateUserById(tokenRow.user_id, {
    password,
    email_confirm: true,
    app_metadata: {
      ...user.app_metadata,
      beta_access: true,
      password_login: true,
    },
  })

  if (updateError) {
    // Best-effort restore so an operational Auth error does not permanently
    // burn a valid setup token before the password is actually changed.
    await sb
      .from('auth_password_bootstrap_tokens')
      .update({ used_at: null })
      .eq('user_id', tokenRow.user_id)
      .eq('used_at', consumedAt)

    return json({ error: 'Could not set the password. Please try again.' }, 500)
  }

  return json({ ok: true }, 200)
}
