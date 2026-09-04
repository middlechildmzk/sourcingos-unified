import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { allSourceNames, type SourceName } from '@/lib/source-types'

const EXECUTABLE_FLEET_SOURCES = new Set<SourceName>([
  'github', 'stackoverflow', 'crates', 'npm', 'npi', 'orcid',
  'serverfault', 'security_se', 'devops_se', 'unix_se', 'dba_se', 'networkeng_se',
])

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  if (gate.preview || !isSupabaseConfigured()) return NextResponse.json({ ok: true, intents: [], preview: true })
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })
  const { data, error } = await sb.from('fleet_standing_intents').select('*').eq('owner_id', gate.userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, intents: data || [], executableSources: [...EXECUTABLE_FLEET_SOURCES] })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  if (gate.preview || !isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Standing intents require authenticated production persistence.' }, { status: 503 })
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const label = String(body.label || '').trim().slice(0, 160)
  const hypothesis = String(body.hypothesis || '').trim().slice(0, 1000)
  const capabilityTerms = Array.isArray(body.capabilityTerms) ? body.capabilityTerms.map(String).map((v: string) => v.trim()).filter(Boolean).slice(0, 30) : []
  const sources = Array.isArray(body.sources)
    ? body.sources.map(String).filter((value: string): value is SourceName => allSourceNames.includes(value as SourceName) && EXECUTABLE_FLEET_SOURCES.has(value as SourceName))
    : []
  if (!label || !hypothesis || !sources.length) return NextResponse.json({ ok: false, error: 'label, hypothesis, and at least one executable source are required.' }, { status: 400 })

  const cadenceMinutes = Math.max(30, Math.min(10080, Math.trunc(Number(body.cadenceMinutes || 360))))
  const peopleLimit = Math.max(1, Math.min(25, Math.trunc(Number(body.peopleLimit || 10))))
  const creditsPerRun = Math.max(1, Math.min(200, Math.trunc(Number(body.creditsPerRun || Math.max(peopleLimit, sources.length * peopleLimit)))))

  const { data, error } = await sb.from('fleet_standing_intents').insert({
    owner_id: gate.userId,
    label,
    hypothesis,
    capability_terms: capabilityTerms,
    location: String(body.location || '').trim().slice(0, 200) || null,
    sources,
    cadence_minutes: cadenceMinutes,
    people_limit: peopleLimit,
    credits_per_run: creditsPerRun,
    enabled: body.enabled !== false,
  }).select('*').single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, intent: data, identityMergeAuthorized: false, contactValuesCaptured: false })
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ ok: false, error: 'id is required.' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (typeof body.enabled === 'boolean') update.enabled = body.enabled
  if (body.clearPause === true) update.paused_reason = null
  const { data, error } = await sb.from('fleet_standing_intents').update(update).eq('owner_id', gate.userId).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ ok: false, error: 'Standing intent not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, intent: data })
}
