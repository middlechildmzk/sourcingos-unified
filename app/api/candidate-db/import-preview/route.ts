import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function text(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const incoming = Array.isArray((body as { rows?: unknown[] })?.rows) ? (body as { rows: unknown[] }).rows.slice(0, 40) : []
  const rows = incoming.map((value, index) => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return { index, name: text(row.name, 240), company: text(row.company, 240), email: text(row.email, 320) }
  }).filter(row => row.name)

  if (!rows.length) return NextResponse.json({ ok: true, mode: gate.preview ? 'preview' : 'supabase', checked: 0, duplicates: [] })
  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'preview', checked: rows.length, duplicates: [], note: 'Duplicate checks require the connected Candidate Graph.' })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Candidate Graph is unavailable.' }, { status: 500 })

  const duplicates = (await Promise.all(rows.map(async row => {
    const { data, error } = await sb
      .from('candidates')
      .select('id,canonical_name,headline,current_company,location,merge_status')
      .eq('owner_id', gate.userId)
      .ilike('canonical_name', escapeLike(row.name))
      .limit(5)

    if (error || !data?.length) return null
    const normalizedCompany = row.company.toLowerCase()
    const matches = data.map(candidate => {
      const companyMatches = normalizedCompany && String(candidate.current_company || '').trim().toLowerCase() === normalizedCompany
      return {
        id: candidate.id,
        canonicalName: candidate.canonical_name,
        headline: candidate.headline,
        currentCompany: candidate.current_company,
        location: candidate.location,
        mergeStatus: candidate.merge_status,
        confidence: companyMatches ? 'high' : 'possible',
      }
    })
    return { index: row.index, name: row.name, company: row.company, matches }
  }))).filter(Boolean)

  return NextResponse.json({ ok: true, mode: 'supabase', checked: rows.length, duplicates })
}
