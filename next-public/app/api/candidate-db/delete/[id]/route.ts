import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

const candidateIdSchema = z.string().uuid()

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const { id } = await params
  const parsed = candidateIdSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid candidate id.' }, { status: 400 })
  }

  if (gate.preview) {
    return NextResponse.json(
      { ok: false, error: 'Candidate deletion is disabled in preview mode.' },
      { status: 403 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Candidate persistence is unavailable.' },
      { status: 503 }
    )
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Candidate persistence is unavailable.' },
      { status: 503 }
    )
  }

  const { data, error } = await sb.rpc('delete_candidate_bundle', {
    p_owner_id: gate.userId,
    p_candidate_id: parsed.data,
  })

  if (error) {
    console.error('[SourcingOS candidate delete] deletion failed:', error.message)
    return NextResponse.json({ ok: false, error: 'Candidate deletion failed.' }, { status: 500 })
  }

  const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  if (result.deleted === false) {
    return NextResponse.json({ ok: false, error: 'Candidate not found.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    deleted: true,
    candidateId: parsed.data,
    rolesAffected: Number(result.rolesAffected || 0),
    sourceProfilesRemoved: Number(result.sourceProfilesRemoved || 0),
    note: 'Candidate record and known linked evidence/provenance were removed.',
  })
}
