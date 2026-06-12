import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

// Must be dynamic — reads cookies/session on every request
export const dynamic = 'force-dynamic'

// Explicit whitelist of fields the client is allowed to update on a project.
// Blocked: owner_id, id, created_at, updated_at (system-managed).
// Using a whitelist instead of ...spread prevents any future column injection.
const ALLOWED_UPDATE_FIELDS = [
  'name', 'role_title', 'jd', 'must_haves', 'nice_to_haves',
  'disqualifiers', 'target_companies', 'search_lanes', 'status',
] as const
type AllowedField = typeof ALLOWED_UPDATE_FIELDS[number]

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(_req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const session = await getRouteSession()
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase not configured.' }, { status: 503 })
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

  const sb = createServerSupabaseClient()
  const { data, error } = await sb!
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('owner_id', session.userId!)
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 })
  return NextResponse.json({ ok: true, project: data })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const session = await getRouteSession()
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase not configured.' }, { status: 503 })
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

  const rawBody = await req.json()

  // Build a strict whitelist update — never spread rawBody directly.
  // owner_id, id, created_at, and updated_at are blocked from client input.
  const updateData: Partial<Record<AllowedField, unknown>> = {}
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in rawBody) {
      updateData[field] = rawBody[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid fields to update.' }, { status: 400 })
  }

  const sb = createServerSupabaseClient()
  const { data, error } = await sb!
    .from('projects')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('owner_id', session.userId!)   // scopes to owner — cannot update other users' projects
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, project: data })
}
