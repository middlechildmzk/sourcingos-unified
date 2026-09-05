import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { classifyKnownPersonLookupV41_1 } from '@/lib/person-lookup-v41-1'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function graphCandidate(row: any) {
  return {
    id: String(row.id),
    canonicalName: String(row.canonical_name ?? row.canonicalName ?? ''),
    headline: row.headline || undefined,
    currentTitle: row.current_title ?? row.currentTitle ?? undefined,
    currentCompany: row.current_company ?? row.currentCompany ?? undefined,
    location: row.location || undefined,
    skills: Array.isArray(row.skills) ? row.skills : [],
    entityKind: 'person' as const,
  }
}

function urlVariants(value: string): string[] {
  const variants = new Set<string>([value])
  try {
    const url = new URL(value)
    url.hash = ''
    variants.add(url.toString())
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
      variants.add(url.toString())
    } else if (url.pathname !== '/') {
      url.pathname = `${url.pathname}/`
      variants.add(url.toString())
    }
  } catch {
    // classifyKnownPersonLookupV41_1 already validates exact URLs.
  }
  return Array.from(variants).slice(0, 4)
}

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const raw = String(req.nextUrl.searchParams.get('identifier') || '').trim().slice(0, 500)
  const input = classifyKnownPersonLookupV41_1(raw)
  if (!input.exact) {
    return NextResponse.json({ ok: false, error: 'Exact identifier lookup requires an email or HTTP(S) profile URL.' }, { status: 400 })
  }

  if (gate.preview || !isSupabaseConfigured()) {
    const db = getCandidateDb()
    const ids = new Set<string>()
    if (input.kind === 'email') {
      for (const contact of db.contactSignals) {
        if (String(contact.value || '').trim().toLowerCase() === input.normalized) {
          if (contact.candidateId) ids.add(contact.candidateId)
        }
      }
    } else {
      const variants = new Set(urlVariants(input.normalized).map(value => value.toLowerCase()))
      for (const profile of db.sourceProfiles) {
        if (profile.profileUrl && variants.has(profile.profileUrl.toLowerCase()) && profile.candidateId) ids.add(profile.candidateId)
      }
      for (const contact of db.contactSignals) {
        if (variants.has(String(contact.value || '').trim().toLowerCase()) && contact.candidateId) ids.add(contact.candidateId)
      }
    }
    const candidates = db.candidates.filter(candidate => ids.has(candidate.id)).map(graphCandidate)
    return NextResponse.json({ ok: true, identifierKind: input.kind, exact: true, candidates })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Candidate Graph persistence unavailable.' }, { status: 503 })

  const ids = new Set<string>()
  if (input.kind === 'email') {
    const { data, error } = await sb
      .from('candidate_contacts')
      .select('candidate_id')
      .eq('owner_id', gate.userId)
      .ilike('value', input.normalized)
      .limit(20)
    if (error) return NextResponse.json({ ok: false, error: 'Exact contact identifier lookup failed.' }, { status: 500 })
    for (const row of data || []) if (row.candidate_id) ids.add(String(row.candidate_id))
  } else {
    const variants = urlVariants(input.normalized)
    const [profiles, contacts] = await Promise.all([
      sb.from('source_profiles').select('candidate_id').eq('owner_id', gate.userId).in('profile_url', variants).limit(20),
      sb.from('candidate_contacts').select('candidate_id').eq('owner_id', gate.userId).in('value', variants).limit(20),
    ])
    if (profiles.error || contacts.error) return NextResponse.json({ ok: false, error: 'Exact profile identifier lookup failed.' }, { status: 500 })
    for (const row of profiles.data || []) if (row.candidate_id) ids.add(String(row.candidate_id))
    for (const row of contacts.data || []) if (row.candidate_id) ids.add(String(row.candidate_id))
  }

  if (!ids.size) {
    return NextResponse.json({ ok: true, identifierKind: input.kind, exact: true, candidates: [] })
  }

  const { data, error } = await sb
    .from('candidates')
    .select('id,canonical_name,headline,current_title,current_company,location,skills')
    .eq('owner_id', gate.userId)
    .in('id', Array.from(ids))
    .limit(20)
  if (error) return NextResponse.json({ ok: false, error: 'Candidate Graph exact identifier lookup failed.' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    identifierKind: input.kind,
    exact: true,
    candidates: (data || []).map(graphCandidate),
  })
}
