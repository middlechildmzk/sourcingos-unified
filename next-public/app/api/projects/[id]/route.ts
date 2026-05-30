import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRouteSession()
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase not configured.' }, { status: 503 })
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

  const sb = createServerSupabaseClient()
  const { data, error } = await sb!.from('projects').select('*').eq('id', params.id).eq('owner_id', session.userId!).single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 })
  return NextResponse.json({ ok: true, project: data })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRouteSession()
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase not configured.' }, { status: 503 })
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

  const body = await req.json()
  const sb = createServerSupabaseClient()

  const { data, error } = await sb!
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('owner_id', session.userId!)  // owner_id check prevents cross-user writes
    .select('*').single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, project: data })
}
