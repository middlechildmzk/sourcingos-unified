import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SOURCE_CATALOG = [
  { key: 'linkedin_connections', label: 'LinkedIn Connections Export', category: 'owned_export', mode: 'bulk_csv', note: 'User-owned relationship export. Relationship context only.' },
  { key: 'ats_crm_exports', label: 'ATS / CRM Exports', category: 'owned_export', mode: 'bulk_csv', note: 'Greenhouse, Lever, iCIMS, Bullhorn, Avature, Gem and similar exports.' },
  { key: 'hireez_seekout_exports', label: 'Sourcing Platform Exports', category: 'owned_export', mode: 'bulk_csv', note: 'Import data you are authorized to export from HireEZ, SeekOut or similar tools.' },
  { key: 'github', label: 'GitHub Public Profiles', category: 'official_api', mode: 'evidence', note: 'Public developer profiles and repositories through approved API usage.' },
  { key: 'orcid', label: 'ORCID', category: 'official_api', mode: 'evidence', note: 'Public researcher identities and works.' },
  { key: 'pubmed', label: 'PubMed / NCBI', category: 'official_api', mode: 'evidence', note: 'Publication authors and affiliations.' },
  { key: 'uspto', label: 'USPTO Inventors', category: 'public_government', mode: 'evidence', note: 'Public patent inventor records.' },
  { key: 'usaspending', label: 'USAspending / Contract Awards', category: 'public_government', mode: 'company_signal', note: 'Organization and award intelligence used to identify talent ecosystems.' },
  { key: 'conference_speakers', label: 'Conference and Speaker Pages', category: 'public_professional', mode: 'review_queue', note: 'Public bios and event rosters. Identity linking requires review.' },
  { key: 'company_leadership', label: 'Company Leadership Pages', category: 'public_professional', mode: 'review_queue', note: 'Public company bios and leadership pages.' },
]

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  if (!isSupabaseConfigured() || gate.preview) {
    return NextResponse.json({ ok: true, mode: 'preview', metrics: { candidates: 0, sourceProfiles: 0, evidence: 0, contacts: 0, queued: 0 }, sources: SOURCE_CATALOG, target: { profiles: 100000 } })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const ownerId = gate.userId

  const [candidates, profiles, evidence, contacts, queued, target, registry] = await Promise.all([
    sb.from('candidates').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('candidate_contacts').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('candidate_enrichment_queue').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).in('status', ['queued','running','needs_review']),
    sb.from('candidate_growth_targets').select('*').eq('owner_id', ownerId).maybeSingle(),
    sb.from('candidate_source_registry').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false }),
  ])

  const error = candidates.error || profiles.error || evidence.error || contacts.error || queued.error || target.error || registry.error
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    mode: 'supabase',
    metrics: {
      candidates: candidates.count || 0,
      sourceProfiles: profiles.count || 0,
      evidence: evidence.count || 0,
      contacts: contacts.count || 0,
      queued: queued.count || 0,
    },
    target: target.data || { target_profiles: 100000, target_date: null, daily_import_target: 10000 },
    sources: SOURCE_CATALOG.map(source => ({ ...source, registry: (registry.data || []).find(row => row.source_key === source.key) || null })),
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: false, error: 'Durable storage is required.' }, { status: 503 })

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const body = await req.json().catch(() => ({})) as { action?: string; candidateIds?: string[]; targetProfiles?: number; targetDate?: string }
  const ownerId = gate.userId

  if (body.action === 'queue_enrichment') {
    const ids = Array.from(new Set((body.candidateIds || []).filter(id => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 1000)
    if (!ids.length) return NextResponse.json({ ok: false, error: 'Select at least one candidate.' }, { status: 400 })
    const rows = ids.map(candidateId => ({ owner_id: ownerId, candidate_id: candidateId, priority: 50, requested_sources: ['public_bio','github','publications','patents','company_page'] }))
    const { error } = await sb.from('candidate_enrichment_queue').upsert(rows, { onConflict: 'owner_id,candidate_id' })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, queued: rows.length })
  }

  if (body.action === 'set_target') {
    const targetProfiles = Math.max(1, Math.min(10000000, Number(body.targetProfiles) || 100000))
    const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate || '') ? body.targetDate : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const { error } = await sb.from('candidate_growth_targets').upsert({ owner_id: ownerId, target_profiles: targetProfiles, target_date: targetDate, daily_import_target: Math.ceil(targetProfiles / 7), updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, targetProfiles, targetDate })
  }

  return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
}
