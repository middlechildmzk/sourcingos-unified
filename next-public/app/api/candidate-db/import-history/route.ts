import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'preview', batches: getCandidateDb().importBatches.slice(0, 50) })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Candidate Graph is unavailable.' }, { status: 500 })

  const { data, error } = await sb
    .from('candidate_import_batches')
    .select('id,import_type,file_name,rows_seen,records_created,warnings,created_at')
    .eq('owner_id', gate.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const batches = (data || []).map(batch => ({
    id: batch.id,
    importType: batch.import_type,
    fileName: batch.file_name,
    rowsSeen: batch.rows_seen,
    recordsCreated: batch.records_created,
    warnings: batch.warnings || [],
    createdAt: batch.created_at,
  }))

  return NextResponse.json({ ok: true, mode: 'supabase', batches })
}
