import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

// Must be dynamic — reads cookies/session on every request
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const projectData = {
      name: String(body.name || body.role_title || 'New Project').slice(0, 200),
      role_title: body.role_title ? String(body.role_title).slice(0, 200) : null,
      jd: body.jd ? String(body.jd) : null,
      must_haves: Array.isArray(body.must_haves) ? body.must_haves : (body.must_haves ? [body.must_haves] : []),
      nice_to_haves: Array.isArray(body.nice_to_haves) ? body.nice_to_haves : [],
      disqualifiers: Array.isArray(body.disqualifiers) ? body.disqualifiers : [],
      target_companies: Array.isArray(body.target_companies) ? body.target_companies : [],
      search_lanes: Array.isArray(body.search_lanes) ? body.search_lanes : [],
      status: 'active',
    }

    // ── Preview mode ──────────────────────────────────────────────
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mode: 'preview',
        project: {
          id: crypto.randomUUID(),
          owner_id: 'preview',
          ...projectData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        note: 'Preview mode — project is not persisted. Configure Supabase to enable durability.',
      })
    }

    // ── Supabase write ────────────────────────────────────────────
    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    // Security sprint: writes are always scoped to the authenticated user.
    const ownerId = gate.userId

    const { data, error } = await sb.from('projects').insert({ owner_id: ownerId, ...projectData }).select('*').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, mode: 'supabase', project: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Create project failed.' }, { status: 500 })
  }
}
