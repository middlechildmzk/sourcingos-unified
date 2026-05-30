import 'server-only'
import { NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET() {
  const session = await getRouteSession()

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'preview', projects: [], note: 'Preview mode — no Supabase configured.' })
  }

  if (!session.authenticated) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

  const { data, error } = await sb
    .from('projects')
    .select('id, name, role_title, status, created_at, updated_at')
    .eq('owner_id', session.userId!)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, mode: 'supabase', projects: data ?? [] })
}
