import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  IdentitySchemaUnavailableError,
  isIdentitySchemaUnavailable,
  listIdentityProposals,
} from '@/lib/identity/proposal-read'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  status: z.enum(['pending', 'approved', 'rejected', 'auto_attached_deterministic', 'superseded']).default('pending'),
})

export async function GET(request: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(request, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') || undefined,
    offset: request.nextUrl.searchParams.get('offset') || undefined,
    status: request.nextUrl.searchParams.get('status') || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      available: true,
      code: 'invalid_identity_proposal_query',
      error: 'Invalid identity proposal query.',
      issues: parsed.error.flatten(),
    }, { status: 400 })
  }

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      available: false,
      code: 'identity_schema_unavailable',
      error: 'Durable identity review is unavailable in preview mode. No proposal data was read or written.',
    }, { status: 503 })
  }

  try {
    return NextResponse.json(await listIdentityProposals(gate.userId, parsed.data))
  } catch (error) {
    if (error instanceof IdentitySchemaUnavailableError || isIdentitySchemaUnavailable(error)) {
      return NextResponse.json({
        ok: false,
        available: false,
        code: 'identity_schema_unavailable',
        error: 'The durable identity-review schema is not applied in this environment.',
      }, { status: 503 })
    }
    return NextResponse.json({
      ok: false,
      available: true,
      code: 'identity_proposal_read_failed',
      error: error instanceof Error ? error.message : 'Could not load identity proposals.',
    }, { status: 500 })
  }
}
