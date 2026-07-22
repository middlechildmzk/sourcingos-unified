// ─────────────────────────────────────────────────────────────────────────────
// /api/network/list — Network Vault read API.
//
// Lists the user's imported LinkedIn connections as relationship context only.
// Reads the same source_profiles rows written by /api/network/import-linkedin.
//
// Security: fail-closed auth, rate-limited, owner-scoped, read-only. Contact
// signals remain unverified. No outreach or identity merge occurs here.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'

export const dynamic = 'force-dynamic'

const IMPORT_SOURCE = 'resume_xray'
const IMPORT_TYPE = 'linkedin_connections'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export interface NetworkRow {
  id: string
  candidateId: string | null
  name: string
  title: string
  company: string
  location: string
  linkedinUrl: string | null
  email: string | null
  connectedOn: string | null
  importLabel: string | null
  status: string
  importedAt: string | null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function boundedLimit(value: unknown): number {
  return Math.max(1, Math.min(MAX_LIMIT, nonNegativeInteger(value, DEFAULT_LIMIT)))
}

function toRow(sp: Record<string, unknown>, snake: boolean): NetworkRow {
  const raw = (sp.raw || {}) as Record<string, unknown>
  const displayName = str(snake ? sp.display_name : sp.displayName)
  const headline = str(sp.headline)
  const organization = str(sp.organization)
  const profileUrl = str(snake ? sp.profile_url : sp.profileUrl)
  const location = str(sp.location)
  const fullName = str(raw.fullName) || [raw.firstName, raw.lastName].map(str).filter(Boolean).join(' ')
  return {
    id: str(sp.id),
    candidateId: (snake ? sp.candidate_id : sp.candidateId) ? str(snake ? sp.candidate_id : sp.candidateId) : null,
    name: displayName || fullName || 'LinkedIn connection',
    title: headline || str(raw.position),
    company: organization || str(raw.company),
    location: location || str(raw.location),
    linkedinUrl: profileUrl || str(raw.url) || null,
    email: str(raw.email) || null,
    connectedOn: str(raw.connectedOn) || null,
    importLabel: str(raw.importLabel) || null,
    status: str(sp.status) || 'pending',
    importedAt: str(snake ? sp.created_at : sp.createdAt) || str(snake ? sp.last_seen_at : sp.lastSeenAt) || null,
  }
}

function isLinkedInRow(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).importType === IMPORT_TYPE
}

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  const ql = q.toLowerCase()
  const limit = boundedLimit(req.nextUrl.searchParams.get('limit'))
  const offset = nonNegativeInteger(req.nextUrl.searchParams.get('offset'))

  if (gate.preview || !isSupabaseConfigured()) {
    const db = getCandidateDb()
    let allRows = (db.sourceProfiles as Array<Record<string, unknown>>)
      .filter(sp => str(sp.source) === IMPORT_SOURCE && isLinkedInRow(sp.raw))
      .map(sp => toRow(sp, false))
    if (ql) allRows = allRows.filter(row => `${row.name} ${row.title} ${row.company}`.toLowerCase().includes(ql))
    const rows = allRows.slice(offset, offset + limit)
    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      rows,
      returned: rows.length,
      total: allRows.length,
      page: { limit, offset, hasMore: offset + rows.length < allRows.length },
      _note: 'Preview mode: imported rows live in memory only and reset on restart.',
    })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Network store unavailable.' }, { status: 500 })

  let query = sb
    .from('source_profiles')
    .select('id, candidate_id, profile_url, display_name, headline, organization, location, raw, status, created_at, last_seen_at', { count: 'exact' })
    .eq('owner_id', gate.userId)
    .eq('source', IMPORT_SOURCE)
    .contains('raw', { importType: IMPORT_TYPE })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    const escaped = q.replace(/[%,()]/g, ' ').trim()
    if (escaped) query = query.or(`display_name.ilike.%${escaped}%,headline.ilike.%${escaped}%,organization.ilike.%${escaped}%`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ ok: false, error: 'Network list query failed.' }, { status: 500 })

  const rows = (data || []).map((sp: Record<string, unknown>) => toRow(sp, true))
  const total = count || 0
  return NextResponse.json({
    ok: true,
    persistence_mode: 'supabase',
    rows,
    returned: rows.length,
    total,
    page: { limit, offset, hasMore: offset + rows.length < total },
  })
}
