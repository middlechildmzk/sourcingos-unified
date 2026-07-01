// ─────────────────────────────────────────────────────────────────────────────
// /api/network/list — Network Vault read API.
//
// Lists the user's imported LinkedIn connections (relationship context only).
// Reads them the EXACT way /api/network/import-linkedin writes them:
//   • source_profiles.source            = 'resume_xray'   (compatibility lane)
//   • source_profiles.raw.importType    = 'linkedin_connections'
//   • source_profiles.raw.importSource  = 'linkedin_export'
// Everything the Vault needs (name, title, company, url, email, connectedOn) is
// already on the source_profiles row + its raw jsonb, so this is a single-table,
// owner-scoped read. No joins, no schema change, no enum change.
//
// Security: fail-closed (requireSession), rate-limited, owner-scoped. Mirrors
// /api/candidate-db/list, including the clearly-labeled in-memory preview path.
//
// Trust posture: imported rows are relationship context, never verified candidate
// facts. Contact signals are unverified. This route is read-only — no writes,
// no outreach, no auto-merge.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'

export const dynamic = 'force-dynamic'

// Match the import route's compatibility lane + raw marker exactly.
const IMPORT_SOURCE = 'resume_xray'
const IMPORT_TYPE = 'linkedin_connections'
const MAX_ROWS = 300

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

// Normalize a source_profiles row (snake_case from Supabase, camelCase from the
// in-memory preview store) into a single Vault row shape.
function toRow(sp: Record<string, unknown>, snake: boolean): NetworkRow {
  const raw = (sp.raw || {}) as Record<string, unknown>
  const displayName = str(snake ? sp.display_name : sp.displayName)
  const headline = str(snake ? sp.headline : sp.headline)
  const organization = str(snake ? sp.organization : sp.organization)
  const profileUrl = str(snake ? sp.profile_url : sp.profileUrl)
  const location = str(snake ? sp.location : sp.location)
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
    status: str(snake ? sp.status : sp.status) || 'pending',
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

  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 120)
  const ql = q.toLowerCase()

  // ── Preview fallback (Supabase not configured / explicit bypass) ────────────
  if (gate.preview || !isSupabaseConfigured()) {
    const db = getCandidateDb()
    let rows = (db.sourceProfiles as Array<Record<string, unknown>>)
      .filter(sp => str(sp.source) === IMPORT_SOURCE && isLinkedInRow(sp.raw))
      .map(sp => toRow(sp, false))
    if (ql) rows = rows.filter(r => `${r.name} ${r.title} ${r.company}`.toLowerCase().includes(ql))
    const truncated = rows.length > MAX_ROWS
    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      rows: rows.slice(0, MAX_ROWS),
      returned: Math.min(rows.length, MAX_ROWS),
      truncated,
      _note: 'Preview mode: imported rows live in memory only and reset on restart.',
    })
  }

  // ── Supabase (durable) ──────────────────────────────────────────────────────
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Network store unavailable.' }, { status: 500 })

  let query = sb
    .from('source_profiles')
    .select('id, candidate_id, profile_url, display_name, headline, organization, location, raw, status, created_at, last_seen_at')
    .eq('owner_id', gate.userId)
    .eq('source', IMPORT_SOURCE)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (q) {
    // Server-side search across name/title/company so it works across the full
    // import (not just the loaded page). Strip characters that break the or() grammar.
    const esc = q.replace(/[%,()]/g, ' ').trim()
    if (esc) query = query.or(`display_name.ilike.%${esc}%,headline.ilike.%${esc}%,organization.ilike.%${esc}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: 'Network list query failed.' }, { status: 500 })

  // Narrow to LinkedIn-imported rows in JS (robust regardless of jsonb-filter support).
  const rows = (data || [])
    .filter((sp: Record<string, unknown>) => isLinkedInRow(sp.raw))
    .map((sp: Record<string, unknown>) => toRow(sp, true))

  return NextResponse.json({
    ok: true,
    persistence_mode: 'supabase',
    rows,
    returned: rows.length,
    truncated: rows.length >= MAX_ROWS,
  })
}
