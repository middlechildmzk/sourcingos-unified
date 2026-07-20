import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { ROLE_STAGES, type RoleWorkspace } from '@/lib/role-workspace'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROLE_STATUSES = new Set(['draft', 'calibrating', 'active', 'paused', 'closed'])
const FIT_DECISIONS = new Set(['unreviewed', 'strong_fit', 'possible_fit', 'not_fit'])
const CONTACT_STATUSES = new Set(['unknown', 'signals_found', 'verified', 'blocked'])
const EVIDENCE_STATUSES = new Set(['unreviewed', 'reviewed', 'conflicting', 'stale'])
const LANE_STATUSES = new Set(['proposed', 'approved', 'paused'])
const ROLE_STAGE_SET = new Set<string>(ROLE_STAGES)

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function textArray(value: unknown, maxItems = 30, maxLength = 200): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => text(item, maxLength)).filter(Boolean))).slice(0, maxItems)
}

function identityKey(candidate: RoleWorkspace['candidates'][number]): string {
  const sourceUrl = text(candidate.sourceUrl, 1500).toLowerCase()
  if (sourceUrl) return `url:${sourceUrl}`
  if (candidate.candidateId && UUID_RE.test(candidate.candidateId)) return `candidate:${candidate.candidateId}`
  return `profile:${text(candidate.name, 200).toLowerCase()}|${text(candidate.company, 200).toLowerCase()}|${text(candidate.source, 120).toLowerCase()}`
}

function validateWorkspace(value: unknown): { ok: true; workspace: RoleWorkspace } | { ok: false; error: string } {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Workspace payload is required.' }
  const workspace = value as RoleWorkspace
  if (!UUID_RE.test(String(workspace.id || ''))) return { ok: false, error: 'Workspace id must be a UUID.' }
  if (!workspace.intake || typeof workspace.intake !== 'object') return { ok: false, error: 'Workspace intake is required.' }
  if (!text(workspace.intake.title, 200)) return { ok: false, error: 'Role title is required.' }
  if (!ROLE_STATUSES.has(String(workspace.status || ''))) return { ok: false, error: 'Invalid role status.' }
  if (!Array.isArray(workspace.searchLanes) || !Array.isArray(workspace.candidates) || !Array.isArray(workspace.activity)) {
    return { ok: false, error: 'Search lanes, candidates, and activity must be arrays.' }
  }
  if (workspace.searchLanes.length > 50 || workspace.candidates.length > 5000 || workspace.activity.length > 10000) {
    return { ok: false, error: 'Workspace exceeds the current sync limits.' }
  }
  return { ok: true, workspace }
}

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  if (!isSupabaseConfigured() || gate.preview) {
    return NextResponse.json({ ok: true, mode: 'preview', workspaces: [], note: 'Durable role storage is not configured.' })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

  const ownerId = gate.userId
  const { data: roles, error: roleError } = await sb
    .from('role_workspaces')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (roleError) return NextResponse.json({ ok: false, error: roleError.message }, { status: 500 })
  const roleIds = (roles || []).map(role => role.id)
  if (!roleIds.length) return NextResponse.json({ ok: true, mode: 'supabase', workspaces: [] })

  const [lanesResult, candidatesResult, activityResult] = await Promise.all([
    sb.from('role_search_lanes').select('*').eq('owner_id', ownerId).in('role_id', roleIds),
    sb.from('role_candidates').select('*').eq('owner_id', ownerId).in('role_id', roleIds),
    sb.from('role_activity').select('*').eq('owner_id', ownerId).in('role_id', roleIds).order('created_at', { ascending: false }),
  ])

  const firstError = lanesResult.error || candidatesResult.error || activityResult.error
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 })

  const workspaces = (roles || []).map(role => ({
    id: role.id,
    status: role.status,
    intake: role.intake,
    searchLanes: (lanesResult.data || []).filter(lane => lane.role_id === role.id).map(lane => ({
      id: lane.lane_key,
      label: lane.label,
      purpose: lane.purpose,
      query: lane.query,
      source: lane.source,
      status: lane.status,
    })),
    candidates: (candidatesResult.data || []).filter(candidate => candidate.role_id === role.id).map(candidate => ({
      id: candidate.id,
      candidateId: candidate.candidate_id || undefined,
      name: candidate.name,
      headline: candidate.headline,
      company: candidate.company,
      location: candidate.location,
      source: candidate.source,
      sourceUrl: candidate.source_url || undefined,
      stage: candidate.stage,
      fitDecision: candidate.fit_decision,
      fitReasons: candidate.fit_reasons || [],
      concerns: candidate.concerns || [],
      tags: candidate.tags || [],
      contactStatus: candidate.contact_status,
      evidenceStatus: candidate.evidence_status,
      addedAt: candidate.added_at,
      updatedAt: candidate.updated_at,
    })),
    activity: (activityResult.data || []).filter(activity => activity.role_id === role.id).map(activity => ({
      id: activity.event_key,
      type: activity.event_type,
      message: activity.message,
      createdAt: activity.created_at,
    })),
    createdAt: role.created_at,
    updatedAt: role.updated_at,
  }))

  return NextResponse.json({ ok: true, mode: 'supabase', workspaces })
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

  const validation = validateWorkspace((body as { workspace?: unknown })?.workspace)
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })

  if (!isSupabaseConfigured() || gate.preview) {
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      persisted: false,
      workspaceId: validation.workspace.id,
      note: 'Workspace remains browser-local because durable storage is not configured.',
    })
  }

  const workspace = validation.workspace
  const ownerId = gate.userId
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

  const intake = {
    title: text(workspace.intake.title, 200),
    location: text(workspace.intake.location, 200),
    workMode: text(workspace.intake.workMode, 30),
    compensation: text(workspace.intake.compensation, 200),
    clearance: text(workspace.intake.clearance, 200),
    mustHaves: textArray(workspace.intake.mustHaves),
    niceToHaves: textArray(workspace.intake.niceToHaves),
    disqualifiers: textArray(workspace.intake.disqualifiers),
    targetCompanies: textArray(workspace.intake.targetCompanies),
    adjacentBackgrounds: textArray(workspace.intake.adjacentBackgrounds),
    hiringManagerNotes: text(workspace.intake.hiringManagerNotes, 5000),
    rawDescription: text(workspace.intake.rawDescription, 50000),
  }

  const { error: roleError } = await sb.from('role_workspaces').upsert({
    id: workspace.id,
    owner_id: ownerId,
    status: workspace.status,
    title: intake.title,
    location: intake.location,
    work_mode: intake.workMode || 'unknown',
    compensation: intake.compensation,
    clearance: intake.clearance,
    intake,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (roleError) return NextResponse.json({ ok: false, error: roleError.message }, { status: 500 })

  const laneRows = workspace.searchLanes.map(lane => ({
    owner_id: ownerId,
    role_id: workspace.id,
    lane_key: text(lane.id, 120),
    label: text(lane.label, 200),
    purpose: text(lane.purpose, 1000),
    query: text(lane.query, 5000),
    source: text(lane.source, 120),
    status: LANE_STATUSES.has(lane.status) ? lane.status : 'proposed',
    updated_at: new Date().toISOString(),
  })).filter(row => row.lane_key && row.label && row.source)

  const candidateRows = workspace.candidates.map(candidate => ({
    id: UUID_RE.test(String(candidate.id || '')) ? candidate.id : crypto.randomUUID(),
    owner_id: ownerId,
    role_id: workspace.id,
    candidate_id: candidate.candidateId && UUID_RE.test(candidate.candidateId) ? candidate.candidateId : null,
    source_profile_id: null,
    identity_key: identityKey(candidate),
    name: text(candidate.name, 200) || 'Unconfirmed profile',
    headline: text(candidate.headline, 500),
    company: text(candidate.company, 300),
    location: text(candidate.location, 300),
    source: text(candidate.source, 120) || 'unknown',
    source_url: text(candidate.sourceUrl, 1500) || null,
    stage: ROLE_STAGE_SET.has(candidate.stage) ? candidate.stage : 'needs_review',
    fit_decision: FIT_DECISIONS.has(candidate.fitDecision) ? candidate.fitDecision : 'unreviewed',
    fit_reasons: textArray(candidate.fitReasons),
    concerns: textArray(candidate.concerns),
    tags: textArray(candidate.tags),
    contact_status: CONTACT_STATUSES.has(candidate.contactStatus) ? candidate.contactStatus : 'unknown',
    evidence_status: EVIDENCE_STATUSES.has(candidate.evidenceStatus) ? candidate.evidenceStatus : 'unreviewed',
    snapshot: { importedFrom: 'v20_browser_workspace' },
    added_at: candidate.addedAt,
    updated_at: candidate.updatedAt,
  }))

  const activityRows = workspace.activity.map(activity => ({
    owner_id: ownerId,
    role_id: workspace.id,
    event_key: text(activity.id, 120),
    event_type: text(activity.type, 120),
    message: text(activity.message, 2000),
    payload: {},
    created_at: activity.createdAt,
  })).filter(row => row.event_key && row.event_type && row.message)

  const operations = []
  if (laneRows.length) operations.push(sb.from('role_search_lanes').upsert(laneRows, { onConflict: 'role_id,lane_key' }))
  if (candidateRows.length) operations.push(sb.from('role_candidates').upsert(candidateRows, { onConflict: 'role_id,identity_key' }))
  if (activityRows.length) operations.push(sb.from('role_activity').upsert(activityRows, { onConflict: 'role_id,event_key' }))

  const results = await Promise.all(operations)
  const writeError = results.find(result => result.error)?.error
  if (writeError) return NextResponse.json({ ok: false, error: writeError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    mode: 'supabase',
    persisted: true,
    workspaceId: workspace.id,
    counts: { lanes: laneRows.length, candidates: candidateRows.length, activity: activityRows.length },
  })
}
