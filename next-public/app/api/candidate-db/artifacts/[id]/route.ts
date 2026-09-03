import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

function missingArtifactTable(error: any) {
  return error?.code === '42P01' || /candidate_artifacts|relation .* does not exist/i.test(String(error?.message || ''))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  const { id: candidateId } = await params

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'preview', artifacts: [], migrationPending: false, note: 'Preview mode does not persist candidate artifacts yet.' })
  }

  const session = await getRouteSession()
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

  const { data, error } = await sb
    .from('candidate_artifacts')
    .select('*')
    .eq('owner_id', session.userId!)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (missingArtifactTable(error)) {
      return NextResponse.json({ ok: true, mode: 'supabase', artifacts: [], migrationPending: true, note: 'Candidate artifact migration has not been applied in this environment yet.' })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const artifacts = (data || []).map((row: any) => ({
    id: row.id,
    candidateId: row.candidate_id,
    sourceProfileId: row.source_profile_id || undefined,
    artifactType: row.artifact_type,
    dataOrigin: row.data_origin,
    fileName: row.file_name || undefined,
    mimeType: row.mime_type || undefined,
    sourceUrl: row.source_url || undefined,
    contentSha256: row.content_sha256,
    extractionVersion: row.extraction_version,
    rawTextLength: row.raw_text_length || 0,
    identityAnchors: row.identity_anchors || {},
    metadata: row.metadata || {},
    observedAt: row.observed_at,
    createdAt: row.created_at,
  }))

  return NextResponse.json({ ok: true, mode: 'supabase', artifacts, migrationPending: false })
}
